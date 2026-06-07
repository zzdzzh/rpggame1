const QuestProgressService = require('../../src/services/QuestProgressService');
const { computeOverallProgressPercent } = require('../../src/utils/questProgress');

jest.mock('../../src/models', () => ({
  Quest: {},
  PlayerQuest: {
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn()
  },
  Character: {
    findByPk: jest.fn()
  },
  sequelize: {}
}));

const { PlayerQuest, Character } = require('../../src/models');

jest.mock('../../src/utils/questProgress', () => ({
  computeOverallProgressPercent: jest.fn()
}));

describe('QuestProgressService', () => {
  let mockIo;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIo = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    };
    QuestProgressService.setIo(mockIo);
  });

  describe('updateProgress', () => {
    const characterId = 1;
    const mockCharacter = { character_id: characterId, level: 5 };

    it('increments progress for matching objectives', async () => {
      Character.findByPk.mockResolvedValue(mockCharacter);
      const playerQuest = {
        player_quest_id: 100,
        character_id: characterId,
        status: 'accepted',
        progress_json: { obj1: 0 },
        completed_at: null,
        Quest: {
          quest_id: 10,
          name: 'Test Quest',
          objectives_json: [
            { objective_id: 'obj1', type: 'kill', target_id: 101, required_amount: 5 }
          ]
        },
        update: jest.fn()
      };
      PlayerQuest.findAll.mockResolvedValue([playerQuest]);
      computeOverallProgressPercent.mockReturnValue(20);

      const result = await QuestProgressService.updateProgress(characterId, 'kill', { target_id: 101, amount: 1 });

      expect(result).toHaveLength(1);
      expect(result[0].progress.obj1).toBe(1);
      expect(playerQuest.update).toHaveBeenCalledWith(expect.objectContaining({
        progress_json: { obj1: 1 },
        status: 'in_progress'
      }));
    });

    it('caps progress at required_amount', async () => {
      Character.findByPk.mockResolvedValue(mockCharacter);
      const playerQuest = {
        player_quest_id: 100,
        character_id: characterId,
        status: 'in_progress',
        progress_json: { obj1: 4 },
        completed_at: null,
        Quest: {
          quest_id: 10,
          name: 'Test Quest',
          objectives_json: [
            { objective_id: 'obj1', type: 'kill', target_id: 101, required_amount: 5 }
          ]
        },
        update: jest.fn()
      };
      PlayerQuest.findAll.mockResolvedValue([playerQuest]);
      computeOverallProgressPercent.mockReturnValue(100);

      const result = await QuestProgressService.updateProgress(characterId, 'kill', { target_id: 101, amount: 10 });

      expect(result[0].progress.obj1).toBe(5);
    });

    it('transitions status accepted -> in_progress', async () => {
      Character.findByPk.mockResolvedValue(mockCharacter);
      const playerQuest = {
        player_quest_id: 100,
        character_id: characterId,
        status: 'accepted',
        progress_json: { obj1: 0 },
        completed_at: null,
        Quest: {
          quest_id: 10,
          name: 'Test Quest',
          objectives_json: [
            { objective_id: 'obj1', type: 'kill', target_id: 101, required_amount: 5 }
          ]
        },
        update: jest.fn()
      };
      PlayerQuest.findAll.mockResolvedValue([playerQuest]);
      computeOverallProgressPercent.mockReturnValue(20);

      await QuestProgressService.updateProgress(characterId, 'kill', { target_id: 101, amount: 1 });

      expect(playerQuest.update).toHaveBeenCalledWith(expect.objectContaining({
        status: 'in_progress'
      }));
    });

    it('transitions status in_progress -> ready_for_reward when all complete', async () => {
      Character.findByPk.mockResolvedValue(mockCharacter);
      const playerQuest = {
        player_quest_id: 100,
        character_id: characterId,
        status: 'in_progress',
        progress_json: { obj1: 4 },
        completed_at: null,
        Quest: {
          quest_id: 10,
          name: 'Test Quest',
          objectives_json: [
            { objective_id: 'obj1', type: 'kill', target_id: 101, required_amount: 5 }
          ]
        },
        update: jest.fn()
      };
      PlayerQuest.findAll.mockResolvedValue([playerQuest]);
      computeOverallProgressPercent.mockReturnValue(100);

      const result = await QuestProgressService.updateProgress(characterId, 'kill', { target_id: 101, amount: 1 });

      expect(playerQuest.update).toHaveBeenCalledWith(expect.objectContaining({
        status: 'ready_for_reward'
      }));
      expect(result[0].status).toBe('ready_for_reward');
    });

    it('emits questUpdate via socket.io', async () => {
      Character.findByPk.mockResolvedValue(mockCharacter);
      const playerQuest = {
        player_quest_id: 100,
        character_id: characterId,
        status: 'accepted',
        progress_json: { obj1: 0 },
        completed_at: null,
        Quest: {
          quest_id: 10,
          name: 'Test Quest',
          objectives_json: [
            { objective_id: 'obj1', type: 'kill', target_id: 101, required_amount: 5 }
          ]
        },
        update: jest.fn()
      };
      PlayerQuest.findAll.mockResolvedValue([playerQuest]);
      computeOverallProgressPercent.mockReturnValue(20);

      await QuestProgressService.updateProgress(characterId, 'kill', { target_id: 101, amount: 1 });

      expect(mockIo.to).toHaveBeenCalledWith('character:1');
      expect(mockIo.emit).toHaveBeenCalledWith('questUpdate', expect.objectContaining({
        player_quest_id: 100,
        quest_id: 10,
        status: 'accepted',
        overall_progress_percent: 20
      }));
    });

    it('emits questReadyForReward when all objectives complete', async () => {
      Character.findByPk.mockResolvedValue(mockCharacter);
      const playerQuest = {
        player_quest_id: 100,
        character_id: characterId,
        status: 'in_progress',
        progress_json: { obj1: 4 },
        completed_at: null,
        Quest: {
          quest_id: 10,
          name: 'Test Quest',
          objectives_json: [
            { objective_id: 'obj1', type: 'kill', target_id: 101, required_amount: 5 }
          ]
        },
        update: jest.fn()
      };
      PlayerQuest.findAll.mockResolvedValue([playerQuest]);
      computeOverallProgressPercent.mockReturnValue(100);

      await QuestProgressService.updateProgress(characterId, 'kill', { target_id: 101, amount: 1 });

      expect(mockIo.emit).toHaveBeenCalledWith('questReadyForReward', expect.objectContaining({
        player_quest_id: 100,
        quest_id: 10,
        message: 'All objectives completed. Quest ready for reward.'
      }));
    });

    it('does not update when no matching objectives', async () => {
      Character.findByPk.mockResolvedValue(mockCharacter);
      const playerQuest = {
        player_quest_id: 100,
        character_id: characterId,
        status: 'accepted',
        progress_json: { obj1: 0 },
        completed_at: null,
        Quest: {
          quest_id: 10,
          name: 'Test Quest',
          objectives_json: [
            { objective_id: 'obj1', type: 'kill', target_id: 101, required_amount: 5 }
          ]
        },
        update: jest.fn()
      };
      PlayerQuest.findAll.mockResolvedValue([playerQuest]);

      const result = await QuestProgressService.updateProgress(characterId, 'collect', { target_id: 999, amount: 1 });

      expect(result).toHaveLength(0);
      expect(playerQuest.update).not.toHaveBeenCalled();
    });

    it('throws 404 when character not found', async () => {
      Character.findByPk.mockResolvedValue(null);

      await expect(QuestProgressService.updateProgress(characterId, 'kill', { target_id: 101 })).rejects.toMatchObject({
        message: 'Character not found',
        statusCode: 404
      });
    });

    it('handles multiple quests in one call', async () => {
      Character.findByPk.mockResolvedValue(mockCharacter);
      const quest1 = {
        player_quest_id: 100,
        character_id: characterId,
        status: 'accepted',
        progress_json: { obj1: 0 },
        completed_at: null,
        Quest: {
          quest_id: 10,
          name: 'Quest 1',
          objectives_json: [
            { objective_id: 'obj1', type: 'kill', target_id: 101, required_amount: 5 }
          ]
        },
        update: jest.fn()
      };
      const quest2 = {
        player_quest_id: 101,
        character_id: characterId,
        status: 'accepted',
        progress_json: { obj2: 0 },
        completed_at: null,
        Quest: {
          quest_id: 11,
          name: 'Quest 2',
          objectives_json: [
            { objective_id: 'obj2', type: 'kill', target_id: 101, required_amount: 3 }
          ]
        },
        update: jest.fn()
      };
      PlayerQuest.findAll.mockResolvedValue([quest1, quest2]);
      computeOverallProgressPercent.mockReturnValue(33);

      const result = await QuestProgressService.updateProgress(characterId, 'kill', { target_id: 101, amount: 1 });

      expect(result).toHaveLength(2);
      expect(quest1.update).toHaveBeenCalled();
      expect(quest2.update).toHaveBeenCalled();
    });
  });

  describe('submitQuest', () => {
    const characterId = 1;

    it('submits quest when 100% progress', async () => {
      const playerQuest = {
        player_quest_id: 100,
        character_id: characterId,
        status: 'in_progress',
        progress_json: { obj1: 5 },
        Quest: {
          quest_id: 10,
          objectives_json: [
            { objective_id: 'obj1', type: 'kill', target_id: 101, required_amount: 5 }
          ]
        },
        update: jest.fn()
      };
      PlayerQuest.findOne.mockResolvedValue(playerQuest);
      computeOverallProgressPercent.mockReturnValue(100);

      const result = await QuestProgressService.submitQuest(characterId, 100);

      expect(result.success).toBe(true);
      expect(result.status).toBe('ready_for_reward');
      expect(playerQuest.update).toHaveBeenCalledWith(expect.objectContaining({
        status: 'ready_for_reward'
      }));
    });

    it('throws 404 when player quest not found', async () => {
      PlayerQuest.findOne.mockResolvedValue(null);

      await expect(QuestProgressService.submitQuest(characterId, 100)).rejects.toMatchObject({
        message: 'Player quest not found',
        statusCode: 404
      });
    });

    it('throws 404 when player quest belongs to different character', async () => {
      const playerQuest = {
        player_quest_id: 100,
        character_id: 999,
        status: 'in_progress',
        progress_json: { obj1: 5 },
        Quest: {
          quest_id: 10,
          objectives_json: [
            { objective_id: 'obj1', type: 'kill', target_id: 101, required_amount: 5 }
          ]
        }
      };
      PlayerQuest.findOne.mockResolvedValue(playerQuest);

      await expect(QuestProgressService.submitQuest(characterId, 100)).rejects.toMatchObject({
        message: 'Player quest not found',
        statusCode: 404
      });
    });

    it('throws 409 when quest not in submittable state', async () => {
      const playerQuest = {
        player_quest_id: 100,
        character_id: characterId,
        status: 'ready_for_reward',
        progress_json: { obj1: 5 },
        Quest: {
          quest_id: 10,
          objectives_json: [
            { objective_id: 'obj1', type: 'kill', target_id: 101, required_amount: 5 }
          ]
        }
      };
      PlayerQuest.findOne.mockResolvedValue(playerQuest);

      await expect(QuestProgressService.submitQuest(characterId, 100)).rejects.toMatchObject({
        message: 'Quest is not in a submittable state',
        statusCode: 409
      });
    });

    it('throws 400 when progress is not 100%', async () => {
      const playerQuest = {
        player_quest_id: 100,
        character_id: characterId,
        status: 'in_progress',
        progress_json: { obj1: 3 },
        Quest: {
          quest_id: 10,
          objectives_json: [
            { objective_id: 'obj1', type: 'kill', target_id: 101, required_amount: 5 }
          ]
        }
      };
      PlayerQuest.findOne.mockResolvedValue(playerQuest);
      computeOverallProgressPercent.mockReturnValue(60);

      await expect(QuestProgressService.submitQuest(characterId, 100)).rejects.toMatchObject({
        message: 'Quest progress is not 100%',
        statusCode: 400
      });
    });

    it('allows submission from accepted status', async () => {
      const playerQuest = {
        player_quest_id: 100,
        character_id: characterId,
        status: 'accepted',
        progress_json: { obj1: 5 },
        Quest: {
          quest_id: 10,
          objectives_json: [
            { objective_id: 'obj1', type: 'kill', target_id: 101, required_amount: 5 }
          ]
        },
        update: jest.fn()
      };
      PlayerQuest.findOne.mockResolvedValue(playerQuest);
      computeOverallProgressPercent.mockReturnValue(100);

      const result = await QuestProgressService.submitQuest(characterId, 100);

      expect(result.success).toBe(true);
    });
  });
});
