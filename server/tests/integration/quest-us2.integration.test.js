const request = require('supertest');
const { app } = require('../../src/index');
const { Character, Quest, PlayerQuest, sequelize } = require('../../src/models');
const QuestProgressService = require('../../src/services/QuestProgressService');
const CharacterService = require('../../src/services/CharacterService');

describe('Quest US2 Integration Tests', () => {
  let character;
  let killQuest;
  let collectQuest;
  let multiObjectiveQuest;

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

    killQuest = await Quest.create({
      name: 'Kill 3 Goblins',
      description: 'Defeat 3 goblins.',
      quest_type: 'side',
      level_min: 1,
      level_max: null,
      trigger_conditions_json: [{ trigger_type: 'auto', target_id: null, target_name: 'Auto' }],
      prerequisites_json: [],
      objectives_json: [
        { objective_id: 'obj_1', type: 'kill', target_id: 1, target_name: 'Goblin', required_amount: 3, description: 'Kill 3 Goblins' }
      ],
      rewards_json: [{ reward_id: 'r1', type: 'exp', value: 100 }],
      max_concurrent_limit: 1,
      is_active: true
    });

    collectQuest = await Quest.create({
      name: 'Collect 5 Herbs',
      description: 'Gather 5 herbs.',
      quest_type: 'side',
      level_min: 1,
      level_max: null,
      trigger_conditions_json: [{ trigger_type: 'auto', target_id: null, target_name: 'Auto' }],
      prerequisites_json: [],
      objectives_json: [
        { objective_id: 'obj_1', type: 'collect', target_id: 10, target_name: 'Herb', required_amount: 5, description: 'Collect 5 Herbs' }
      ],
      rewards_json: [{ reward_id: 'r1', type: 'gold', value: 50 }],
      max_concurrent_limit: 1,
      is_active: true
    });

    multiObjectiveQuest = await Quest.create({
      name: 'Kill and Collect',
      description: 'Kill a wolf and collect 2 furs.',
      quest_type: 'main',
      level_min: 1,
      level_max: null,
      trigger_conditions_json: [{ trigger_type: 'auto', target_id: null, target_name: 'Auto' }],
      prerequisites_json: [],
      objectives_json: [
        { objective_id: 'obj_1', type: 'kill', target_id: 2, target_name: 'Wolf', required_amount: 1, description: 'Kill 1 Wolf' },
        { objective_id: 'obj_2', type: 'collect', target_id: 20, target_name: 'Fur', required_amount: 2, description: 'Collect 2 Furs' }
      ],
      rewards_json: [{ reward_id: 'r1', type: 'exp', value: 200 }],
      max_concurrent_limit: 1,
      is_active: true
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

  describe('QuestProgressService.updateProgress', () => {
    it('updates kill progress incrementally', async () => {
      const pq = await PlayerQuest.create({
        character_id: character.character_id,
        quest_id: killQuest.quest_id,
        status: 'accepted',
        progress_json: { obj_1: 0 },
        accepted_at: new Date()
      });

      const results = await QuestProgressService.updateProgress(character.character_id, 'kill', { target_id: 1, amount: 1 });

      expect(results.length).toBe(1);
      expect(results[0].player_quest_id).toBe(pq.player_quest_id);
      expect(results[0].progress.obj_1).toBe(1);
      expect(results[0].overall_progress_percent).toBe(33);

      const updated = await PlayerQuest.findByPk(pq.player_quest_id);
      expect(updated.status).toBe('in_progress');
      expect(updated.progress_json.obj_1).toBe(1);
    });

    it('updates collect progress incrementally', async () => {
      const pq = await PlayerQuest.create({
        character_id: character.character_id,
        quest_id: collectQuest.quest_id,
        status: 'in_progress',
        progress_json: { obj_1: 2 },
        accepted_at: new Date()
      });

      const results = await QuestProgressService.updateProgress(character.character_id, 'collect', { target_id: 10, amount: 2 });

      expect(results.length).toBe(1);
      expect(results[0].progress.obj_1).toBe(4);
      expect(results[0].overall_progress_percent).toBe(80);

      const updated = await PlayerQuest.findByPk(pq.player_quest_id);
      expect(updated.progress_json.obj_1).toBe(4);
    });

    it('changes status to ready_for_reward when progress reaches 100%', async () => {
      const pq = await PlayerQuest.create({
        character_id: character.character_id,
        quest_id: killQuest.quest_id,
        status: 'in_progress',
        progress_json: { obj_1: 2 },
        accepted_at: new Date()
      });

      const results = await QuestProgressService.updateProgress(character.character_id, 'kill', { target_id: 1, amount: 1 });

      expect(results.length).toBe(1);
      expect(results[0].overall_progress_percent).toBe(100);
      expect(results[0].status).toBe('ready_for_reward');

      const updated = await PlayerQuest.findByPk(pq.player_quest_id);
      expect(updated.status).toBe('ready_for_reward');
      expect(updated.completed_at).not.toBeNull();
    });

    it('does not update quests with non-matching target_id', async () => {
      await PlayerQuest.create({
        character_id: character.character_id,
        quest_id: killQuest.quest_id,
        status: 'accepted',
        progress_json: { obj_1: 0 },
        accepted_at: new Date()
      });

      const results = await QuestProgressService.updateProgress(character.character_id, 'kill', { target_id: 999, amount: 1 });

      expect(results.length).toBe(0);
    });

    it('does not update quests with non-matching eventType', async () => {
      await PlayerQuest.create({
        character_id: character.character_id,
        quest_id: killQuest.quest_id,
        status: 'accepted',
        progress_json: { obj_1: 0 },
        accepted_at: new Date()
      });

      const results = await QuestProgressService.updateProgress(character.character_id, 'talk', { target_id: 1, amount: 1 });

      expect(results.length).toBe(0);
    });

    it('handles multiple objectives and only completes when all are done', async () => {
      const pq = await PlayerQuest.create({
        character_id: character.character_id,
        quest_id: multiObjectiveQuest.quest_id,
        status: 'in_progress',
        progress_json: { obj_1: 0, obj_2: 1 },
        accepted_at: new Date()
      });

      const results1 = await QuestProgressService.updateProgress(character.character_id, 'collect', { target_id: 20, amount: 1 });

      expect(results1.length).toBe(1);
      expect(results1[0].progress.obj_2).toBe(2);
      expect(results1[0].overall_progress_percent).toBe(67);
      expect(results1[0].status).toBe('in_progress');

      const results2 = await QuestProgressService.updateProgress(character.character_id, 'kill', { target_id: 2, amount: 1 });

      expect(results2.length).toBe(1);
      expect(results2[0].progress.obj_1).toBe(1);
      expect(results2[0].overall_progress_percent).toBe(100);
      expect(results2[0].status).toBe('ready_for_reward');

      const updated = await PlayerQuest.findByPk(pq.player_quest_id);
      expect(updated.status).toBe('ready_for_reward');
    });

    it('does not exceed required_amount', async () => {
      const pq = await PlayerQuest.create({
        character_id: character.character_id,
        quest_id: killQuest.quest_id,
        status: 'in_progress',
        progress_json: { obj_1: 2 },
        accepted_at: new Date()
      });

      const results = await QuestProgressService.updateProgress(character.character_id, 'kill', { target_id: 1, amount: 5 });

      expect(results[0].progress.obj_1).toBe(3);
      expect(results[0].overall_progress_percent).toBe(100);

      const updated = await PlayerQuest.findByPk(pq.player_quest_id);
      expect(updated.progress_json.obj_1).toBe(3);
    });
  });

  describe('POST /api/quests/:playerQuestId/submit', () => {
    it('submits quest successfully when all objectives complete', async () => {
      const pq = await PlayerQuest.create({
        character_id: character.character_id,
        quest_id: killQuest.quest_id,
        status: 'in_progress',
        progress_json: { obj_1: 3 },
        accepted_at: new Date()
      });

      const res = await request(app)
        .post(`/api/quests/${pq.player_quest_id}/submit`)
        .send({ character_id: character.character_id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.player_quest_id).toBe(pq.player_quest_id);
      expect(res.body.status).toBe('ready_for_reward');
      expect(res.body.completed_at).toBeDefined();
      expect(res.body.message).toMatch(/submitted successfully/i);
    });

    it('returns 400 when progress is not 100%', async () => {
      const pq = await PlayerQuest.create({
        character_id: character.character_id,
        quest_id: killQuest.quest_id,
        status: 'in_progress',
        progress_json: { obj_1: 1 },
        accepted_at: new Date()
      });

      const res = await request(app)
        .post(`/api/quests/${pq.player_quest_id}/submit`)
        .send({ character_id: character.character_id });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/progress is not 100%/i);
    });

    it('returns 404 when player quest not found', async () => {
      const res = await request(app)
        .post('/api/quests/99999/submit')
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
        quest_id: killQuest.quest_id,
        status: 'in_progress',
        progress_json: { obj_1: 3 },
        accepted_at: new Date()
      });

      const res = await request(app)
        .post(`/api/quests/${pq.player_quest_id}/submit`)
        .send({ character_id: character.character_id });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });

    it('returns 409 when quest already ready_for_reward', async () => {
      const pq = await PlayerQuest.create({
        character_id: character.character_id,
        quest_id: killQuest.quest_id,
        status: 'ready_for_reward',
        progress_json: { obj_1: 3 },
        accepted_at: new Date(),
        completed_at: new Date()
      });

      const res = await request(app)
        .post(`/api/quests/${pq.player_quest_id}/submit`)
        .send({ character_id: character.character_id });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/not in a submittable state/i);
    });

    it('returns 409 when quest already completed', async () => {
      const pq = await PlayerQuest.create({
        character_id: character.character_id,
        quest_id: killQuest.quest_id,
        status: 'completed',
        progress_json: { obj_1: 3 },
        accepted_at: new Date(),
        completed_at: new Date(),
        claimed_at: new Date()
      });

      const res = await request(app)
        .post(`/api/quests/${pq.player_quest_id}/submit`)
        .send({ character_id: character.character_id });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/not in a submittable state/i);
    });

    it('returns 400 when character_id is missing', async () => {
      const res = await request(app)
        .post('/api/quests/1/submit')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/character_id is required/i);
    });
  });

  describe('Socket.io emissions', () => {
    let mockIo;
    let emittedEvents;

    beforeEach(() => {
      emittedEvents = [];
      mockIo = {
        to: jest.fn((room) => ({
          emit: jest.fn((event, payload) => {
            emittedEvents.push({ room, event, payload });
          })
        }))
      };
      QuestProgressService.setIo(mockIo);
    });

    afterEach(() => {
      QuestProgressService.setIo(null);
    });

    it('emits questUpdate on progress change', async () => {
      await PlayerQuest.create({
        character_id: character.character_id,
        quest_id: killQuest.quest_id,
        status: 'accepted',
        progress_json: { obj_1: 0 },
        accepted_at: new Date()
      });

      await QuestProgressService.updateProgress(character.character_id, 'kill', { target_id: 1, amount: 1 });

      const questUpdateEvents = emittedEvents.filter(e => e.event === 'questUpdate');
      expect(questUpdateEvents.length).toBe(1);
      expect(questUpdateEvents[0].room).toBe(`character:${character.character_id}`);
      expect(questUpdateEvents[0].payload.player_quest_id).toBeDefined();
      expect(questUpdateEvents[0].payload.quest_id).toBe(killQuest.quest_id);
      expect(questUpdateEvents[0].payload.status).toBe('in_progress');
      expect(questUpdateEvents[0].payload.overall_progress_percent).toBe(33);
    });

    it('emits questReadyForReward when all objectives complete', async () => {
      await PlayerQuest.create({
        character_id: character.character_id,
        quest_id: killQuest.quest_id,
        status: 'in_progress',
        progress_json: { obj_1: 2 },
        accepted_at: new Date()
      });

      await QuestProgressService.updateProgress(character.character_id, 'kill', { target_id: 1, amount: 1 });

      const readyEvents = emittedEvents.filter(e => e.event === 'questReadyForReward');
      expect(readyEvents.length).toBe(1);
      expect(readyEvents[0].room).toBe(`character:${character.character_id}`);
      expect(readyEvents[0].payload.quest_id).toBe(killQuest.quest_id);
      expect(readyEvents[0].payload.name).toBe('Kill 3 Goblins');
      expect(readyEvents[0].payload.message).toMatch(/ready for reward/i);
    });

    it('emits both questUpdate and questReadyForReward on completion', async () => {
      await PlayerQuest.create({
        character_id: character.character_id,
        quest_id: killQuest.quest_id,
        status: 'in_progress',
        progress_json: { obj_1: 2 },
        accepted_at: new Date()
      });

      await QuestProgressService.updateProgress(character.character_id, 'kill', { target_id: 1, amount: 1 });

      const updateEvents = emittedEvents.filter(e => e.event === 'questUpdate');
      const readyEvents = emittedEvents.filter(e => e.event === 'questReadyForReward');

      expect(updateEvents.length).toBe(1);
      expect(readyEvents.length).toBe(1);
    });

    it('does not emit when no matching quests', async () => {
      await PlayerQuest.create({
        character_id: character.character_id,
        quest_id: killQuest.quest_id,
        status: 'accepted',
        progress_json: { obj_1: 0 },
        accepted_at: new Date()
      });

      await QuestProgressService.updateProgress(character.character_id, 'kill', { target_id: 999, amount: 1 });

      expect(emittedEvents.length).toBe(0);
    });
  });
});
