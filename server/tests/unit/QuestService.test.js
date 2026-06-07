const QuestService = require('../../src/services/QuestService');
const { computeOverallProgressPercent } = require('../../src/utils/questProgress');

jest.mock('../../src/models', () => ({
  Quest: {
    findAll: jest.fn(),
    findByPk: jest.fn()
  },
  PlayerQuest: {
    findAll: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    create: jest.fn()
  },
  Character: {
    findByPk: jest.fn()
  },
  ItemDefinition: {
    findAll: jest.fn()
  },
  sequelize: {
    transaction: jest.fn()
  }
}));

const { Quest, PlayerQuest, Character, ItemDefinition, sequelize } = require('../../src/models');

jest.mock('../../src/utils/questProgress', () => ({
  computeOverallProgressPercent: jest.fn()
}));

describe('QuestService', () => {
  let mockTransaction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction = {
      commit: jest.fn(),
      rollback: jest.fn(),
      finished: false
    };
    sequelize.transaction.mockResolvedValue(mockTransaction);
  });

  describe('getAvailableQuests', () => {
    const characterId = 1;
    const mockCharacter = { character_id: characterId, level: 5 };

    it('returns available quests filtered by level', async () => {
      Character.findByPk.mockResolvedValue(mockCharacter);
      Quest.findAll.mockResolvedValue([
        { quest_id: 1, name: 'Q1', level_min: 1, level_max: 10, is_active: true, prerequisites_json: [], trigger_conditions_json: [], objectives_json: [], rewards_json: [] },
        { quest_id: 2, name: 'Q2', level_min: 10, level_max: 20, is_active: true, prerequisites_json: [], trigger_conditions_json: [], objectives_json: [], rewards_json: [] }
      ]);
      PlayerQuest.findAll.mockResolvedValue([]);
      ItemDefinition.findAll.mockResolvedValue([]);

      const result = await QuestService.getAvailableQuests(characterId);

      expect(result.count).toBe(1);
      expect(result.quests[0].quest_id).toBe(1);
    });

    it('excludes quests already accepted or completed', async () => {
      Character.findByPk.mockResolvedValue(mockCharacter);
      Quest.findAll.mockResolvedValue([
        { quest_id: 1, name: 'Q1', level_min: 1, level_max: null, is_active: true, prerequisites_json: [], trigger_conditions_json: [], objectives_json: [], rewards_json: [] }
      ]);
      PlayerQuest.findAll.mockResolvedValue([
        { quest_id: 1, status: 'accepted' }
      ]);
      ItemDefinition.findAll.mockResolvedValue([]);

      const result = await QuestService.getAvailableQuests(characterId);

      expect(result.count).toBe(0);
    });

    it('filters by prerequisites', async () => {
      Character.findByPk.mockResolvedValue(mockCharacter);
      Quest.findAll.mockResolvedValue([
        { quest_id: 2, name: 'Q2', level_min: 1, level_max: null, is_active: true, prerequisites_json: [1], trigger_conditions_json: [], objectives_json: [], rewards_json: [] }
      ]);
      PlayerQuest.findAll.mockResolvedValue([
        { quest_id: 1, status: 'completed' }
      ]);
      ItemDefinition.findAll.mockResolvedValue([]);

      const result = await QuestService.getAvailableQuests(characterId);

      expect(result.count).toBe(1);
    });

    it('excludes quests when prerequisites not met', async () => {
      Character.findByPk.mockResolvedValue(mockCharacter);
      Quest.findAll.mockResolvedValue([
        { quest_id: 2, name: 'Q2', level_min: 1, level_max: null, is_active: true, prerequisites_json: [1], trigger_conditions_json: [], objectives_json: [], rewards_json: [] }
      ]);
      PlayerQuest.findAll.mockResolvedValue([]);
      ItemDefinition.findAll.mockResolvedValue([]);

      const result = await QuestService.getAvailableQuests(characterId);

      expect(result.count).toBe(0);
    });

    it('filters by trigger_type and target_id', async () => {
      Character.findByPk.mockResolvedValue(mockCharacter);
      Quest.findAll.mockResolvedValue([
        { quest_id: 1, name: 'Q1', level_min: 1, level_max: null, is_active: true, prerequisites_json: [], trigger_conditions_json: [{ trigger_type: 'kill', target_id: 101 }], objectives_json: [], rewards_json: [] },
        { quest_id: 2, name: 'Q2', level_min: 1, level_max: null, is_active: true, prerequisites_json: [], trigger_conditions_json: [{ trigger_type: 'collect', target_id: 202 }], objectives_json: [], rewards_json: [] }
      ]);
      PlayerQuest.findAll.mockResolvedValue([]);
      ItemDefinition.findAll.mockResolvedValue([]);

      const result = await QuestService.getAvailableQuests(characterId, { trigger_type: 'kill', target_id: 101 });

      expect(result.count).toBe(1);
      expect(result.quests[0].quest_id).toBe(1);
    });

    it('filters by quest_type', async () => {
      Character.findByPk.mockResolvedValue(mockCharacter);
      Quest.findAll.mockResolvedValue([
        { quest_id: 1, name: 'Q1', quest_type: 'main', level_min: 1, level_max: null, is_active: true, prerequisites_json: [], trigger_conditions_json: [], objectives_json: [], rewards_json: [] },
        { quest_id: 2, name: 'Q2', quest_type: 'side', level_min: 1, level_max: null, is_active: true, prerequisites_json: [], trigger_conditions_json: [], objectives_json: [], rewards_json: [] }
      ]);
      PlayerQuest.findAll.mockResolvedValue([]);
      ItemDefinition.findAll.mockResolvedValue([]);

      const result = await QuestService.getAvailableQuests(characterId, { quest_type: 'main' });

      expect(Quest.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: { is_active: true, quest_type: 'main' }
      }));
      expect(result.count).toBe(2); // filtering happens in JS, both pass level check
    });

    it('uses provided level filter instead of character level', async () => {
      Character.findByPk.mockResolvedValue(mockCharacter);
      Quest.findAll.mockResolvedValue([
        { quest_id: 1, name: 'Q1', level_min: 1, level_max: 3, is_active: true, prerequisites_json: [], trigger_conditions_json: [], objectives_json: [], rewards_json: [] }
      ]);
      PlayerQuest.findAll.mockResolvedValue([]);
      ItemDefinition.findAll.mockResolvedValue([]);

      const result = await QuestService.getAvailableQuests(characterId, { level: 2 });

      expect(result.count).toBe(1);
    });

    it('throws 404 when character not found', async () => {
      Character.findByPk.mockResolvedValue(null);

      await expect(QuestService.getAvailableQuests(characterId)).rejects.toMatchObject({
        message: 'Character not found',
        statusCode: 404
      });
    });

    it('includes item names in rewards preview', async () => {
      Character.findByPk.mockResolvedValue(mockCharacter);
      Quest.findAll.mockResolvedValue([
        { quest_id: 1, name: 'Q1', level_min: 1, level_max: null, is_active: true, prerequisites_json: [], trigger_conditions_json: [], objectives_json: [], rewards_json: [{ type: 'item', item_definition_id: 10, value: 1 }] }
      ]);
      PlayerQuest.findAll.mockResolvedValue([]);
      ItemDefinition.findAll.mockResolvedValue([
        { item_definition_id: 10, name: 'Magic Sword' }
      ]);

      const result = await QuestService.getAvailableQuests(characterId);

      expect(result.quests[0].rewards_preview[0].item_name).toBe('Magic Sword');
    });
  });

  describe('acceptQuest', () => {
    const characterId = 1;
    const questId = 10;
    const mockCharacter = { character_id: characterId, level: 5 };
    const mockQuest = {
      quest_id: questId,
      name: 'Test Quest',
      is_active: true,
      level_min: 1,
      level_max: 10,
      prerequisites_json: [],
      objectives_json: [{ objective_id: 'obj1', type: 'kill', target_id: 101, required_amount: 5 }],
      max_concurrent_limit: 0
    };

    it('accepts a quest successfully', async () => {
      Character.findByPk.mockResolvedValue(mockCharacter);
      Quest.findByPk.mockResolvedValue(mockQuest);
      PlayerQuest.findOne.mockResolvedValue(null);
      PlayerQuest.count.mockResolvedValue(0);
      PlayerQuest.create.mockResolvedValue({
        player_quest_id: 100,
        character_id: characterId,
        quest_id: questId,
        status: 'accepted',
        progress_json: { obj1: 0 },
        accepted_at: new Date('2024-01-01')
      });

      const result = await QuestService.acceptQuest(characterId, questId);

      expect(result.success).toBe(true);
      expect(result.status).toBe('accepted');
      expect(result.quest.objectives[0].current_progress).toBe(0);
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it('throws 404 when character not found', async () => {
      Character.findByPk.mockResolvedValue(null);

      await expect(QuestService.acceptQuest(characterId, questId)).rejects.toMatchObject({
        message: 'Character not found',
        statusCode: 404
      });
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    it('throws 404 when quest not found or inactive', async () => {
      Character.findByPk.mockResolvedValue(mockCharacter);
      Quest.findByPk.mockResolvedValue(null);

      await expect(QuestService.acceptQuest(characterId, questId)).rejects.toMatchObject({
        message: 'Quest not found or inactive',
        statusCode: 404
      });
    });

    it('throws 409 when quest already accepted or completed', async () => {
      Character.findByPk.mockResolvedValue(mockCharacter);
      Quest.findByPk.mockResolvedValue(mockQuest);
      PlayerQuest.findOne.mockResolvedValue({ player_quest_id: 100 });

      await expect(QuestService.acceptQuest(characterId, questId)).rejects.toMatchObject({
        message: 'Quest already accepted or completed',
        statusCode: 409
      });
    });

    it('throws 400 when level insufficient (below min)', async () => {
      Character.findByPk.mockResolvedValue({ ...mockCharacter, level: 0 });
      Quest.findByPk.mockResolvedValue(mockQuest);
      PlayerQuest.findOne.mockResolvedValue(null);

      await expect(QuestService.acceptQuest(characterId, questId)).rejects.toMatchObject({
        message: 'Level insufficient',
        statusCode: 400
      });
    });

    it('throws 400 when level exceeds max', async () => {
      Character.findByPk.mockResolvedValue({ ...mockCharacter, level: 15 });
      Quest.findByPk.mockResolvedValue(mockQuest);
      PlayerQuest.findOne.mockResolvedValue(null);

      await expect(QuestService.acceptQuest(characterId, questId)).rejects.toMatchObject({
        message: 'Level insufficient',
        statusCode: 400
      });
    });

    it('throws 400 when prerequisites not met', async () => {
      Character.findByPk.mockResolvedValue(mockCharacter);
      Quest.findByPk.mockResolvedValue({
        ...mockQuest,
        prerequisites_json: [5]
      });
      PlayerQuest.findOne.mockResolvedValue(null);
      PlayerQuest.findAll.mockResolvedValue([]); // no completed quests

      await expect(QuestService.acceptQuest(characterId, questId)).rejects.toMatchObject({
        message: 'Prerequisites not met',
        statusCode: 400
      });
    });

    it('throws 400 when max concurrent quests reached', async () => {
      Character.findByPk.mockResolvedValue(mockCharacter);
      Quest.findByPk.mockResolvedValue(mockQuest);
      PlayerQuest.findOne.mockResolvedValue(null);
      PlayerQuest.count.mockResolvedValue(20);

      await expect(QuestService.acceptQuest(characterId, questId)).rejects.toMatchObject({
        message: 'Max concurrent quests reached',
        statusCode: 400
      });
    });

    it('throws 400 when max concurrent limit for quest type reached', async () => {
      Character.findByPk.mockResolvedValue(mockCharacter);
      Quest.findByPk.mockResolvedValue({
        ...mockQuest,
        quest_type: 'daily',
        max_concurrent_limit: 2
      });
      PlayerQuest.findOne.mockResolvedValue(null);
      PlayerQuest.count
        .mockResolvedValueOnce(5) // concurrent count
        .mockResolvedValueOnce(2); // same quest type count

      await expect(QuestService.acceptQuest(characterId, questId)).rejects.toMatchObject({
        message: 'Max concurrent limit for this quest type reached',
        statusCode: 400
      });
    });

    it('passes prerequisites when all completed', async () => {
      Character.findByPk.mockResolvedValue(mockCharacter);
      Quest.findByPk.mockResolvedValue({
        ...mockQuest,
        prerequisites_json: [5]
      });
      PlayerQuest.findOne.mockResolvedValue(null);
      PlayerQuest.findAll.mockResolvedValue([
        { quest_id: 5, status: 'completed' }
      ]);
      PlayerQuest.count.mockResolvedValue(0);
      PlayerQuest.create.mockResolvedValue({
        player_quest_id: 100,
        character_id: characterId,
        quest_id: questId,
        status: 'accepted',
        progress_json: { obj1: 0 },
        accepted_at: new Date('2024-01-01')
      });

      const result = await QuestService.acceptQuest(characterId, questId);

      expect(result.success).toBe(true);
    });
  });

  describe('getMyQuests', () => {
    const characterId = 1;
    const mockCharacter = { character_id: characterId, level: 5 };

    it('returns quests with computed progress', async () => {
      Character.findByPk.mockResolvedValue(mockCharacter);
      PlayerQuest.findAll.mockResolvedValue([
        {
          player_quest_id: 100,
          quest_id: 10,
          status: 'in_progress',
          progress_json: { obj1: 3 },
          accepted_at: new Date('2024-01-01'),
          completed_at: null,
          claimed_at: null,
          Quest: {
            name: 'Test Quest',
            quest_type: 'main',
            objectives_json: [{ objective_id: 'obj1', type: 'kill', target_name: 'Goblin', required_amount: 5 }]
          }
        }
      ]);
      computeOverallProgressPercent.mockReturnValue(60);

      const result = await QuestService.getMyQuests(characterId);

      expect(result.count).toBe(1);
      expect(result.quests[0].progress.obj1).toEqual({
        current: 3,
        required: 5,
        is_completed: false
      });
      expect(result.quests[0].overall_progress_percent).toBe(60);
    });

    it('filters by status', async () => {
      Character.findByPk.mockResolvedValue(mockCharacter);
      PlayerQuest.findAll.mockResolvedValue([]);

      await QuestService.getMyQuests(characterId, { status: 'completed' });

      expect(PlayerQuest.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: { character_id: characterId, status: 'completed' }
      }));
    });

    it('filters by quest_type', async () => {
      Character.findByPk.mockResolvedValue(mockCharacter);
      PlayerQuest.findAll.mockResolvedValue([]);

      await QuestService.getMyQuests(characterId, { quest_type: 'side' });

      expect(PlayerQuest.findAll).toHaveBeenCalledWith(expect.objectContaining({
        include: [
          {
            model: Quest,
            where: { quest_type: 'side' }
          }
        ]
      }));
    });

    it('throws 404 when character not found', async () => {
      Character.findByPk.mockResolvedValue(null);

      await expect(QuestService.getMyQuests(characterId)).rejects.toMatchObject({
        message: 'Character not found',
        statusCode: 404
      });
    });

    it('marks objective as completed when progress meets required', async () => {
      Character.findByPk.mockResolvedValue(mockCharacter);
      PlayerQuest.findAll.mockResolvedValue([
        {
          player_quest_id: 100,
          quest_id: 10,
          status: 'ready_for_reward',
          progress_json: { obj1: 5 },
          accepted_at: new Date('2024-01-01'),
          completed_at: new Date('2024-01-02'),
          claimed_at: null,
          Quest: {
            name: 'Test Quest',
            quest_type: 'main',
            objectives_json: [{ objective_id: 'obj1', type: 'kill', target_name: 'Goblin', required_amount: 5 }]
          }
        }
      ]);
      computeOverallProgressPercent.mockReturnValue(100);

      const result = await QuestService.getMyQuests(characterId);

      expect(result.quests[0].progress.obj1.is_completed).toBe(true);
    });
  });
});
