const request = require('supertest');
const { app } = require('../../src/index');
const { Character, Quest, PlayerQuest, sequelize } = require('../../src/models');
const CharacterService = require('../../src/services/CharacterService');

describe('Quest US4 Integration Tests', () => {
  let character;

  const validQuestPayload = {
    name: 'Admin Test Quest',
    description: 'A quest created by admin.',
    quest_type: 'main',
    level_min: 1,
    level_max: null,
    trigger_conditions_json: [{ trigger_type: 'auto', target_id: null, target_name: 'Auto' }],
    prerequisites_json: [],
    objectives_json: [
      { objective_id: 'obj_1', type: 'talk', target_id: 101, target_name: 'Elder', required_amount: 1, description: 'Talk to Elder' }
    ],
    rewards_json: [{ reward_id: 'r1', type: 'exp', value: 100 }],
    max_concurrent_limit: 1,
    is_active: true
  };

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
  });

  afterEach(async () => {
    await PlayerQuest.destroy({ where: {}, force: true });
    await Quest.destroy({ where: {}, force: true });
    await Character.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    CharacterService.stopPositionBroadcast();
    await sequelize.close();
  });

  describe('GET /api/admin/quests', () => {
    it('returns paginated quest configs', async () => {
      await Quest.bulkCreate([
        { ...validQuestPayload, name: 'Quest A' },
        { ...validQuestPayload, name: 'Quest B', quest_type: 'side' },
        { ...validQuestPayload, name: 'Quest C', is_active: false }
      ]);

      const res = await request(app)
        .get('/api/admin/quests')
        .query({ page: 1, page_size: 2 });

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(3);
      expect(res.body.quests).toHaveLength(2);
      expect(res.body.page).toBe(1);
      expect(res.body.page_size).toBe(2);
    });

    it('filters by quest_type', async () => {
      await Quest.bulkCreate([
        { ...validQuestPayload, name: 'Quest A' },
        { ...validQuestPayload, name: 'Quest B', quest_type: 'side' }
      ]);

      const res = await request(app)
        .get('/api/admin/quests')
        .query({ quest_type: 'side' });

      expect(res.status).toBe(200);
      expect(res.body.quests).toHaveLength(1);
      expect(res.body.quests[0].name).toBe('Quest B');
    });

    it('filters by is_active', async () => {
      await Quest.bulkCreate([
        { ...validQuestPayload, name: 'Quest A' },
        { ...validQuestPayload, name: 'Quest B', is_active: false }
      ]);

      const res = await request(app)
        .get('/api/admin/quests')
        .query({ is_active: 'false' });

      expect(res.status).toBe(200);
      expect(res.body.quests).toHaveLength(1);
      expect(res.body.quests[0].name).toBe('Quest B');
    });

    it('filters by search term', async () => {
      await Quest.bulkCreate([
        { ...validQuestPayload, name: 'Dragon Slayer' },
        { ...validQuestPayload, name: 'Herb Collector' }
      ]);

      const res = await request(app)
        .get('/api/admin/quests')
        .query({ search: 'dragon' });

      expect(res.status).toBe(200);
      expect(res.body.quests).toHaveLength(1);
      expect(res.body.quests[0].name).toBe('Dragon Slayer');
    });

    it('includes player_count for each quest', async () => {
      const quest = await Quest.create({ ...validQuestPayload, name: 'Quest A' });
      await PlayerQuest.create({
        character_id: character.character_id,
        quest_id: quest.quest_id,
        status: 'accepted',
        progress_json: {},
        accepted_at: new Date()
      });

      const res = await request(app)
        .get('/api/admin/quests');

      expect(res.status).toBe(200);
      expect(res.body.quests[0].player_count).toBe(1);
    });
  });

  describe('GET /api/admin/quests/:questId', () => {
    it('returns single quest detail with player_count', async () => {
      const quest = await Quest.create({ ...validQuestPayload, name: 'Quest A' });
      await PlayerQuest.create({
        character_id: character.character_id,
        quest_id: quest.quest_id,
        status: 'accepted',
        progress_json: {},
        accepted_at: new Date()
      });

      const res = await request(app)
        .get(`/api/admin/quests/${quest.quest_id}`);

      expect(res.status).toBe(200);
      expect(res.body.quest_id).toBe(quest.quest_id);
      expect(res.body.name).toBe('Quest A');
      expect(res.body.player_count).toBe(1);
    });

    it('returns 404 when quest not found', async () => {
      const res = await request(app)
        .get('/api/admin/quests/99999');

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });
  });

  describe('POST /api/admin/quests', () => {
    it('creates a new quest', async () => {
      const res = await request(app)
        .post('/api/admin/quests')
        .send(validQuestPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.quest_id).toBeDefined();
      expect(res.body.message).toMatch(/created/i);
    });

    it('returns 400 when name is missing', async () => {
      const res = await request(app)
        .post('/api/admin/quests')
        .send({ ...validQuestPayload, name: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/name is required/i);
    });

    it('returns 400 when name exceeds 100 chars', async () => {
      const res = await request(app)
        .post('/api/admin/quests')
        .send({ ...validQuestPayload, name: 'A'.repeat(101) });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/name must not exceed 100 characters/i);
    });

    it('returns 400 when quest_type is invalid', async () => {
      const res = await request(app)
        .post('/api/admin/quests')
        .send({ ...validQuestPayload, quest_type: 'invalid' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/quest_type must be one of/i);
    });

    it('returns 400 when level_min is less than 1', async () => {
      const res = await request(app)
        .post('/api/admin/quests')
        .send({ ...validQuestPayload, level_min: 0 });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/level_min must be at least 1/i);
    });

    it('returns 400 when level_max is less than level_min', async () => {
      const res = await request(app)
        .post('/api/admin/quests')
        .send({ ...validQuestPayload, level_min: 5, level_max: 3 });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/level_max must be greater than or equal to level_min/i);
    });

    it('returns 400 when objectives_json is empty', async () => {
      const res = await request(app)
        .post('/api/admin/quests')
        .send({ ...validQuestPayload, objectives_json: [] });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/objectives_json must be a non-empty array/i);
    });

    it('returns 400 when rewards_json is not an array', async () => {
      const res = await request(app)
        .post('/api/admin/quests')
        .send({ ...validQuestPayload, rewards_json: 'not-array' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/rewards_json must be an array/i);
    });

    it('returns 400 when max_concurrent_limit is less than 1', async () => {
      const res = await request(app)
        .post('/api/admin/quests')
        .send({ ...validQuestPayload, max_concurrent_limit: 0 });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/max_concurrent_limit must be at least 1/i);
    });

    it('returns 409 when name already exists', async () => {
      await Quest.create({ ...validQuestPayload, name: 'Duplicate Quest' });

      const res = await request(app)
        .post('/api/admin/quests')
        .send({ ...validQuestPayload, name: 'Duplicate Quest' });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already exists/i);
    });
  });

  describe('PUT /api/admin/quests/:questId', () => {
    it('updates a quest', async () => {
      const quest = await Quest.create({ ...validQuestPayload, name: 'Old Name' });

      const res = await request(app)
        .put(`/api/admin/quests/${quest.quest_id}`)
        .send({ name: 'New Name' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.quest_id).toBe(quest.quest_id);
      expect(res.body.message).toMatch(/updated/i);
    });

    it('returns 404 when quest not found', async () => {
      const res = await request(app)
        .put('/api/admin/quests/99999')
        .send({ name: 'New Name' });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });

    it('returns 409 when name conflicts', async () => {
      await Quest.create({ ...validQuestPayload, name: 'Existing Quest' });
      const quest = await Quest.create({ ...validQuestPayload, name: 'Another Quest' });

      const res = await request(app)
        .put(`/api/admin/quests/${quest.quest_id}`)
        .send({ name: 'Existing Quest' });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already exists/i);
    });

    it('returns 400 on invalid data', async () => {
      const quest = await Quest.create({ ...validQuestPayload, name: 'Quest A' });

      const res = await request(app)
        .put(`/api/admin/quests/${quest.quest_id}`)
        .send({ level_min: 0 });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/level_min must be at least 1/i);
    });
  });

  describe('DELETE /api/admin/quests/:questId', () => {
    it('deletes a quest with no player records', async () => {
      const quest = await Quest.create({ ...validQuestPayload, name: 'Deletable Quest' });

      const res = await request(app)
        .delete(`/api/admin/quests/${quest.quest_id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/deleted/i);
    });

    it('returns 400 when quest has player records', async () => {
      const quest = await Quest.create({ ...validQuestPayload, name: 'Active Quest' });
      await PlayerQuest.create({
        character_id: character.character_id,
        quest_id: quest.quest_id,
        status: 'accepted',
        progress_json: {},
        accepted_at: new Date()
      });

      const res = await request(app)
        .delete(`/api/admin/quests/${quest.quest_id}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/cannot delete quest with existing player records/i);
    });

    it('returns 404 when quest not found', async () => {
      const res = await request(app)
        .delete('/api/admin/quests/99999');

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });
  });

  describe('POST /api/admin/quests/:questId/toggle', () => {
    it('toggles quest is_active from true to false', async () => {
      const quest = await Quest.create({ ...validQuestPayload, name: 'Toggle Quest', is_active: true });

      const res = await request(app)
        .post(`/api/admin/quests/${quest.quest_id}/toggle`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.quest_id).toBe(quest.quest_id);
      expect(res.body.is_active).toBe(false);
      expect(res.body.message).toMatch(/deactivated/i);
    });

    it('toggles quest is_active from false to true', async () => {
      const quest = await Quest.create({ ...validQuestPayload, name: 'Toggle Quest', is_active: false });

      const res = await request(app)
        .post(`/api/admin/quests/${quest.quest_id}/toggle`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.is_active).toBe(true);
      expect(res.body.message).toMatch(/activated/i);
    });

    it('returns 404 when quest not found', async () => {
      const res = await request(app)
        .post('/api/admin/quests/99999/toggle');

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });
  });
});
