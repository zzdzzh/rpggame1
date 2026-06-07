const QuestAdminService = require('../../src/services/QuestAdminService');

jest.mock('../../src/models', () => ({
  Quest: {
    findAndCountAll: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    destroy: jest.fn()
  },
  PlayerQuest: {
    findAll: jest.fn(),
    count: jest.fn()
  },
  sequelize: {
    where: jest.fn((col, op, val) => ({ col, op, val })),
    fn: jest.fn((name, ...args) => ({ name, args })),
    col: jest.fn((name) => ({ name }))
  }
}));

const { Quest, PlayerQuest, sequelize } = require('../../src/models');

describe('QuestAdminService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listQuests', () => {
    it('returns paginated quest list', async () => {
      Quest.findAndCountAll.mockResolvedValue({
        count: 2,
        rows: [
          { quest_id: 1, name: 'Quest 1', toJSON: () => ({ quest_id: 1, name: 'Quest 1' }) },
          { quest_id: 2, name: 'Quest 2', toJSON: () => ({ quest_id: 2, name: 'Quest 2' }) }
        ]
      });
      PlayerQuest.findAll.mockResolvedValue([
        { quest_id: 1, count: 5 },
        { quest_id: 2, count: 3 }
      ]);

      const result = await QuestAdminService.listQuests();

      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.quests).toHaveLength(2);
      expect(result.quests[0].player_count).toBe(5);
    });

    it('filters by quest_type', async () => {
      Quest.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

      await QuestAdminService.listQuests({ quest_type: 'main' });

      expect(Quest.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ quest_type: 'main' })
      }));
    });

    it('filters by is_active', async () => {
      Quest.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

      await QuestAdminService.listQuests({ is_active: 'true' });

      expect(Quest.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ is_active: true })
      }));
    });

    it('filters by search term', async () => {
      Quest.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

      await QuestAdminService.listQuests({ search: 'goblin' });

      expect(Quest.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          name: expect.any(Object)
        })
      }));
    });

    it('respects page and page_size', async () => {
      Quest.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

      await QuestAdminService.listQuests({ page: 2, page_size: 10 });

      expect(Quest.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
        limit: 10,
        offset: 10
      }));
    });

    it('caps page_size at 100', async () => {
      Quest.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

      await QuestAdminService.listQuests({ page_size: 200 });

      expect(Quest.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
        limit: 100
      }));
    });
  });

  describe('getQuestDetail', () => {
    it('returns quest with player count', async () => {
      const mockQuest = {
        quest_id: 1,
        name: 'Quest 1',
        toJSON: () => ({ quest_id: 1, name: 'Quest 1' })
      };
      Quest.findByPk.mockResolvedValue(mockQuest);
      PlayerQuest.count.mockResolvedValue(10);

      const result = await QuestAdminService.getQuestDetail(1);

      expect(result.quest_id).toBe(1);
      expect(result.player_count).toBe(10);
    });

    it('throws 404 when quest not found', async () => {
      Quest.findByPk.mockResolvedValue(null);

      await expect(QuestAdminService.getQuestDetail(1)).rejects.toMatchObject({
        message: 'Quest not found',
        statusCode: 404
      });
    });
  });

  describe('createQuest', () => {
    const validQuestData = {
      name: 'New Quest',
      description: 'A test quest',
      quest_type: 'main',
      level_min: 1,
      level_max: 10,
      trigger_conditions_json: [{ trigger_type: 'kill', target_id: 101 }],
      prerequisites_json: [],
      objectives_json: [{ objective_id: 'obj1', type: 'kill', target_id: 101, required_amount: 5 }],
      rewards_json: [{ type: 'exp', value: 100 }],
      max_concurrent_limit: 1,
      is_active: true
    };

    it('creates a quest successfully', async () => {
      Quest.findOne.mockResolvedValue(null);
      Quest.create.mockResolvedValue({ quest_id: 1, ...validQuestData });

      const result = await QuestAdminService.createQuest(validQuestData);

      expect(result.success).toBe(true);
      expect(result.quest_id).toBe(1);
      expect(Quest.create).toHaveBeenCalledWith(expect.objectContaining({
        name: 'New Quest',
        quest_type: 'main'
      }));
    });

    it('throws 400 when name is missing', async () => {
      await expect(QuestAdminService.createQuest({ ...validQuestData, name: '' })).rejects.toMatchObject({
        message: 'name is required',
        statusCode: 400
      });
    });

    it('throws 400 when name exceeds 100 characters', async () => {
      await expect(QuestAdminService.createQuest({ ...validQuestData, name: 'a'.repeat(101) })).rejects.toMatchObject({
        message: 'name must not exceed 100 characters',
        statusCode: 400
      });
    });

    it('throws 400 when quest_type is invalid', async () => {
      await expect(QuestAdminService.createQuest({ ...validQuestData, quest_type: 'invalid' })).rejects.toMatchObject({
        message: 'quest_type must be one of main, side, daily',
        statusCode: 400
      });
    });

    it('throws 400 when level_min is less than 1', async () => {
      await expect(QuestAdminService.createQuest({ ...validQuestData, level_min: 0 })).rejects.toMatchObject({
        message: 'level_min must be at least 1',
        statusCode: 400
      });
    });

    it('throws 400 when level_max is less than level_min', async () => {
      await expect(QuestAdminService.createQuest({ ...validQuestData, level_max: 0 })).rejects.toMatchObject({
        message: 'level_max must be greater than or equal to level_min',
        statusCode: 400
      });
    });

    it('throws 400 when objectives_json is empty', async () => {
      await expect(QuestAdminService.createQuest({ ...validQuestData, objectives_json: [] })).rejects.toMatchObject({
        message: 'objectives_json must be a non-empty array',
        statusCode: 400
      });
    });

    it('throws 400 when rewards_json is not an array', async () => {
      await expect(QuestAdminService.createQuest({ ...validQuestData, rewards_json: 'not-array' })).rejects.toMatchObject({
        message: 'rewards_json must be an array',
        statusCode: 400
      });
    });

    it('throws 400 when trigger_conditions_json is undefined', async () => {
      const data = { ...validQuestData };
      delete data.trigger_conditions_json;
      await expect(QuestAdminService.createQuest(data)).rejects.toMatchObject({
        message: 'trigger_conditions_json is required',
        statusCode: 400
      });
    });

    it('throws 400 when prerequisites_json is undefined', async () => {
      const data = { ...validQuestData };
      delete data.prerequisites_json;
      await expect(QuestAdminService.createQuest(data)).rejects.toMatchObject({
        message: 'prerequisites_json is required',
        statusCode: 400
      });
    });

    it('throws 400 when max_concurrent_limit is less than 1', async () => {
      await expect(QuestAdminService.createQuest({ ...validQuestData, max_concurrent_limit: 0 })).rejects.toMatchObject({
        message: 'max_concurrent_limit must be at least 1',
        statusCode: 400
      });
    });

    it('throws 409 when quest name already exists', async () => {
      Quest.findOne.mockResolvedValue({ quest_id: 99, name: 'New Quest' });

      await expect(QuestAdminService.createQuest(validQuestData)).rejects.toMatchObject({
        message: 'Quest name already exists',
        statusCode: 409
      });
    });

    it('defaults is_active to true when not provided', async () => {
      Quest.findOne.mockResolvedValue(null);
      Quest.create.mockResolvedValue({ quest_id: 1 });
      const data = { ...validQuestData };
      delete data.is_active;

      await QuestAdminService.createQuest(data);

      expect(Quest.create).toHaveBeenCalledWith(expect.objectContaining({
        is_active: true
      }));
    });
  });

  describe('updateQuest', () => {
    const existingQuest = {
      quest_id: 1,
      name: 'Old Quest',
      description: 'Old desc',
      quest_type: 'main',
      level_min: 1,
      level_max: 10,
      trigger_conditions_json: [],
      prerequisites_json: [],
      objectives_json: [{ objective_id: 'obj1', type: 'kill', target_id: 101, required_amount: 5 }],
      rewards_json: [{ type: 'exp', value: 100 }],
      max_concurrent_limit: 1,
      is_active: true,
      toJSON: function() { return { ...this }; },
      update: jest.fn()
    };

    it('updates quest with partial data', async () => {
      Quest.findByPk.mockResolvedValue(existingQuest);
      Quest.findOne.mockResolvedValue(null);

      const result = await QuestAdminService.updateQuest(1, { name: 'Updated Quest' });

      expect(result.success).toBe(true);
      expect(existingQuest.update).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Updated Quest'
      }));
    });

    it('throws 404 when quest not found', async () => {
      Quest.findByPk.mockResolvedValue(null);

      await expect(QuestAdminService.updateQuest(1, { name: 'Updated' })).rejects.toMatchObject({
        message: 'Quest not found',
        statusCode: 404
      });
    });

    it('throws 409 when updating to an existing name', async () => {
      Quest.findByPk.mockResolvedValue(existingQuest);
      Quest.findOne.mockResolvedValue({ quest_id: 2, name: 'Taken Name' });

      await expect(QuestAdminService.updateQuest(1, { name: 'Taken Name' })).rejects.toMatchObject({
        message: 'Quest name already exists',
        statusCode: 409
      });
    });

    it('does not check name conflict when name unchanged', async () => {
      Quest.findByPk.mockResolvedValue(existingQuest);

      const result = await QuestAdminService.updateQuest(1, { name: 'Old Quest' });

      expect(Quest.findOne).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('validates updated fields', async () => {
      Quest.findByPk.mockResolvedValue(existingQuest);

      await expect(QuestAdminService.updateQuest(1, { level_min: 0 })).rejects.toMatchObject({
        message: 'level_min must be at least 1',
        statusCode: 400
      });
    });

    it('ignores undefined fields', async () => {
      Quest.findByPk.mockResolvedValue(existingQuest);
      Quest.findOne.mockResolvedValue(null);

      await QuestAdminService.updateQuest(1, { description: 'New desc' });

      expect(existingQuest.update).toHaveBeenCalledWith({
        description: 'New desc'
      });
    });

    it('allows updating multiple fields', async () => {
      Quest.findByPk.mockResolvedValue(existingQuest);
      Quest.findOne.mockResolvedValue(null);

      await QuestAdminService.updateQuest(1, {
        description: 'New desc',
        level_max: 20,
        is_active: false
      });

      expect(existingQuest.update).toHaveBeenCalledWith({
        description: 'New desc',
        level_max: 20,
        is_active: false
      });
    });
  });

  describe('deleteQuest', () => {
    it('deletes quest when no player records exist', async () => {
      const mockQuest = {
        quest_id: 1,
        destroy: jest.fn()
      };
      Quest.findByPk.mockResolvedValue(mockQuest);
      PlayerQuest.count.mockResolvedValue(0);

      const result = await QuestAdminService.deleteQuest(1);

      expect(result.success).toBe(true);
      expect(mockQuest.destroy).toHaveBeenCalled();
    });

    it('throws 404 when quest not found', async () => {
      Quest.findByPk.mockResolvedValue(null);

      await expect(QuestAdminService.deleteQuest(1)).rejects.toMatchObject({
        message: 'Quest not found',
        statusCode: 404
      });
    });

    it('throws 400 when players have the quest', async () => {
      const mockQuest = {
        quest_id: 1,
        destroy: jest.fn()
      };
      Quest.findByPk.mockResolvedValue(mockQuest);
      PlayerQuest.count.mockResolvedValue(5);

      await expect(QuestAdminService.deleteQuest(1)).rejects.toMatchObject({
        message: 'Cannot delete quest with existing player records',
        statusCode: 400
      });
      expect(mockQuest.destroy).not.toHaveBeenCalled();
    });
  });

  describe('toggleQuestActive', () => {
    it('activates an inactive quest', async () => {
      const mockQuest = {
        quest_id: 1,
        is_active: false,
        save: jest.fn()
      };
      Quest.findByPk.mockResolvedValue(mockQuest);

      const result = await QuestAdminService.toggleQuestActive(1);

      expect(result.is_active).toBe(true);
      expect(mockQuest.save).toHaveBeenCalled();
      expect(result.message).toBe('Quest activated successfully');
    });

    it('deactivates an active quest', async () => {
      const mockQuest = {
        quest_id: 1,
        is_active: true,
        save: jest.fn()
      };
      Quest.findByPk.mockResolvedValue(mockQuest);

      const result = await QuestAdminService.toggleQuestActive(1);

      expect(result.is_active).toBe(false);
      expect(mockQuest.save).toHaveBeenCalled();
      expect(result.message).toBe('Quest deactivated successfully');
    });

    it('throws 404 when quest not found', async () => {
      Quest.findByPk.mockResolvedValue(null);

      await expect(QuestAdminService.toggleQuestActive(1)).rejects.toMatchObject({
        message: 'Quest not found',
        statusCode: 404
      });
    });
  });
});
