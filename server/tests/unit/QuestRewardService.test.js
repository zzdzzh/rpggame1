const QuestRewardService = require('../../src/services/QuestRewardService');
const InventoryService = require('../../src/services/InventoryService');

jest.mock('../../src/models', () => ({
  PlayerQuest: {
    findOne: jest.fn()
  },
  Character: {
    findByPk: jest.fn()
  },
  Quest: {},
  sequelize: {
    transaction: jest.fn()
  }
}));

jest.mock('../../src/services/InventoryService', () => ({
  addItems: jest.fn()
}));

const { PlayerQuest, Character, sequelize } = require('../../src/models');

describe('QuestRewardService', () => {
  let mockTransaction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction = {
      commit: jest.fn(),
      rollback: jest.fn(),
      finished: false,
      LOCK: { UPDATE: 'UPDATE' }
    };
    sequelize.transaction.mockResolvedValue(mockTransaction);
  });

  describe('claimReward', () => {
    const characterId = 1;
    const playerQuestId = 100;

    it('successfully claims exp and gold rewards', async () => {
      const mockCharacter = {
        character_id: characterId,
        exp: 100,
        gold: 50,
        level: 5,
        save: jest.fn()
      };
      const mockPlayerQuest = {
        player_quest_id: playerQuestId,
        character_id: characterId,
        status: 'ready_for_reward',
        Quest: {
          quest_id: 10,
          rewards_json: [
            { type: 'exp', value: 500 },
            { type: 'gold', value: 100 }
          ]
        },
        update: jest.fn()
      };
      PlayerQuest.findOne.mockResolvedValue(mockPlayerQuest);
      Character.findByPk.mockResolvedValue(mockCharacter);

      const result = await QuestRewardService.claimReward(characterId, playerQuestId);

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.rewards.exp).toBe(500);
      expect(result.rewards.gold).toBe(100);
      expect(mockCharacter.exp).toBe(600);
      expect(mockCharacter.gold).toBe(150);
      expect(mockCharacter.save).toHaveBeenCalledWith({ transaction: mockTransaction });
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it('calls InventoryService.addItems for item rewards', async () => {
      const mockCharacter = {
        character_id: characterId,
        exp: 0,
        gold: 0,
        level: 1,
        save: jest.fn()
      };
      const mockPlayerQuest = {
        player_quest_id: playerQuestId,
        character_id: characterId,
        status: 'ready_for_reward',
        Quest: {
          quest_id: 10,
          rewards_json: [
            { type: 'item', item_definition_id: 20, value: 3, name: 'Health Potion' }
          ]
        },
        update: jest.fn()
      };
      PlayerQuest.findOne.mockResolvedValue(mockPlayerQuest);
      Character.findByPk.mockResolvedValue(mockCharacter);
      InventoryService.addItems.mockResolvedValue({
        success: true,
        added: [{ item_definition_id: 20, quantity: 3, player_item_id: 500 }]
      });

      const result = await QuestRewardService.claimReward(characterId, playerQuestId);

      expect(InventoryService.addItems).toHaveBeenCalledWith(
        characterId,
        [{ item_definition_id: 20, quantity: 3 }],
        mockTransaction
      );
      expect(result.rewards.items).toHaveLength(1);
      expect(result.rewards.items[0].item_definition_id).toBe(20);
      expect(result.rewards.items[0].quantity).toBe(3);
    });

    it('throws 400 and rolls back when inventory is full', async () => {
      const mockCharacter = {
        character_id: characterId,
        exp: 0,
        gold: 0,
        level: 1,
        save: jest.fn()
      };
      const mockPlayerQuest = {
        player_quest_id: playerQuestId,
        character_id: characterId,
        status: 'ready_for_reward',
        Quest: {
          quest_id: 10,
          rewards_json: [
            { type: 'item', item_definition_id: 20, value: 1 }
          ]
        },
        update: jest.fn()
      };
      PlayerQuest.findOne.mockResolvedValue(mockPlayerQuest);
      Character.findByPk.mockResolvedValue(mockCharacter);
      InventoryService.addItems.mockRejectedValue(new Error('Inventory full'));

      await expect(QuestRewardService.claimReward(characterId, playerQuestId)).rejects.toMatchObject({
        message: 'Inventory full',
        statusCode: 400
      });
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    it('throws 404 when player quest not found', async () => {
      PlayerQuest.findOne.mockResolvedValue(null);

      await expect(QuestRewardService.claimReward(characterId, playerQuestId)).rejects.toMatchObject({
        message: 'Player quest not found',
        statusCode: 404
      });
    });

    it('throws 404 when player quest belongs to different character', async () => {
      const mockPlayerQuest = {
        player_quest_id: playerQuestId,
        character_id: 999,
        status: 'ready_for_reward',
        Quest: {
          quest_id: 10,
          rewards_json: []
        }
      };
      PlayerQuest.findOne.mockResolvedValue(mockPlayerQuest);

      await expect(QuestRewardService.claimReward(characterId, playerQuestId)).rejects.toMatchObject({
        message: 'Player quest not found',
        statusCode: 404
      });
    });

    it('throws 409 when rewards already claimed', async () => {
      const mockPlayerQuest = {
        player_quest_id: playerQuestId,
        character_id: characterId,
        status: 'completed',
        Quest: {
          quest_id: 10,
          rewards_json: []
        }
      };
      PlayerQuest.findOne.mockResolvedValue(mockPlayerQuest);

      await expect(QuestRewardService.claimReward(characterId, playerQuestId)).rejects.toMatchObject({
        message: 'Rewards already claimed',
        statusCode: 409
      });
    });

    it('throws 400 when quest is not ready for reward', async () => {
      const mockPlayerQuest = {
        player_quest_id: playerQuestId,
        character_id: characterId,
        status: 'in_progress',
        Quest: {
          quest_id: 10,
          rewards_json: []
        }
      };
      PlayerQuest.findOne.mockResolvedValue(mockPlayerQuest);

      await expect(QuestRewardService.claimReward(characterId, playerQuestId)).rejects.toMatchObject({
        message: 'Quest is not ready for reward',
        statusCode: 400
      });
    });

    it('throws 404 when character not found', async () => {
      const mockPlayerQuest = {
        player_quest_id: playerQuestId,
        character_id: characterId,
        status: 'ready_for_reward',
        Quest: {
          quest_id: 10,
          rewards_json: [{ type: 'exp', value: 100 }]
        }
      };
      PlayerQuest.findOne.mockResolvedValue(mockPlayerQuest);
      Character.findByPk.mockResolvedValue(null);

      await expect(QuestRewardService.claimReward(characterId, playerQuestId)).rejects.toMatchObject({
        message: 'Character not found',
        statusCode: 404
      });
    });

    it('handles multiple item rewards', async () => {
      const mockCharacter = {
        character_id: characterId,
        exp: 0,
        gold: 0,
        level: 1,
        save: jest.fn()
      };
      const mockPlayerQuest = {
        player_quest_id: playerQuestId,
        character_id: characterId,
        status: 'ready_for_reward',
        Quest: {
          quest_id: 10,
          rewards_json: [
            { type: 'item', item_definition_id: 20, value: 2, name: 'Potion' },
            { type: 'item', item_definition_id: 21, value: 1, name: 'Sword' }
          ]
        },
        update: jest.fn()
      };
      PlayerQuest.findOne.mockResolvedValue(mockPlayerQuest);
      Character.findByPk.mockResolvedValue(mockCharacter);
      InventoryService.addItems.mockResolvedValue({
        success: true,
        added: [
          { item_definition_id: 20, quantity: 2, player_item_id: 500 },
          { item_definition_id: 21, quantity: 1, player_item_id: 501 }
        ]
      });

      const result = await QuestRewardService.claimReward(characterId, playerQuestId);

      expect(InventoryService.addItems).toHaveBeenCalledWith(
        characterId,
        [
          { item_definition_id: 20, quantity: 2 },
          { item_definition_id: 21, quantity: 1 }
        ],
        mockTransaction
      );
      expect(result.rewards.items).toHaveLength(2);
    });

    it('updates player quest status to completed', async () => {
      const mockCharacter = {
        character_id: characterId,
        exp: 0,
        gold: 0,
        level: 1,
        save: jest.fn()
      };
      const mockPlayerQuest = {
        player_quest_id: playerQuestId,
        character_id: characterId,
        status: 'ready_for_reward',
        Quest: {
          quest_id: 10,
          rewards_json: [{ type: 'exp', value: 100 }]
        },
        update: jest.fn()
      };
      PlayerQuest.findOne.mockResolvedValue(mockPlayerQuest);
      Character.findByPk.mockResolvedValue(mockCharacter);

      await QuestRewardService.claimReward(characterId, playerQuestId);

      expect(mockPlayerQuest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          claimed_at: expect.any(Date)
        }),
        { transaction: mockTransaction }
      );
    });
  });
});
