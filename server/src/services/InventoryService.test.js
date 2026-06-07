const InventoryService = require('./InventoryService');
const { Character, ItemDefinition, PlayerItem, sequelize } = require('../models');

describe('InventoryService', () => {
  let character;
  let potionDef;
  let swordDef;
  let oreDef;
  let helmetDef;

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
      is_bind_on_pickup: false,
      consumable_effect: { type: 'restore', target: 'hp', value: 30 }
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
    helmetDef = await ItemDefinition.create({
      name: 'Iron Helmet',
      item_type: 'equipment',
      rarity: 'common',
      icon: 'helmet_iron',
      max_stack: 1,
      is_bind_on_pickup: false,
      equipment_stats: { defense: 5, max_hp: 20 },
      equip_slot: 'helmet'
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
    await sequelize.close();
  });

  describe('addItems', () => {
    it('creates a new PlayerItem row when inventory is empty', async () => {
      const result = await InventoryService.addItems(character.character_id, [
        { item_definition_id: potionDef.item_definition_id, quantity: 10 }
      ]);

      expect(result.success).toBe(true);
      expect(result.added).toHaveLength(1);
      expect(result.added[0].item_definition_id).toBe(potionDef.item_definition_id);
      expect(result.added[0].quantity).toBe(10);
      expect(result.failed).toEqual([]);

      const rows = await PlayerItem.findAll({
        where: { character_id: character.character_id }
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].quantity).toBe(10);
      expect(rows[0].is_bound).toBe(false);
    });

    it('stacks onto existing row when same character, definition and is_bound', async () => {
      await InventoryService.addItems(character.character_id, [
        { item_definition_id: potionDef.item_definition_id, quantity: 50 }
      ]);

      const result = await InventoryService.addItems(character.character_id, [
        { item_definition_id: potionDef.item_definition_id, quantity: 30 }
      ]);

      expect(result.success).toBe(true);
      expect(result.added).toHaveLength(1);

      const rows = await PlayerItem.findAll({
        where: { character_id: character.character_id, item_definition_id: potionDef.item_definition_id }
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].quantity).toBe(80);
    });

    it('creates additional slot when stack would exceed max_stack', async () => {
      await InventoryService.addItems(character.character_id, [
        { item_definition_id: potionDef.item_definition_id, quantity: 90 }
      ]);

      const result = await InventoryService.addItems(character.character_id, [
        { item_definition_id: potionDef.item_definition_id, quantity: 20 }
      ]);

      expect(result.success).toBe(true);

      const rows = await PlayerItem.findAll({
        where: { character_id: character.character_id, item_definition_id: potionDef.item_definition_id },
        order: [['quantity', 'ASC']]
      });
      expect(rows).toHaveLength(2);
      expect(rows[0].quantity).toBe(11);
      expect(rows[1].quantity).toBe(99);
    });

    it('auto-binds when ItemDefinition.bind_on_pickup is true', async () => {
      const result = await InventoryService.addItems(character.character_id, [
        { item_definition_id: oreDef.item_definition_id, quantity: 5 }
      ]);

      expect(result.success).toBe(true);
      const rows = await PlayerItem.findAll({
        where: { character_id: character.character_id }
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].is_bound).toBe(true);
    });

    it('keeps separate stacks for bound and unbound items', async () => {
      await InventoryService.addItems(character.character_id, [
        { item_definition_id: potionDef.item_definition_id, quantity: 10, is_bound: true }
      ]);

      const result = await InventoryService.addItems(character.character_id, [
        { item_definition_id: potionDef.item_definition_id, quantity: 15, is_bound: false }
      ]);

      expect(result.success).toBe(true);
      const rows = await PlayerItem.findAll({
        where: { character_id: character.character_id, item_definition_id: potionDef.item_definition_id },
        order: [['is_bound', 'ASC']]
      });
      expect(rows).toHaveLength(2);
      expect(rows[0].is_bound).toBe(false);
      expect(rows[0].quantity).toBe(15);
      expect(rows[1].is_bound).toBe(true);
      expect(rows[1].quantity).toBe(10);
    });

    it('throws and rolls back when total slots would exceed 200', async () => {
      await InventoryService.addItems(character.character_id, [
        { item_definition_id: swordDef.item_definition_id, quantity: 200 }
      ]);

      await expect(
        InventoryService.addItems(character.character_id, [
          { item_definition_id: swordDef.item_definition_id, quantity: 1 }
        ])
      ).rejects.toThrow();

      const rows = await PlayerItem.findAll({
        where: { character_id: character.character_id }
      });
      expect(rows).toHaveLength(200);
    });

    it('throws when item definition does not exist', async () => {
      await expect(
        InventoryService.addItems(character.character_id, [
          { item_definition_id: 99999, quantity: 1 }
        ])
      ).rejects.toThrow();
    });

    it('throws when character does not exist', async () => {
      await expect(
        InventoryService.addItems(99999, [
          { item_definition_id: potionDef.item_definition_id, quantity: 1 }
        ])
      ).rejects.toThrow();
    });

    it('returns added entries with player_item_id', async () => {
      const result = await InventoryService.addItems(character.character_id, [
        { item_definition_id: potionDef.item_definition_id, quantity: 5 },
        { item_definition_id: swordDef.item_definition_id, quantity: 1 }
      ]);

      expect(result.success).toBe(true);
      expect(result.added).toHaveLength(2);
      expect(result.added[0]).toHaveProperty('player_item_id');
      expect(result.added[1]).toHaveProperty('player_item_id');
      expect(result.added[0].player_item_id).not.toBe(result.added[1].player_item_id);
    });
  });

  describe('discardItem', () => {
    let playerItem;

    beforeEach(async () => {
      const result = await InventoryService.addItems(character.character_id, [
        { item_definition_id: potionDef.item_definition_id, quantity: 10 }
      ]);
      playerItem = await PlayerItem.findByPk(result.added[0].player_item_id);
    });

    it('decrements quantity and returns remaining', async () => {
      const result = await InventoryService.discardItem(
        character.character_id,
        playerItem.player_item_id,
        3
      );

      expect(result.success).toBe(true);
      expect(result.discarded_quantity).toBe(3);
      expect(result.remaining_quantity).toBe(7);
      expect(result.player_item_id).toBe(playerItem.player_item_id);

      const row = await PlayerItem.findByPk(playerItem.player_item_id);
      expect(row.quantity).toBe(7);
    });

    it('deletes row when discarding all quantity', async () => {
      const result = await InventoryService.discardItem(
        character.character_id,
        playerItem.player_item_id,
        10
      );

      expect(result.success).toBe(true);
      expect(result.discarded_quantity).toBe(10);
      expect(result.remaining_quantity).toBe(0);

      const row = await PlayerItem.findByPk(playerItem.player_item_id);
      expect(row).toBeNull();
    });

    it('rejects when player item belongs to different character', async () => {
      const otherChar = await Character.create({ name: 'Other', character_type: 'player' });
      await expect(
        InventoryService.discardItem(otherChar.character_id, playerItem.player_item_id, 1)
      ).rejects.toThrow();
    });

    it('rejects when item is bound', async () => {
      const boundResult = await InventoryService.addItems(character.character_id, [
        { item_definition_id: oreDef.item_definition_id, quantity: 5 }
      ]);
      const boundItem = boundResult.added[0];

      await expect(
        InventoryService.discardItem(character.character_id, boundItem.player_item_id, 1)
      ).rejects.toThrow(/bound/);
    });

    it('rejects when quantity to discard exceeds current quantity', async () => {
      await expect(
        InventoryService.discardItem(character.character_id, playerItem.player_item_id, 11)
      ).rejects.toThrow();
    });

    it('rejects when player item does not exist', async () => {
      await expect(
        InventoryService.discardItem(character.character_id, 99999, 1)
      ).rejects.toThrow();
    });
  });

  describe('getInventory', () => {
    beforeEach(async () => {
      await InventoryService.addItems(character.character_id, [
        { item_definition_id: potionDef.item_definition_id, quantity: 10 },
        { item_definition_id: swordDef.item_definition_id, quantity: 1 }
      ]);
    });

    it('returns inventory with metadata', async () => {
      const result = await InventoryService.getInventory(character.character_id);

      expect(result.character_id).toBe(character.character_id);
      expect(result.slots_used).toBe(2);
      expect(result.slots_total).toBe(InventoryService.SLOTS_TOTAL);
      expect(result.items).toHaveLength(2);
    });

    it('includes expected item fields', async () => {
      const result = await InventoryService.getInventory(character.character_id);
      const item = result.items.find(i => i.item_definition_id === potionDef.item_definition_id);

      expect(item).toMatchObject({
        item_definition_id: potionDef.item_definition_id,
        name: potionDef.name,
        icon: potionDef.icon,
        item_type: potionDef.item_type,
        rarity: potionDef.rarity,
        quantity: 10,
        max_stack: potionDef.max_stack,
        is_bound: false
      });
      expect(item).toHaveProperty('player_item_id');
      expect(item).toHaveProperty('acquired_at');
    });

    it('filters by item_type', async () => {
      const result = await InventoryService.getInventory(character.character_id, {
        item_type: 'consumable'
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].item_type).toBe('consumable');
    });

    it('sorts by name ascending', async () => {
      const result = await InventoryService.getInventory(character.character_id, {
        sort_by: 'name',
        sort_order: 'asc'
      });

      expect(result.items[0].name).toBe('Iron Sword');
      expect(result.items[1].name).toBe('Small Health Potion');
    });

    it('sorts by rarity descending', async () => {
      const result = await InventoryService.getInventory(character.character_id, {
        sort_by: 'rarity',
        sort_order: 'desc'
      });

      expect(result.items[0].rarity).toBe('uncommon');
      expect(result.items[1].rarity).toBe('common');
    });

    it('defaults sort to acquired_at desc', async () => {
      await sequelize.query('UPDATE player_items SET acquired_at = datetime(acquired_at, "-1 seconds") WHERE item_definition_id = ?', {
        replacements: [potionDef.item_definition_id]
      });
      const result = await InventoryService.getInventory(character.character_id);
      expect(result.items[0].item_type).toBe('equipment');
      expect(result.items[1].item_type).toBe('consumable');
    });
  });

  describe('useConsumable', () => {
    let playerItem;

    beforeEach(async () => {
      const result = await InventoryService.addItems(character.character_id, [
        { item_definition_id: potionDef.item_definition_id, quantity: 5 }
      ]);
      playerItem = await PlayerItem.findByPk(result.added[0].player_item_id);
      character.hp = 50;
      await character.save();
    });

    it('restores hp and reduces quantity', async () => {
      const result = await InventoryService.useConsumable(
        character.character_id,
        playerItem.player_item_id,
        1
      );

      expect(result.success).toBe(true);
      expect(result.effect.type).toBe('restore');
      expect(result.effect.target).toBe('hp');
      expect(result.effect.actual_value).toBe(30);
      expect(result.remaining_quantity).toBe(4);
      expect(result.character.hp).toBe(80);
    });

    it('caps hp at max_hp', async () => {
      character.hp = 90;
      await character.save();

      const result = await InventoryService.useConsumable(
        character.character_id,
        playerItem.player_item_id,
        1
      );

      expect(result.effect.actual_value).toBe(10);
      expect(result.effect.reason).toBe('capped_by_max_hp');
      expect(result.character.hp).toBe(100);
    });

    it('deletes row when using last item', async () => {
      const result = await InventoryService.useConsumable(
        character.character_id,
        playerItem.player_item_id,
        5
      );

      expect(result.remaining_quantity).toBe(0);
      const row = await PlayerItem.findByPk(playerItem.player_item_id);
      expect(row).toBeNull();
    });

    it('rejects when item is not consumable', async () => {
      const swordResult = await InventoryService.addItems(character.character_id, [
        { item_definition_id: swordDef.item_definition_id, quantity: 1 }
      ]);

      await expect(
        InventoryService.useConsumable(character.character_id, swordResult.added[0].player_item_id, 1)
      ).rejects.toThrow(/not a consumable/);
    });

    it('rejects when quantity exceeds current', async () => {
      await expect(
        InventoryService.useConsumable(character.character_id, playerItem.player_item_id, 10)
      ).rejects.toThrow(/exceeds/);
    });
  });

  describe('equipItem', () => {
    let swordItem;
    let helmetItem;
    let potionItem;

    beforeEach(async () => {
      const swordResult = await InventoryService.addItems(character.character_id, [
        { item_definition_id: swordDef.item_definition_id, quantity: 1 }
      ]);
      swordItem = swordResult.added[0];

      const helmetResult = await InventoryService.addItems(character.character_id, [
        { item_definition_id: helmetDef.item_definition_id, quantity: 1 }
      ]);
      helmetItem = helmetResult.added[0];

      const potionResult = await InventoryService.addItems(character.character_id, [
        { item_definition_id: potionDef.item_definition_id, quantity: 1 }
      ]);
      potionItem = potionResult.added[0];
    });

    it('equips weapon and increases attack', async () => {
      const result = await InventoryService.equipItem(character.character_id, swordItem.player_item_id);

      expect(result.success).toBe(true);
      expect(result.equipped_slot).toBe('weapon');
      expect(result.character.attack).toBe(20);

      const updated = await Character.findByPk(character.character_id);
      expect(updated.equip_weapon_id).toBe(swordItem.player_item_id);
    });

    it('replaces previous equipment and updates stats', async () => {
      const steelSwordDef = await ItemDefinition.create({
        name: 'Steel Sword',
        item_type: 'equipment',
        rarity: 'rare',
        icon: 'sword_steel',
        max_stack: 1,
        equipment_stats: { attack: 15 },
        equip_slot: 'weapon'
      });
      const steelResult = await InventoryService.addItems(character.character_id, [
        { item_definition_id: steelSwordDef.item_definition_id, quantity: 1 }
      ]);

      await InventoryService.equipItem(character.character_id, swordItem.player_item_id);
      const result = await InventoryService.equipItem(character.character_id, steelResult.added[0].player_item_id);

      expect(result.success).toBe(true);
      expect(result.previous_item.player_item_id).toBe(swordItem.player_item_id);
      expect(result.character.attack).toBe(25);
    });

    it('rejects non-equipment items', async () => {
      await expect(
        InventoryService.equipItem(character.character_id, potionItem.player_item_id)
      ).rejects.toThrow();
    });

    it('equips helmet and increases defense and max_hp', async () => {
      const result = await InventoryService.equipItem(character.character_id, helmetItem.player_item_id);

      expect(result.success).toBe(true);
      expect(result.equipped_slot).toBe('helmet');
      expect(result.character.defense).toBe(10);
      expect(result.character.max_hp).toBe(120);

      const updated = await Character.findByPk(character.character_id);
      expect(updated.equip_helmet_id).toBe(helmetItem.player_item_id);
    });
  });

  describe('unequipItem', () => {
    let swordItem;

    beforeEach(async () => {
      const swordResult = await InventoryService.addItems(character.character_id, [
        { item_definition_id: swordDef.item_definition_id, quantity: 1 }
      ]);
      swordItem = swordResult.added[0];
      await InventoryService.equipItem(character.character_id, swordItem.player_item_id);
    });

    it('unequips weapon and decreases attack', async () => {
      const result = await InventoryService.unequipItem(character.character_id, 'weapon');

      expect(result.success).toBe(true);
      expect(result.unequipped_item.player_item_id).toBe(swordItem.player_item_id);
      expect(result.character.attack).toBe(10);

      const updated = await Character.findByPk(character.character_id);
      expect(updated.equip_weapon_id).toBeNull();
    });

    it('rejects when slot is empty', async () => {
      await InventoryService.unequipItem(character.character_id, 'weapon');

      await expect(
        InventoryService.unequipItem(character.character_id, 'weapon')
      ).rejects.toThrow(/No item equipped/);
    });

    it('keeps PlayerItem in inventory after unequip', async () => {
      const result = await InventoryService.unequipItem(character.character_id, 'weapon');

      expect(result.success).toBe(true);
      const row = await PlayerItem.findByPk(swordItem.player_item_id);
      expect(row).not.toBeNull();
      expect(row.quantity).toBe(1);
    });
  });
});
