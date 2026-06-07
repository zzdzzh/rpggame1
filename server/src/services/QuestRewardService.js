const { PlayerQuest, Character, Quest, sequelize } = require('../models');
const InventoryService = require('./InventoryService');

class QuestRewardService {
  async claimReward(characterId, playerQuestId) {
    const transaction = await sequelize.transaction();

    try {
      const playerQuest = await PlayerQuest.findOne({
        where: { player_quest_id: playerQuestId },
        include: [{ model: Quest }],
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!playerQuest || playerQuest.character_id !== characterId) {
        throw Object.assign(new Error('Player quest not found'), { statusCode: 404 });
      }

      if (playerQuest.status === 'completed') {
        throw Object.assign(new Error('Rewards already claimed'), { statusCode: 409 });
      }

      if (playerQuest.status !== 'ready_for_reward') {
        throw Object.assign(new Error('Quest is not ready for reward'), { statusCode: 400 });
      }

      const character = await Character.findByPk(characterId, { transaction });
      if (!character) {
        throw Object.assign(new Error('Character not found'), { statusCode: 404 });
      }

      const rewards = playerQuest.Quest.rewards_json || [];
      let expReward = 0;
      let goldReward = 0;
      const itemRewardsInput = [];

      for (const reward of rewards) {
        if (reward.type === 'exp') {
          expReward += reward.value || 0;
        } else if (reward.type === 'gold') {
          goldReward += reward.value || 0;
        } else if (reward.type === 'item') {
          itemRewardsInput.push({
            item_definition_id: reward.item_definition_id,
            quantity: reward.value || 1
          });
        }
      }

      character.exp = (character.exp || 0) + expReward;
      character.gold = (character.gold || 0) + goldReward;
      await character.save({ transaction });

      let addedItems = [];
      if (itemRewardsInput.length > 0) {
        try {
          const result = await InventoryService.addItems(characterId, itemRewardsInput, transaction);
          addedItems = result.added || [];
        } catch (error) {
          if (error.message === 'Inventory full') {
            throw Object.assign(new Error('Inventory full'), { statusCode: 400 });
          }
          throw error;
        }
      }

      const claimedAt = new Date();
      await playerQuest.update({
        status: 'completed',
        claimed_at: claimedAt
      }, { transaction });

      await transaction.commit();

      const itemDefinitionMap = new Map();
      for (const reward of rewards) {
        if (reward.type === 'item' && reward.item_definition_id) {
          itemDefinitionMap.set(reward.item_definition_id, reward);
        }
      }

      const items = addedItems.map(item => {
        const rewardDef = itemDefinitionMap.get(item.item_definition_id);
        return {
          item_definition_id: item.item_definition_id,
          name: rewardDef ? rewardDef.name || null : null,
          quantity: item.quantity,
          player_item_id: item.player_item_id
        };
      });

      return {
        success: true,
        player_quest_id: playerQuest.player_quest_id,
        status: 'completed',
        claimed_at: claimedAt,
        rewards: {
          exp: expReward,
          gold: goldReward,
          items
        },
        character: {
          character_id: character.character_id,
          exp: character.exp,
          gold: character.gold,
          level: character.level
        }
      };
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }
      throw error;
    }
  }
}

module.exports = new QuestRewardService();
