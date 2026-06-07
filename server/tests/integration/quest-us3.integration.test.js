const request = require('supertest');
const { app } = require('../../src/index');
const { Character, Quest, PlayerQuest, ItemDefinition, PlayerItem, sequelize } = require('../../src/models');
const CharacterService = require('../../src/services/CharacterService');

describe('Quest US3 Integration Tests', () => {
  let character;
  let expQuest;
  let goldQuest;
  let itemQuest;
  let mixedQuest;
  let itemDef;

  beforeEach(async () => {
    await sequelize.sync({ force: true });

    character = await Character.create({
      name: 'TestHero',
      character_type: 'player',
      map_id: 1,
      x: 0,
      y: 0,
      level: 5,
      exp: 100,
      gold: 50
    });

    itemDef = await ItemDefinition.create({
      name: 'Reward Potion',
      item_type: 'consumable',
      rarity: 'common',
      icon: 'potion_icon',
      max_stack: 99,
      is_bind_on_pickup: false
    });

    expQuest = await Quest.create({
      name: 'Exp Quest',
      description: 'Gives exp.',
      quest_type: 'side',
      level_min: 1,
      level_max: null,
      trigger_conditions_json: [{ trigger_type: 'auto', target_id: null, target_name: 'Auto' }],
      prerequisites_json: [],
      objectives_json: [
        { objective_id: 'obj_1', type: 'kill', target_id: 1, target_name: 'Goblin', required_amount: 1, description: 'Kill 1 Goblin' }
      ],
      rewards_json: [
        { reward_id: 'r1', type: 'exp', value: 100 }
      ],
      max_concurrent_limit: 1,
      is_active: true
    });

    goldQuest = await Quest.create({
      name: 'Gold Quest',
      description: 'Gives gold.',
      quest_type: 'side',
      level_min: 1,
      level_max: null,
      trigger_conditions_json: [{ trigger_type: 'auto', target_id: null, target_name: 'Auto' }],
      prerequisites_json: [],
      objectives_json: [
        { objective_id: 'obj_1', type: 'collect', target_id: 10, target_name: 'Herb', required_amount: 1, description: 'Collect 1 Herb' }
      ],
      rewards_json: [
        { reward_id: 'r1', type: 'gold', value: 50 }
      ],
      max_concurrent_limit: 1,
      is_active: true
    });

    itemQuest = await Quest.create({
      name: 'Item Quest',
      description: 'Gives item.',
      quest_type: 'side',
      level_min: 1,
      level_max: null,
      trigger_conditions_json: [{ trigger_type: 'auto', target_id: null, target_name: 'Auto' }],
      prerequisites_json: [],
      objectives_json: [
        { objective_id: 'obj_1', type: 'collect', target_id: 20, target_name: 'Gem', required_amount: 1, description: 'Collect 1 Gem' }
      ],
      rewards_json: [
        { reward_id: 'r1', type: 'item', item_definition_id: itemDef.item_definition_id, value: 3, name: 'Reward Potion' }
      ],
      max_concurrent_limit: 1,
      is_active: true
    });

    mixedQuest = await Quest.create({
      name: 'Mixed Quest',
      description: 'Gives exp, gold, and items.',
      quest_type: 'main',
      level_min: 1,
      level_max: null,
      trigger_conditions_json: [{ trigger_type: 'auto', target_id: null, target_name: 'Auto' }],
      prerequisites_json: [],
      objectives_json: [
        { objective_id: 'obj_1', type: 'kill', target_id: 2, target_name: 'Dragon', required_amount: 1, description: 'Kill 1 Dragon' }
      ],
      rewards_json: [
        { reward_id: 'r1', type: 'exp', value: 200 },
        { reward_id: 'r2', type: 'gold', value: 100 },
        { reward_id: 'r3', type: 'item', item_definition_id: itemDef.item_definition_id, value: 2, name: 'Reward Potion' }
      ],
      max_concurrent_limit: 1,
      is_active: true
    });
  });

  afterEach(async () => {
    await PlayerQuest.destroy({ where: {}, force: true });
    await PlayerItem.destroy({ where: {}, force: true });
    await Quest.destroy({ where: {}, force: true });
    await ItemDefinition.destroy({ where: {}, force: true });
    await Character.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    CharacterService.stopPositionBroadcast();
    await sequelize.close();
  });

  describe('POST /api/quests/:playerQuestId/claim', () => {
    it('claims exp reward successfully', async () => {
      const pq = await PlayerQuest.create({
        character_id: character.character_id,
        quest_id: expQuest.quest_id,
        status: 'ready_for_reward',
        progress_json: { obj_1: 1 },
        accepted_at: new Date(),
        completed_at: new Date()
      });

      const res = await request(app)
        .post(`/api/quests/${pq.player_quest_id}/claim`)
        .send({ character_id: character.character_id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.player_quest_id).toBe(pq.player_quest_id);
      expect(res.body.status).toBe('completed');
      expect(res.body.claimed_at).toBeDefined();
      expect(res.body.rewards.exp).toBe(100);
      expect(res.body.rewards.gold).toBe(0);
      expect(res.body.rewards.items).toEqual([]);
      expect(res.body.character.exp).toBe(200);
      expect(res.body.character.gold).toBe(50);
      expect(res.body.character.level).toBe(5);

      const updated = await PlayerQuest.findByPk(pq.player_quest_id);
      expect(updated.status).toBe('completed');
      expect(updated.claimed_at).not.toBeNull();
    });

    it('claims gold reward successfully', async () => {
      const pq = await PlayerQuest.create({
        character_id: character.character_id,
        quest_id: goldQuest.quest_id,
        status: 'ready_for_reward',
        progress_json: { obj_1: 1 },
        accepted_at: new Date(),
        completed_at: new Date()
      });

      const res = await request(app)
        .post(`/api/quests/${pq.player_quest_id}/claim`)
        .send({ character_id: character.character_id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.rewards.gold).toBe(50);
      expect(res.body.character.gold).toBe(100);
    });

    it('claims item reward successfully', async () => {
      const pq = await PlayerQuest.create({
        character_id: character.character_id,
        quest_id: itemQuest.quest_id,
        status: 'ready_for_reward',
        progress_json: { obj_1: 1 },
        accepted_at: new Date(),
        completed_at: new Date()
      });

      const res = await request(app)
        .post(`/api/quests/${pq.player_quest_id}/claim`)
        .send({ character_id: character.character_id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.rewards.items.length).toBe(1);
      expect(res.body.rewards.items[0].item_definition_id).toBe(itemDef.item_definition_id);
      expect(res.body.rewards.items[0].quantity).toBe(3);
      expect(res.body.rewards.items[0].name).toBe('Reward Potion');
      expect(res.body.rewards.items[0].player_item_id).toBeDefined();

      const inventory = await PlayerItem.findAll({
        where: { character_id: character.character_id, item_definition_id: itemDef.item_definition_id }
      });
      expect(inventory.length).toBeGreaterThanOrEqual(1);
      const totalQuantity = inventory.reduce((sum, row) => sum + row.quantity, 0);
      expect(totalQuantity).toBe(3);
    });

    it('claims mixed rewards (exp + gold + items) successfully', async () => {
      const pq = await PlayerQuest.create({
        character_id: character.character_id,
        quest_id: mixedQuest.quest_id,
        status: 'ready_for_reward',
        progress_json: { obj_1: 1 },
        accepted_at: new Date(),
        completed_at: new Date()
      });

      const res = await request(app)
        .post(`/api/quests/${pq.player_quest_id}/claim`)
        .send({ character_id: character.character_id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.rewards.exp).toBe(200);
      expect(res.body.rewards.gold).toBe(100);
      expect(res.body.rewards.items.length).toBe(1);
      expect(res.body.character.exp).toBe(300);
      expect(res.body.character.gold).toBe(150);
    });

    it('claims quest with no item rewards', async () => {
      const pq = await PlayerQuest.create({
        character_id: character.character_id,
        quest_id: expQuest.quest_id,
        status: 'ready_for_reward',
        progress_json: { obj_1: 1 },
        accepted_at: new Date(),
        completed_at: new Date()
      });

      const res = await request(app)
        .post(`/api/quests/${pq.player_quest_id}/claim`)
        .send({ character_id: character.character_id });

      expect(res.status).toBe(200);
      expect(res.body.rewards.items).toEqual([]);
    });

    it('returns 400 when quest is not ready_for_reward', async () => {
      const pq = await PlayerQuest.create({
        character_id: character.character_id,
        quest_id: expQuest.quest_id,
        status: 'in_progress',
        progress_json: { obj_1: 1 },
        accepted_at: new Date()
      });

      const res = await request(app)
        .post(`/api/quests/${pq.player_quest_id}/claim`)
        .send({ character_id: character.character_id });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not ready for reward/i);
    });

    it('returns 409 when rewards already claimed', async () => {
      const pq = await PlayerQuest.create({
        character_id: character.character_id,
        quest_id: expQuest.quest_id,
        status: 'completed',
        progress_json: { obj_1: 1 },
        accepted_at: new Date(),
        completed_at: new Date(),
        claimed_at: new Date()
      });

      const res = await request(app)
        .post(`/api/quests/${pq.player_quest_id}/claim`)
        .send({ character_id: character.character_id });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already claimed/i);
    });

    it('returns 404 when player quest not found', async () => {
      const res = await request(app)
        .post('/api/quests/99999/claim')
        .send({ character_id: character.character_id });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });

    it('returns 404 when player quest belongs to another character', async () => {
      const otherCharacter = await Character.create({
        name: 'OtherHero',
        character_type: 'player',
        map_id: 1,
        x: 0,
        y: 0,
        level: 5
      });

      const pq = await PlayerQuest.create({
        character_id: otherCharacter.character_id,
        quest_id: expQuest.quest_id,
        status: 'ready_for_reward',
        progress_json: { obj_1: 1 },
        accepted_at: new Date(),
        completed_at: new Date()
      });

      const res = await request(app)
        .post(`/api/quests/${pq.player_quest_id}/claim`)
        .send({ character_id: character.character_id });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });

    it('returns 400 and rolls back when inventory is full', async () => {
      // Fill all 200 inventory slots to max stack (99) so no space remains
      for (let i = 0; i < 200; i++) {
        await PlayerItem.create({
          character_id: character.character_id,
          item_definition_id: itemDef.item_definition_id,
          quantity: 99,
          is_bound: false,
          acquired_at: new Date()
        });
      }

      const pq = await PlayerQuest.create({
        character_id: character.character_id,
        quest_id: itemQuest.quest_id,
        status: 'ready_for_reward',
        progress_json: { obj_1: 1 },
        accepted_at: new Date(),
        completed_at: new Date()
      });

      const res = await request(app)
        .post(`/api/quests/${pq.player_quest_id}/claim`)
        .send({ character_id: character.character_id });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/inventory full/i);

      // Verify rollback: quest stays ready_for_reward, character unchanged
      const updatedQuest = await PlayerQuest.findByPk(pq.player_quest_id);
      expect(updatedQuest.status).toBe('ready_for_reward');
      expect(updatedQuest.claimed_at).toBeNull();

      const updatedCharacter = await Character.findByPk(character.character_id);
      expect(updatedCharacter.exp).toBe(100);
      expect(updatedCharacter.gold).toBe(50);
    });

    it('returns 400 when character_id is missing', async () => {
      const res = await request(app)
        .post('/api/quests/1/claim')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/character_id is required/i);
    });
  });
});
