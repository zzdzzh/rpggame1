const request = require('supertest');
const { app } = require('../../src/index');
const { Character, Quest, PlayerQuest, ItemDefinition, sequelize } = require('../../src/models');
const CharacterService = require('../../src/services/CharacterService');

describe('Quest US1 Integration Tests', () => {
  let character;
  let npcQuest;
  let levelQuest;
  let prereqQuest;
  let itemDef;

  beforeEach(async () => {
    await sequelize.sync({ force: true });

    character = await Character.create({
      name: 'TestHero',
      character_type: 'player',
      map_id: 1,
      x: 0,
      y: 0,
      level: 5
    });

    itemDef = await ItemDefinition.create({
      name: 'Test Reward Item',
      item_type: 'consumable',
      rarity: 'common',
      icon: 'test_icon',
      max_stack: 99,
      is_bind_on_pickup: false
    });

    npcQuest = await Quest.create({
      name: 'Talk to Elder',
      description: 'Find the elder in the village.',
      quest_type: 'main',
      level_min: 1,
      level_max: 10,
      trigger_conditions_json: [{ trigger_type: 'npc', target_id: 101, target_name: 'Elder' }],
      prerequisites_json: [],
      objectives_json: [
        { objective_id: 'obj_1', type: 'talk', target_id: 101, target_name: 'Elder', required_amount: 1, description: 'Talk to Elder' }
      ],
      rewards_json: [
        { reward_id: 'r1', type: 'exp', value: 100 },
        { reward_id: 'r2', type: 'item', value: 1, item_definition_id: itemDef.item_definition_id }
      ],
      max_concurrent_limit: 1,
      is_active: true
    });

    levelQuest = await Quest.create({
      name: 'High Level Challenge',
      description: 'For high level players only.',
      quest_type: 'side',
      level_min: 10,
      level_max: null,
      trigger_conditions_json: [{ trigger_type: 'auto', target_id: null, target_name: 'Auto' }],
      prerequisites_json: [],
      objectives_json: [
        { objective_id: 'obj_1', type: 'kill', target_id: 1, target_name: 'Dragon', required_amount: 1, description: 'Kill a dragon' }
      ],
      rewards_json: [{ reward_id: 'r1', type: 'gold', value: 500 }],
      max_concurrent_limit: 1,
      is_active: true
    });

    prereqQuest = await Quest.create({
      name: 'After Elder Quest',
      description: 'Requires Talk to Elder completed.',
      quest_type: 'side',
      level_min: 1,
      level_max: null,
      trigger_conditions_json: [{ trigger_type: 'auto', target_id: null, target_name: 'Auto' }],
      prerequisites_json: [npcQuest.quest_id],
      objectives_json: [
        { objective_id: 'obj_1', type: 'collect', target_id: itemDef.item_definition_id, target_name: 'Herb', required_amount: 5, description: 'Collect 5 herbs' }
      ],
      rewards_json: [{ reward_id: 'r1', type: 'exp', value: 50 }],
      max_concurrent_limit: 1,
      is_active: true
    });
  });

  afterEach(async () => {
    await PlayerQuest.destroy({ where: {}, force: true });
    await Quest.destroy({ where: {}, force: true });
    await ItemDefinition.destroy({ where: {}, force: true });
    await Character.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    CharacterService.stopPositionBroadcast();
    await sequelize.close();
  });

  describe('GET /api/quests/available', () => {
    it('returns available quests for character', async () => {
      const res = await request(app)
        .get('/api/quests/available')
        .query({ character_id: character.character_id });

      expect(res.status).toBe(200);
      expect(res.body.character_id).toBe(character.character_id);
      expect(res.body.count).toBeGreaterThanOrEqual(1);
      expect(res.body.quests.some(q => q.quest_id === npcQuest.quest_id)).toBe(true);
    });

    it('filters by trigger_type and target_id', async () => {
      const res = await request(app)
        .get('/api/quests/available')
        .query({
          character_id: character.character_id,
          trigger_type: 'npc',
          target_id: 101
        });

      expect(res.status).toBe(200);
      expect(res.body.quests.length).toBe(1);
      expect(res.body.quests[0].quest_id).toBe(npcQuest.quest_id);
    });

    it('filters by level range', async () => {
      const res = await request(app)
        .get('/api/quests/available')
        .query({
          character_id: character.character_id,
          level: 5
        });

      expect(res.status).toBe(200);
      expect(res.body.quests.some(q => q.quest_id === levelQuest.quest_id)).toBe(false);
    });

    it('filters out already accepted quests', async () => {
      await PlayerQuest.create({
        character_id: character.character_id,
        quest_id: npcQuest.quest_id,
        status: 'accepted',
        progress_json: {},
        accepted_at: new Date()
      });

      const res = await request(app)
        .get('/api/quests/available')
        .query({ character_id: character.character_id });

      expect(res.status).toBe(200);
      expect(res.body.quests.some(q => q.quest_id === npcQuest.quest_id)).toBe(false);
    });

    it('filters out completed quests', async () => {
      await PlayerQuest.create({
        character_id: character.character_id,
        quest_id: npcQuest.quest_id,
        status: 'completed',
        progress_json: {},
        accepted_at: new Date(),
        completed_at: new Date(),
        claimed_at: new Date()
      });

      const res = await request(app)
        .get('/api/quests/available')
        .query({ character_id: character.character_id });

      expect(res.status).toBe(200);
      expect(res.body.quests.some(q => q.quest_id === npcQuest.quest_id)).toBe(false);
    });

    it('filters by prerequisites', async () => {
      const res = await request(app)
        .get('/api/quests/available')
        .query({ character_id: character.character_id });

      expect(res.status).toBe(200);
      expect(res.body.quests.some(q => q.quest_id === prereqQuest.quest_id)).toBe(false);
    });

    it('includes rewards_preview with item names', async () => {
      const res = await request(app)
        .get('/api/quests/available')
        .query({ character_id: character.character_id });

      expect(res.status).toBe(200);
      const quest = res.body.quests.find(q => q.quest_id === npcQuest.quest_id);
      expect(quest).toBeDefined();
      expect(quest.rewards_preview).toBeDefined();
      const itemReward = quest.rewards_preview.find(r => r.type === 'item');
      expect(itemReward).toBeDefined();
      expect(itemReward.item_name).toBe('Test Reward Item');
    });
  });

  describe('POST /api/quests/:questId/accept', () => {
    it('accepts a quest successfully', async () => {
      const res = await request(app)
        .post(`/api/quests/${npcQuest.quest_id}/accept`)
        .send({ character_id: character.character_id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.player_quest_id).toBeDefined();
      expect(res.body.status).toBe('accepted');
      expect(res.body.quest.quest_id).toBe(npcQuest.quest_id);
      expect(res.body.quest.objectives[0].current_progress).toBe(0);
    });

    it('returns 409 when quest already accepted', async () => {
      await request(app)
        .post(`/api/quests/${npcQuest.quest_id}/accept`)
        .send({ character_id: character.character_id });

      const res = await request(app)
        .post(`/api/quests/${npcQuest.quest_id}/accept`)
        .send({ character_id: character.character_id });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already accepted/i);
    });

    it('returns 409 when quest already completed', async () => {
      await PlayerQuest.create({
        character_id: character.character_id,
        quest_id: npcQuest.quest_id,
        status: 'completed',
        progress_json: {},
        accepted_at: new Date(),
        completed_at: new Date(),
        claimed_at: new Date()
      });

      const res = await request(app)
        .post(`/api/quests/${npcQuest.quest_id}/accept`)
        .send({ character_id: character.character_id });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already accepted/i);
    });

    it('returns 400 when level insufficient', async () => {
      const res = await request(app)
        .post(`/api/quests/${levelQuest.quest_id}/accept`)
        .send({ character_id: character.character_id });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/level insufficient/i);
    });

    it('returns 400 when prerequisites not met', async () => {
      const res = await request(app)
        .post(`/api/quests/${prereqQuest.quest_id}/accept`)
        .send({ character_id: character.character_id });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/prerequisites not met/i);
    });

    it('returns 404 when quest not found or inactive', async () => {
      const res = await request(app)
        .post('/api/quests/99999/accept')
        .send({ character_id: character.character_id });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/quest not found/i);
    });

    it('returns 400 when max concurrent quests reached', async () => {
      for (let i = 0; i < 20; i++) {
        const q = await Quest.create({
          name: `Filler Quest ${i}`,
          description: 'Filler',
          quest_type: 'side',
          level_min: 1,
          level_max: null,
          trigger_conditions_json: [{ trigger_type: 'auto', target_id: null, target_name: 'Auto' }],
          prerequisites_json: [],
          objectives_json: [{ objective_id: 'obj_1', type: 'talk', target_id: 1, target_name: 'NPC', required_amount: 1, description: 'Talk' }],
          rewards_json: [],
          max_concurrent_limit: 10,
          is_active: true
        });
        await PlayerQuest.create({
          character_id: character.character_id,
          quest_id: q.quest_id,
          status: 'accepted',
          progress_json: {},
          accepted_at: new Date()
        });
      }

      const res = await request(app)
        .post(`/api/quests/${npcQuest.quest_id}/accept`)
        .send({ character_id: character.character_id });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/max concurrent/i);
    });
  });

  describe('GET /api/quests/my', () => {
    it('returns my quests with progress', async () => {
      await PlayerQuest.create({
        character_id: character.character_id,
        quest_id: npcQuest.quest_id,
        status: 'in_progress',
        progress_json: { obj_1: 1 },
        accepted_at: new Date()
      });

      const res = await request(app)
        .get('/api/quests/my')
        .query({ character_id: character.character_id });

      expect(res.status).toBe(200);
      expect(res.body.character_id).toBe(character.character_id);
      expect(res.body.count).toBe(1);
      expect(res.body.quests[0].quest_id).toBe(npcQuest.quest_id);
      expect(res.body.quests[0].overall_progress_percent).toBe(100);
      expect(res.body.quests[0].progress.obj_1.is_completed).toBe(true);
    });

    it('filters by status', async () => {
      await PlayerQuest.create({
        character_id: character.character_id,
        quest_id: npcQuest.quest_id,
        status: 'accepted',
        progress_json: {},
        accepted_at: new Date()
      });

      const res = await request(app)
        .get('/api/quests/my')
        .query({ character_id: character.character_id, status: 'completed' });

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
    });

    it('filters by quest_type', async () => {
      await PlayerQuest.create({
        character_id: character.character_id,
        quest_id: npcQuest.quest_id,
        status: 'accepted',
        progress_json: {},
        accepted_at: new Date()
      });

      const res = await request(app)
        .get('/api/quests/my')
        .query({ character_id: character.character_id, quest_type: 'side' });

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
    });
  });
});
