const ItemService = require('./ItemService');
const { ItemDefinition, PlayerItem, Character, sequelize } = require('../models');

describe('ItemService', () => {
  beforeEach(async () => {
    await sequelize.sync({ force: true });
  });

  afterEach(async () => {
    await PlayerItem.destroy({ where: {}, force: true });
    await ItemDefinition.destroy({ where: {}, force: true });
    await Character.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('create', () => {
    it('creates consumable with valid data', async () => {
      const def = await ItemService.create({
        name: 'Health Potion',
        item_type: 'consumable',
        rarity: 'common',
        max_stack: 99,
        consumable_effect: { type: 'restore', target: 'hp', value: 30 }
      });

      expect(def.item_definition_id).toBeDefined();
      expect(def.name).toBe('Health Potion');
      expect(def.item_type).toBe('consumable');
    });

    it('creates equipment with valid data', async () => {
      const def = await ItemService.create({
        name: 'Iron Sword',
        item_type: 'equipment',
        rarity: 'uncommon',
        max_stack: 1,
        equip_slot: 'weapon',
        equipment_stats: { attack: 10 }
      });

      expect(def.item_type).toBe('equipment');
      expect(def.equip_slot).toBe('weapon');
    });

    it('rejects missing name', async () => {
      await expect(
        ItemService.create({ item_type: 'consumable', consumable_effect: { type: 'restore', target: 'hp', value: 10 } })
      ).rejects.toThrow(/name is required/);
    });

    it('rejects invalid item_type', async () => {
      await expect(
        ItemService.create({ name: 'X', item_type: 'invalid' })
      ).rejects.toThrow(/item_type must be one of/);
    });

    it('rejects equipment without equip_slot', async () => {
      await expect(
        ItemService.create({ name: 'Sword', item_type: 'equipment', equipment_stats: {} })
      ).rejects.toThrow(/equip_slot must be one of/);
    });

    it('rejects equipment without equipment_stats', async () => {
      await expect(
        ItemService.create({ name: 'Sword', item_type: 'equipment', equip_slot: 'weapon' })
      ).rejects.toThrow(/equipment_stats is required/);
    });

    it('rejects consumable without consumable_effect', async () => {
      await expect(
        ItemService.create({ name: 'Potion', item_type: 'consumable' })
      ).rejects.toThrow(/consumable_effect is required/);
    });

    it('rejects equipment with max_stack != 1', async () => {
      await expect(
        ItemService.create({ name: 'Sword', item_type: 'equipment', equip_slot: 'weapon', equipment_stats: {}, max_stack: 5 })
      ).rejects.toThrow(/equipment max_stack must be 1/);
    });
  });

  describe('findAll', () => {
    beforeEach(async () => {
      await ItemDefinition.bulkCreate([
        { name: 'Potion A', item_type: 'consumable', rarity: 'common', max_stack: 99 },
        { name: 'Potion B', item_type: 'consumable', rarity: 'rare', max_stack: 99 },
        { name: 'Sword', item_type: 'equipment', rarity: 'uncommon', max_stack: 1, equip_slot: 'weapon', equipment_stats: {} }
      ]);
    });

    it('returns paginated list', async () => {
      const result = await ItemService.findAll({}, { page: 1, page_size: 2 });
      expect(result.total).toBe(3);
      expect(result.items).toHaveLength(2);
      expect(result.page).toBe(1);
    });

    it('filters by item_type', async () => {
      const result = await ItemService.findAll({ item_type: 'consumable' });
      expect(result.items).toHaveLength(2);
    });

    it('filters by rarity', async () => {
      const result = await ItemService.findAll({ rarity: 'common' });
      expect(result.items).toHaveLength(1);
    });

    it('filters by name fuzzy match', async () => {
      const result = await ItemService.findAll({ name: 'Potion' });
      expect(result.items).toHaveLength(2);
    });
  });

  describe('findById', () => {
    it('returns definition by id', async () => {
      const def = await ItemDefinition.create({ name: 'X', item_type: 'material', max_stack: 50 });
      const result = await ItemService.findById(def.item_definition_id);
      expect(result.name).toBe('X');
    });

    it('throws when not found', async () => {
      await expect(ItemService.findById(99999)).rejects.toThrow(/not found/);
    });
  });

  describe('update', () => {
    it('updates name', async () => {
      const def = await ItemDefinition.create({ name: 'Old', item_type: 'material', max_stack: 50 });
      const updated = await ItemService.update(def.item_definition_id, { name: 'New' });
      expect(updated.name).toBe('New');
    });

    it('throws when not found', async () => {
      await expect(ItemService.update(99999, { name: 'X' })).rejects.toThrow(/not found/);
    });

    it('throws on invalid data', async () => {
      const def = await ItemDefinition.create({ name: 'X', item_type: 'material', max_stack: 50 });
      await expect(
        ItemService.update(def.item_definition_id, { max_stack: 0 })
      ).rejects.toThrow(/max_stack must be an integer/);
    });

    it('recalculates equipped characters when equipment_stats changes', async () => {
      const swordDef = await ItemDefinition.create({
        name: 'Iron Sword',
        item_type: 'equipment',
        rarity: 'common',
        max_stack: 1,
        equip_slot: 'weapon',
        equipment_stats: { attack: 10 }
      });

      const character = await Character.create({
        name: 'Hero',
        character_type: 'player',
        attack: 10,
        equip_weapon_id: null
      });

      const playerItem = await PlayerItem.create({
        character_id: character.character_id,
        item_definition_id: swordDef.item_definition_id,
        quantity: 1
      });

      character.equip_weapon_id = playerItem.player_item_id;
      await character.save();

      await ItemService.update(swordDef.item_definition_id, {
        equipment_stats: { attack: 20 }
      });

      const updatedChar = await Character.findByPk(character.character_id);
      expect(updatedChar.attack).toBe(20);
    });
  });

  describe('remove', () => {
    it('deletes unused definition', async () => {
      const def = await ItemDefinition.create({ name: 'X', item_type: 'material', max_stack: 50 });
      await ItemService.remove(def.item_definition_id);
      const found = await ItemDefinition.findByPk(def.item_definition_id);
      expect(found).toBeNull();
    });

    it('throws when definition is held by players', async () => {
      const def = await ItemDefinition.create({ name: 'X', item_type: 'material', max_stack: 50 });
      const character = await Character.create({ name: 'Hero', character_type: 'player' });
      await PlayerItem.create({
        character_id: character.character_id,
        item_definition_id: def.item_definition_id,
        quantity: 1
      });

      await expect(ItemService.remove(def.item_definition_id)).rejects.toThrow(/held by players/);
    });

    it('throws when not found', async () => {
      await expect(ItemService.remove(99999)).rejects.toThrow(/not found/);
    });
  });
});
