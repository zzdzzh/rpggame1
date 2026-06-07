const { Quest, PlayerQuest, Character, ItemDefinition, sequelize } = require('../models');
const { computeOverallProgressPercent } = require('../utils/questProgress');

const MAX_CONCURRENT_QUESTS = 20;

class QuestService {
  async getAvailableQuests(characterId, filters = {}) {
    const { trigger_type, target_id, level, quest_type } = filters;

    const character = await Character.findByPk(characterId);
    if (!character) {
      throw Object.assign(new Error('Character not found'), { statusCode: 404 });
    }

    const characterLevel = level !== undefined ? Number(level) : character.level;

    const where = { is_active: true };
    if (quest_type) {
      where.quest_type = quest_type;
    }

    const activeQuests = await Quest.findAll({ where });

    const playerQuests = await PlayerQuest.findAll({
      where: { character_id: characterId }
    });
    const playerQuestMap = new Map(playerQuests.map(pq => [pq.quest_id, pq]));

    const completedQuestIds = new Set(
      playerQuests
        .filter(pq => pq.status === 'completed')
        .map(pq => pq.quest_id)
    );

    let available = activeQuests.filter(quest => {
      if (playerQuestMap.has(quest.quest_id)) {
        return false;
      }

      if (characterLevel < quest.level_min) {
        return false;
      }
      if (quest.level_max !== null && quest.level_max !== undefined && characterLevel > quest.level_max) {
        return false;
      }

      const prerequisites = quest.prerequisites_json || [];
      if (prerequisites.length > 0) {
        const allMet = prerequisites.every(prereqId => completedQuestIds.has(prereqId));
        if (!allMet) {
          return false;
        }
      }

      if (trigger_type !== undefined && target_id !== undefined) {
        const triggers = quest.trigger_conditions_json || [];
        const matchesTrigger = triggers.some(t =>
          String(t.trigger_type) === String(trigger_type) &&
          Number(t.target_id) === Number(target_id)
        );
        if (!matchesTrigger) {
          return false;
        }
      }

      return true;
    });

    const itemDefinitionIds = new Set();
    for (const quest of available) {
      const rewards = quest.rewards_json || [];
      for (const reward of rewards) {
        if (reward.type === 'item' && reward.item_definition_id) {
          itemDefinitionIds.add(reward.item_definition_id);
        }
      }
    }

    let itemMap = new Map();
    if (itemDefinitionIds.size > 0) {
      const items = await ItemDefinition.findAll({
        where: { item_definition_id: Array.from(itemDefinitionIds) }
      });
      itemMap = new Map(items.map(i => [i.item_definition_id, i.name]));
    }

    const quests = available.map(quest => {
      const rewardsPreview = (quest.rewards_json || []).map(reward => {
        const preview = {
          type: reward.type,
          value: reward.value
        };
        if (reward.type === 'item') {
          preview.item_definition_id = reward.item_definition_id;
          preview.item_name = itemMap.get(reward.item_definition_id) || null;
        }
        return preview;
      });

      return {
        quest_id: quest.quest_id,
        name: quest.name,
        description: quest.description,
        quest_type: quest.quest_type,
        level_min: quest.level_min,
        level_max: quest.level_max,
        trigger_conditions: quest.trigger_conditions_json,
        objectives: quest.objectives_json,
        rewards_preview: rewardsPreview
      };
    });

    return {
      character_id: characterId,
      count: quests.length,
      quests
    };
  }

  async acceptQuest(characterId, questId) {
    const transaction = await sequelize.transaction();

    try {
      const character = await Character.findByPk(characterId, { transaction });
      if (!character) {
        throw Object.assign(new Error('Character not found'), { statusCode: 404 });
      }

      const quest = await Quest.findByPk(questId, { transaction });
      if (!quest || !quest.is_active) {
        throw Object.assign(new Error('Quest not found or inactive'), { statusCode: 404 });
      }

      const existingPlayerQuest = await PlayerQuest.findOne({
        where: { character_id: characterId, quest_id: questId },
        transaction
      });
      if (existingPlayerQuest) {
        throw Object.assign(new Error('Quest already accepted or completed'), { statusCode: 409 });
      }

      if (character.level < quest.level_min) {
        throw Object.assign(new Error('Level insufficient'), { statusCode: 400 });
      }
      if (quest.level_max !== null && quest.level_max !== undefined && character.level > quest.level_max) {
        throw Object.assign(new Error('Level insufficient'), { statusCode: 400 });
      }

      const prerequisites = quest.prerequisites_json || [];
      if (prerequisites.length > 0) {
        const completedQuests = await PlayerQuest.findAll({
          where: {
            character_id: characterId,
            quest_id: prerequisites,
            status: 'completed'
          },
          transaction
        });
        const completedIds = new Set(completedQuests.map(pq => pq.quest_id));
        const allMet = prerequisites.every(prereqId => completedIds.has(prereqId));
        if (!allMet) {
          throw Object.assign(new Error('Prerequisites not met'), { statusCode: 400 });
        }
      }

      const concurrentCount = await PlayerQuest.count({
        where: {
          character_id: characterId,
          status: ['accepted', 'in_progress', 'ready_for_reward']
        },
        transaction
      });
      if (concurrentCount >= MAX_CONCURRENT_QUESTS) {
        throw Object.assign(new Error('Max concurrent quests reached'), { statusCode: 400 });
      }

      if (quest.max_concurrent_limit > 0) {
        const sameQuestTypeCount = await PlayerQuest.count({
          where: {
            character_id: characterId,
            status: ['accepted', 'in_progress', 'ready_for_reward']
          },
          include: [
            {
              model: Quest,
              where: { quest_type: quest.quest_type }
            }
          ],
          transaction
        });

        if (sameQuestTypeCount >= quest.max_concurrent_limit) {
          throw Object.assign(new Error('Max concurrent limit for this quest type reached'), { statusCode: 400 });
        }
      }

      const initialProgress = {};
      const objectives = quest.objectives_json || [];
      for (const obj of objectives) {
        initialProgress[obj.objective_id] = 0;
      }

      const playerQuest = await PlayerQuest.create({
        character_id: characterId,
        quest_id: questId,
        status: 'accepted',
        progress_json: initialProgress,
        accepted_at: new Date()
      }, { transaction });

      await transaction.commit();

      const questWithProgress = {
        quest_id: quest.quest_id,
        name: quest.name,
        objectives: (quest.objectives_json || []).map(obj => ({
          objective_id: obj.objective_id,
          type: obj.type,
          target_name: obj.target_name,
          required_amount: obj.required_amount,
          description: obj.description,
          current_progress: 0
        }))
      };

      return {
        success: true,
        player_quest_id: playerQuest.player_quest_id,
        status: playerQuest.status,
        accepted_at: playerQuest.accepted_at,
        quest: questWithProgress
      };
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }
      throw error;
    }
  }

  async getMyQuests(characterId, filters = {}) {
    const { status, quest_type } = filters;

    const character = await Character.findByPk(characterId);
    if (!character) {
      throw Object.assign(new Error('Character not found'), { statusCode: 404 });
    }

    const where = { character_id: characterId };
    if (status) {
      where.status = status;
    }

    const includeWhere = {};
    if (quest_type) {
      includeWhere.quest_type = quest_type;
    }

    const playerQuests = await PlayerQuest.findAll({
      where,
      include: [
        {
          model: Quest,
          where: Object.keys(includeWhere).length > 0 ? includeWhere : undefined
        }
      ],
      order: [['accepted_at', 'DESC']]
    });

    const quests = playerQuests.map(pq => {
      const progress = {};
      const objectives = pq.Quest.objectives_json || [];
      for (const obj of objectives) {
        const current = pq.progress_json[obj.objective_id] || 0;
        progress[obj.objective_id] = {
          current,
          required: obj.required_amount,
          is_completed: current >= obj.required_amount
        };
      }

      return {
        player_quest_id: pq.player_quest_id,
        quest_id: pq.quest_id,
        name: pq.Quest.name,
        quest_type: pq.Quest.quest_type,
        status: pq.status,
        progress,
        overall_progress_percent: computeOverallProgressPercent(pq.progress_json, objectives),
        accepted_at: pq.accepted_at,
        completed_at: pq.completed_at,
        claimed_at: pq.claimed_at
      };
    });

    return {
      character_id: characterId,
      count: quests.length,
      quests
    };
  }
}

module.exports = new QuestService();
