const request = require('supertest');
const { app } = require('../../src/index');
const { ItemDefinition, PlayerItem, Character, sequelize } = require('../../src/models');
const CharacterService = require('../../src/services/CharacterService');

describe('Item Admin API Integration', () => {
  beforeEach(async () => {
    await sequelize.sync({ force: true });
  });

  afterEach(async () => {
    await PlayerItem.destroy({ where: {}, force: true });
    await ItemDefinition.destroy({ where: {}, force: true });
    await Character.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    CharacterService.stopPositionBroadcast();
    await sequelize.close();
  });

  describe('GET /api/admin/items', () => {
    beforeEach(async () => {
      await ItemDefinition.bulkCreate([
        { name: 'Potion A', item_type: 'consumable', rarity: 'common', max_stack: 99 },
        { name: 'Potion B', item_type: 'consumable', rarity: 'rare', max_stack: 99 },
        { name: 'Sword', item_type: 'equipment', rarity: 'uncommon', max_stack: 1, equip_slot: 'weapon', equipment_stats: {} }
      ]);
    });

    it('returns paginated item definitions', async () => {
      const res = await request(app)
        .get('/api/admin/items')
        .query({ page: 1, page_size: 2 });

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(3);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.page).toBe(1);
    });

    it('filters by item_type', async () => {
      const res = await request(app)
        .get('/api/admin/items')
        .query({ item_type: 'consumable' });

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);
    });

    it('filters by name', async () => {
      const res = await request(app)
        .get('/api/admin/items')
        .query({ name: 'Potion' });

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);
    });
  });

  describe('GET /api/admin/items/:id', () => {
    it('returns single item definition', async () => {
      const def = await ItemDefinition.create({ name: 'X', item_type: 'material', max_stack: 50 });

      const res = await request(app)
        .get(`/api/admin/items/${def.item_definition_id}`);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('X');
    });

    it('returns 404 when not found', async () => {
      const res = await request(app)
        .get('/api/admin/items/99999');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/admin/items', () => {
    it('creates a new item definition', async () => {
      const res = await request(app)
        .post('/api/admin/items')
        .send({
          name: 'Steel Sword',
          item_type: 'equipment',
          rarity: 'rare',
          max_stack: 1,
          equip_slot: 'weapon',
          equipment_stats: { attack: 15 }
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Steel Sword');
      expect(res.body.item_definition_id).toBeDefined();
    });

    it('returns 400 on invalid data', async () => {
      const res = await request(app)
        .post('/api/admin/items')
        .send({
          name: 'Bad',
          item_type: 'equipment'
        });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/admin/items/:id', () => {
    it('updates an item definition', async () => {
      const def = await ItemDefinition.create({ name: 'Old', item_type: 'material', max_stack: 50 });

      const res = await request(app)
        .put(`/api/admin/items/${def.item_definition_id}`)
        .send({ name: 'New' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('New');
    });

    it('returns 404 when not found', async () => {
      const res = await request(app)
        .put('/api/admin/items/99999')
        .send({ name: 'X' });

      expect(res.status).toBe(404);
    });

    it('returns 400 on invalid data', async () => {
      const def = await ItemDefinition.create({ name: 'X', item_type: 'material', max_stack: 50 });

      const res = await request(app)
        .put(`/api/admin/items/${def.item_definition_id}`)
        .send({ max_stack: 0 });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/admin/items/:id', () => {
    it('deletes unused item definition', async () => {
      const def = await ItemDefinition.create({ name: 'X', item_type: 'material', max_stack: 50 });

      const res = await request(app)
        .delete(`/api/admin/items/${def.item_definition_id}`);

      expect(res.status).toBe(204);
    });

    it('returns 400 when held by players', async () => {
      const def = await ItemDefinition.create({ name: 'X', item_type: 'material', max_stack: 50 });
      const character = await Character.create({ name: 'Hero', character_type: 'player' });
      await PlayerItem.create({
        character_id: character.character_id,
        item_definition_id: def.item_definition_id,
        quantity: 1
      });

      const res = await request(app)
        .delete(`/api/admin/items/${def.item_definition_id}`);

      expect(res.status).toBe(400);
    });

    it('returns 404 when not found', async () => {
      const res = await request(app)
        .delete('/api/admin/items/99999');

      expect(res.status).toBe(404);
    });
  });
});
