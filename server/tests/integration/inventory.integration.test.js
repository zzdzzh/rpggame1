const request = require('supertest');
const { app } = require('../../src/index');
const { Character, ItemDefinition, PlayerItem, sequelize } = require('../../src/models');
const CharacterService = require('../../src/services/CharacterService');

describe('Inventory API Integration', () => {
  let character;
  let potionDef;
  let swordDef;
  let oreDef;

  beforeEach(async () => {
    await sequelize.sync({ force: true });
    character = await Character.create({
      name: 'TestHero',
      character_type: 'player',
      map_id: 1,
      x: 0,
      y: 0
    });
    potionDef = await ItemDefinition.create({
      name: 'Small Health Potion',
      item_type: 'consumable',
      rarity: 'common',
      icon: 'potion_red_small',
      max_stack: 99,
      is_bind_on_pickup: false
    });
    swordDef = await ItemDefinition.create({
      name: 'Iron Sword',
      item_type: 'equipment',
      rarity: 'uncommon',
      icon: 'sword_iron',
      max_stack: 1,
      is_bind_on_pickup: false,
      equipment_stats: { attack: 10 },
      equip_slot: 'weapon'
    });
    oreDef = await ItemDefinition.create({
      name: 'Binded Ore',
      item_type: 'material',
      rarity: 'rare',
      icon: 'ore_bound',
      max_stack: 50,
      is_bind_on_pickup: true
    });
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

  async function seedPotion(quantity = 10, isBound = false) {
    const row = await PlayerItem.create({
      character_id: character.character_id,
      item_definition_id: potionDef.item_definition_id,
      quantity,
      is_bound: isBound
    });
    return row;
  }

  describe('GET /api/inventory', () => {
    it('returns empty inventory', async () => {
      const res = await request(app)
        .get('/api/inventory')
        .query({ character_id: character.character_id });

      expect(res.status).toBe(200);
      expect(res.body.character_id).toBe(character.character_id);
      expect(res.body.slots_used).toBe(0);
      expect(res.body.slots_total).toBe(200);
      expect(res.body.items).toEqual([]);
    });

    it('returns inventory with items', async () => {
      await seedPotion(10);
      await PlayerItem.create({
        character_id: character.character_id,
        item_definition_id: swordDef.item_definition_id,
        quantity: 1,
        is_bound: false
      });

      const res = await request(app)
        .get('/api/inventory')
        .query({ character_id: character.character_id });

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);
      const potion = res.body.items.find(i => i.item_definition_id === potionDef.item_definition_id);
      expect(potion).toMatchObject({
        name: 'Small Health Potion',
        item_type: 'consumable',
        quantity: 10,
        max_stack: 99
      });
    });

    it('filters by item_type query', async () => {
      await seedPotion(10);
      await PlayerItem.create({
        character_id: character.character_id,
        item_definition_id: swordDef.item_definition_id,
        quantity: 1,
        is_bound: false
      });

      const res = await request(app)
        .get('/api/inventory')
        .query({ character_id: character.character_id, item_type: 'consumable' });

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].item_type).toBe('consumable');
    });

    it('sorts by name ascending', async () => {
      await PlayerItem.create({
        character_id: character.character_id,
        item_definition_id: swordDef.item_definition_id,
        quantity: 1,
        is_bound: false
      });
      await seedPotion(10);

      const res = await request(app)
        .get('/api/inventory')
        .query({ character_id: character.character_id, sort_by: 'name', sort_order: 'asc' });

      expect(res.status).toBe(200);
      expect(res.body.items[0].name).toBe('Iron Sword');
      expect(res.body.items[1].name).toBe('Small Health Potion');
    });
  });

  describe('POST /api/inventory/discard', () => {
    it('discards a partial quantity', async () => {
      const row = await seedPotion(10);

      const res = await request(app)
        .post('/api/inventory/discard')
        .send({
          character_id: character.character_id,
          player_item_id: row.player_item_id,
          quantity: 3
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.discarded_quantity).toBe(3);
      expect(res.body.remaining_quantity).toBe(7);
      expect(res.body.player_item_id).toBe(row.player_item_id);
    });

    it('deletes row when discarding all', async () => {
      const row = await seedPotion(5);

      const res = await request(app)
        .post('/api/inventory/discard')
        .send({
          character_id: character.character_id,
          player_item_id: row.player_item_id,
          quantity: 5
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.remaining_quantity).toBe(0);

      const deleted = await PlayerItem.findByPk(row.player_item_id);
      expect(deleted).toBeNull();
    });

    it('returns 400 when discarding bound item', async () => {
      const row = await PlayerItem.create({
        character_id: character.character_id,
        item_definition_id: oreDef.item_definition_id,
        quantity: 5,
        is_bound: true
      });

      const res = await request(app)
        .post('/api/inventory/discard')
        .send({
          character_id: character.character_id,
          player_item_id: row.player_item_id,
          quantity: 1
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/bound/i);
    });

    it('returns 400 when quantity exceeds current', async () => {
      const row = await seedPotion(5);

      const res = await request(app)
        .post('/api/inventory/discard')
        .send({
          character_id: character.character_id,
          player_item_id: row.player_item_id,
          quantity: 10
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('returns 404 when player item not found', async () => {
      const res = await request(app)
        .post('/api/inventory/discard')
        .send({
          character_id: character.character_id,
          player_item_id: 99999,
          quantity: 1
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });
  });
});
