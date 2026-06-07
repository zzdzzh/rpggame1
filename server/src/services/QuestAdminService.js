const { Quest, PlayerQuest, sequelize } = require('../models');

class QuestAdminService {
  async listQuests(filters = {}) {
    const {
      quest_type,
      is_active,
      trigger_type,
      trigger_target_id,
      search,
      page = 1,
      page_size = 20
    } = filters;

    const limit = Math.min(Number(page_size) || 20, 100);
    const offset = ((Number(page) || 1) - 1) * limit;

    const where = {};

    if (quest_type !== undefined) {
      where.quest_type = quest_type;
    }
    if (is_active !== undefined) {
      where.is_active = is_active === 'true' || is_active === true;
    }
    if (search !== undefined && String(search).trim().length > 0) {
      where.name = sequelize.where(
        sequelize.fn('LOWER', sequelize.col('name')),
        'LIKE',
        `%${String(search).trim().toLowerCase()}%`
      );
    }

    const { count, rows } = await Quest.findAndCountAll({
      where,
      limit,
      offset,
      order: [['quest_id', 'DESC']]
    });

    const questIds = rows.map(q => q.quest_id);
    let playerCounts = {};
    if (questIds.length > 0) {
      const counts = await PlayerQuest.findAll({
        attributes: ['quest_id', [sequelize.fn('COUNT', sequelize.col('player_quest_id')), 'count']],
        where: { quest_id: questIds },
        group: ['quest_id'],
        raw: true
      });
      for (const c of counts) {
        playerCounts[c.quest_id] = Number(c.count);
      }
    }

    const quests = rows.map(q => {
      const plain = q.toJSON();
      plain.player_count = playerCounts[q.quest_id] || 0;
      return plain;
    });

    return {
      total: count,
      page: Number(page) || 1,
      page_size: limit,
      quests
    };
  }

  async getQuestDetail(questId) {
    const quest = await Quest.findByPk(questId);
    if (!quest) {
      throw Object.assign(new Error('Quest not found'), { statusCode: 404 });
    }

    const playerCount = await PlayerQuest.count({ where: { quest_id: questId } });
    const plain = quest.toJSON();
    plain.player_count = playerCount;
    return plain;
  }

  async createQuest(data) {
    const validation = this._validateQuestData(data);
    if (!validation.valid) {
      throw Object.assign(new Error(validation.message), { statusCode: 400 });
    }

    const existing = await Quest.findOne({ where: { name: data.name } });
    if (existing) {
      throw Object.assign(new Error('Quest name already exists'), { statusCode: 409 });
    }

    const quest = await Quest.create({
      name: data.name,
      description: data.description,
      quest_type: data.quest_type,
      level_min: data.level_min,
      level_max: data.level_max,
      trigger_conditions_json: data.trigger_conditions_json,
      prerequisites_json: data.prerequisites_json,
      objectives_json: data.objectives_json,
      rewards_json: data.rewards_json,
      max_concurrent_limit: data.max_concurrent_limit,
      is_active: data.is_active !== undefined ? data.is_active : true
    });

    return {
      success: true,
      quest_id: quest.quest_id,
      message: 'Quest created successfully'
    };
  }

  async updateQuest(questId, data) {
    const quest = await Quest.findByPk(questId);
    if (!quest) {
      throw Object.assign(new Error('Quest not found'), { statusCode: 404 });
    }

    if (data.name !== undefined && data.name !== quest.name) {
      const existing = await Quest.findOne({ where: { name: data.name } });
      if (existing) {
        throw Object.assign(new Error('Quest name already exists'), { statusCode: 409 });
      }
    }

    const validation = this._validateQuestData({ ...quest.toJSON(), ...data }, true);
    if (!validation.valid) {
      throw Object.assign(new Error(validation.message), { statusCode: 400 });
    }

    const updateFields = {};
    const allowedFields = [
      'name', 'description', 'quest_type', 'level_min', 'level_max',
      'trigger_conditions_json', 'prerequisites_json', 'objectives_json',
      'rewards_json', 'max_concurrent_limit', 'is_active'
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateFields[field] = data[field];
      }
    }

    if (Object.keys(updateFields).length > 0) {
      await quest.update(updateFields);
    }

    return {
      success: true,
      quest_id: quest.quest_id,
      message: 'Quest updated successfully'
    };
  }

  async deleteQuest(questId) {
    const quest = await Quest.findByPk(questId);
    if (!quest) {
      throw Object.assign(new Error('Quest not found'), { statusCode: 404 });
    }

    const playerCount = await PlayerQuest.count({ where: { quest_id: questId } });
    if (playerCount > 0) {
      throw Object.assign(new Error('Cannot delete quest with existing player records'), { statusCode: 400 });
    }

    await quest.destroy();

    return {
      success: true,
      message: 'Quest deleted successfully'
    };
  }

  async toggleQuestActive(questId) {
    const quest = await Quest.findByPk(questId);
    if (!quest) {
      throw Object.assign(new Error('Quest not found'), { statusCode: 404 });
    }

    quest.is_active = !quest.is_active;
    await quest.save();

    return {
      success: true,
      quest_id: quest.quest_id,
      is_active: quest.is_active,
      message: `Quest ${quest.is_active ? 'activated' : 'deactivated'} successfully`
    };
  }

  _validateQuestData(data, isPartial = false) {
    if (!isPartial || data.name !== undefined) {
      if (!data.name || String(data.name).trim().length === 0) {
        return { valid: false, message: 'name is required' };
      }
      if (String(data.name).length > 100) {
        return { valid: false, message: 'name must not exceed 100 characters' };
      }
    }

    if (!isPartial || data.quest_type !== undefined) {
      const validTypes = ['main', 'side', 'daily'];
      if (!validTypes.includes(data.quest_type)) {
        return { valid: false, message: 'quest_type must be one of main, side, daily' };
      }
    }

    if (!isPartial || data.level_min !== undefined) {
      const levelMin = Number(data.level_min);
      if (!Number.isFinite(levelMin) || levelMin < 1) {
        return { valid: false, message: 'level_min must be at least 1' };
      }
    }

    if (data.level_max !== undefined && data.level_max !== null) {
      const levelMax = Number(data.level_max);
      const levelMin = Number(data.level_min ?? 1);
      if (!Number.isFinite(levelMax) || levelMax < levelMin) {
        return { valid: false, message: 'level_max must be greater than or equal to level_min' };
      }
    }

    if (!isPartial || data.objectives_json !== undefined) {
      const objectives = data.objectives_json;
      if (!Array.isArray(objectives) || objectives.length === 0) {
        return { valid: false, message: 'objectives_json must be a non-empty array' };
      }
    }

    if (!isPartial || data.rewards_json !== undefined) {
      const rewards = data.rewards_json;
      if (!Array.isArray(rewards)) {
        return { valid: false, message: 'rewards_json must be an array' };
      }
    }

    if (!isPartial || data.trigger_conditions_json !== undefined) {
      if (data.trigger_conditions_json === undefined || data.trigger_conditions_json === null) {
        return { valid: false, message: 'trigger_conditions_json is required' };
      }
    }

    if (!isPartial || data.prerequisites_json !== undefined) {
      if (data.prerequisites_json === undefined || data.prerequisites_json === null) {
        return { valid: false, message: 'prerequisites_json is required' };
      }
    }

    if (!isPartial || data.max_concurrent_limit !== undefined) {
      const limit = Number(data.max_concurrent_limit);
      if (!Number.isFinite(limit) || limit < 1) {
        return { valid: false, message: 'max_concurrent_limit must be at least 1' };
      }
    }

    return { valid: true };
  }
}

module.exports = new QuestAdminService();
