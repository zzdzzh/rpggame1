const InventoryService = require('./InventoryService');
const { Character, ItemDefinition, PlayerItem, sequelize } = require('../models');

describe('InventoryService', () => {
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
    await sequelize.close();
  });

  describe('useConsumable', () => {
    let healthPotion;
    let manaPotion;

    beforeEach(async () => {
      healthPotion = await ItemDefinition.create({
        name: 'Health Potion',
        item_type: 'consumable',
        rarity: 'common',
        icon: 'potion_red',
        max_stack: 99,
        is_bind_on_pickup: false,
        consumable_effect: { type: 'restore', target: 'hp', value: 30 }
      });
      manaPotion = await ItemDefinition.create({
        name: 'Mana Potion',
        item_type: 'consumable',
        rarity: 'common',
        icon: 'potion_blue',
        max_stack: 99,
        is_bind_on_pickup: false,
        consumable_effect: { type: 'restore', target: 'mp', value: 20 }
      });
    });

    it('restores hp and decrements quantity', async () => {
      character.hp = 50;
      await character.save();
      const result = await InventoryService.addItems(character.character_id, [
        { item_definition_id: healthPotion.item_definition_id, quantity: 3 }
      ]);
      const playerItem = await PlayerItem.findByPk(result.added[0].player_item_id);

      const useResult = await InventoryService.useConsumable(
        character.character_id,
        playerItem.player_item_id,
        1
      );

      expect(useResult.success).toBe(true);
      expect(useResult.restored_hp).toBe(30);
      expect(useResult.new_hp).toBe(80);

      const updatedChar = await Character.findByPk(character.character_id);
      expect(updatedChar.hp).toBe(80);

      const updatedItem = await PlayerItem.findByPk(playerItem.player_item_id);
      expect(updatedItem.quantity).toBe(2);
    });

    it('does not exceed max_hp', async () => {
      character.hp = 90;
      await character.save();
      const result = await InventoryService.addItems(character.character_id, [
        { item_definition_id: healthPotion.item_definition_id, quantity: 1 }
      ]);
      const playerItem = await PlayerItem.findByPk(result.added[0].player_item_id);

      const useResult = await InventoryService.useConsumable(
        character.character_id,
        playerItem.player_item_id,
        1
      );

      expect(useResult.restored_hp).toBe(10);
      expect(useResult.new_hp).toBe(100);
    });

    it('does not exceed max_mp', async () => {
      character.mp = 45;
      await character.save();
      const result = await InventoryService.addItems(character.character_id, [
        { item_definition_id: manaPotion.item_definition_id, quantity: 1 }
      ]);
      const playerItem = await PlayerItem.findByPk(result.added[0].player_item_id);

      const useResult = await InventoryService.useConsumable(
        character.character_id,
        playerItem.player_item_id,
        1
      );

      expect(useResult.restored_mp).toBe(5);
      expect(useResult.new_mp).toBe(50);
    });

    it('deletes row when quantity reaches 0', async () => {
      character.hp = 50;
      await character.save();
      const result = await InventoryService.addItems(character.character_id, [
        { item_definition_id: healthPotion.item_definition_id, quantity: 1 }
      ]);
      const playerItem = await PlayerItem.findByPk(result.added[0].player_item_id);

      await InventoryService.useConsumable(
        character.character_id,
        playerItem.player_item_id,
        1
      );

      const deleted = await PlayerItem.findByPk(playerItem.player_item_id);
      expect(deleted).toBeNull();
    });

    it('rejects when item is not consumable', async () => {
      const result = await InventoryService.addItems(character.character_id, [
        { item_definition_id: swordDef.item_definition_id, quantity: 1 }
      ]);
      const playerItem = await PlayerItem.findByPk(result.added[0].player_item_id);

      await expect(
        InventoryService.useConsumable(character.character_id, playerItem.player_item_id, 1)
      ).rejects.toThrow(/consumable/);
    });

    it('rejects when quantity exceeds current', async () => {
      const result = await InventoryService.addItems(character.character_id, [
        { item_definition_id: healthPotion.item_definition_id, quantity: 2 }
      ]);
      const playerItem = await PlayerItem.findByPk(result.added[0].player_item_id);

      await expect(
        InventoryService.useConsumable(character.character_id, playerItem.player_item_id, 3)
      ).rejects.toThrow();
    });
  });

  describe('equipItem', () => {
    let helmetDef;
    let armorDef;

    beforeEach(async () => {
      helmetDef = await ItemDefinition.create({
        name: 'Iron Helmet',
        item_type: 'equipment',
        rarity: 'common',
        icon: 'helmet_iron',
        max_stack: 1,
        is_bind_on_pickup: false,
        equipment_stats: { defense: 5 },
        equip_slot: 'helmet'
      });
      armorDef = await ItemDefinition.create({
        name: 'Iron Armor',
        item_type: 'equipment',
        rarity: 'common',
        icon: 'armor_iron',
        max_stack: 1,
        is_bind_on_pickup: false,
        equipment_stats: { defense: 10 },
        equip_slot: 'armor'
      });
    });

    it('equips item and increases stats', async () => {
      const result = await InventoryService.addItems(character.character_id, [
        { item_definition_id: swordDef.item_definition_id, quantity: 1 }
      ]);
      const playerItem = await PlayerItem.findByPk(result.added[0].player_item_id);

      const equipResult = await InventoryService.equipItem(
        character.character_id,
        playerItem.player_item_id
      );

      expect(equipResult.success).toBe(true);
      expect(equipResult.equipped_slot).toBe('weapon');

      const updatedChar = await Character.findByPk(character.character_id);
      expect(updatedChar.equip_weapon_id).toBe(swordDef.item_definition_id);
      expect(updatedChar.attack).toBe(20);
    });

    it('replaces old equipment and returns it to inventory', async () => {
      const steelSwordDef = await ItemDefinition.create({
        name: 'Steel Sword',
        item_type: 'equipment',
        rarity: 'uncommon',
        icon: 'sword_steel',
        max_stack: 1,
        is_bind_on_pickup: false,
        equipment_stats: { attack: 15 },
        equip_slot: 'weapon'
      });

      const addResult1 = await InventoryService.addItems(character.character_id, [
        { item_definition_id: swordDef.item_definition_id, quantity: 1 }
      ]);
      await InventoryService.equipItem(character.character_id, addResult1.added[0].player_item_id);

      const addResult2 = await InventoryService.addItems(character.character_id, [
        { item_definition_id: steelSwordDef.item_definition_id, quantity: 1 }
      ]);
      const equipResult = await InventoryService.equipItem(
        character.character_id,
        addResult2.added[0].player_item_id
      );

      expect(equipResult.success).toBe(true);
      expect(equipResult.replaced).toBe(true);

      const updatedChar = await Character.findByPk(character.character_id);
      expect(updatedChar.equip_weapon_id).toBe(steelSwordDef.item_definition_id);
      expect(updatedChar.attack).toBe(25);

      const inventory = await InventoryService.getInventory(character.character_id);
      const oldSword = inventory.items.find(
        i => i.item_definition_id === swordDef.item_definition_id
      );
      expect(oldSword).toBeDefined();
      expect(oldSword.quantity).toBe(1);
    });

    it('rejects when item is not equipment', async () => {
      const result = await InventoryService.addItems(character.character_id, [
        { item_definition_id: potionDef.item_definition_id, quantity: 1 }
      ]);
      const playerItem = await PlayerItem.findByPk(result.added[0].player_item_id);

      await expect(
        InventoryService.equipItem(character.character_id, playerItem.player_item_id)
      ).rejects.toThrow(/equipment/);
    });

    it('rejects when player item belongs to different character', async () => {
      const otherChar = await Character.create({ name: 'Other', character_type: 'player' });
      const result = await InventoryService.addItems(otherChar.character_id, [
        { item_definition_id: swordDef.item_definition_id, quantity: 1 }
      ]);

      await expect(
        InventoryService.equipItem(character.character_id, result.added[0].player_item_id)
      ).rejects.toThrow();
    });
  });

  describe('unequipItem', () => {
    let helmetDef;

    beforeEach(async () => {
      helmetDef = await ItemDefinition.create({
        name: 'Iron Helmet',
        item_type: 'equipment',
        rarity: 'common',
        icon: 'helmet_iron',
        max_stack: 1,
        is_bind_on_pickup: false,
        equipment_stats: { defense: 5 },
        equip_slot: 'helmet'
      });
    });

    it('unequips item and returns to inventory', async () => {
      const result = await InventoryService.addItems(character.character_id, [
        { item_definition_id: helmetDef.item_definition_id, quantity: 1 }
      ]);
      await InventoryService.equipItem(character.character_id, result.added[0].player_item_id);

      const unequipResult = await InventoryService.unequipItem(
        character.character_id,
        'helmet'
      );

      expect(unequipResult.success).toBe(true);

      const updatedChar = await Character.findByPk(character.character_id);
      expect(updatedChar.equip_helmet_id).toBeNull();
      expect(updatedChar.defense).toBe(5);

      const inventory = await InventoryService.getInventory(character.character_id);
      const helmet = inventory.items.find(
        i => i.item_definition_id === helmetDef.item_definition_id
      );
      expect(helmet).toBeDefined();
      expect(helmet.quantity).toBe(1);
    });

    it('rejects when slot is empty', async () => {
      await expect(
        InventoryService.unequipItem(character.character_id, 'weapon')
      ).rejects.toThrow(/empty/);
    });

    it('rejects when inventory is full', async () => {
      const result = await InventoryService.addItems(character.character_id, [
        { item_definition_id: helmetDef.item_definition_id, quantity: 1 }
      ]);
      await InventoryService.equipItem(character.character_id, result.added[0].player_item_id);

      // Fill inventory
      const fillerDef = await ItemDefinition.create({
        name: 'Filler',
        item_type: 'material',
        rarity: 'common',
        icon: 'filler',
        max_stack: 1,
        is_bind_on_pickup: false
      });
      for (let i = 0; i < 200; i++) {
        await InventoryService.addItems(character.character_id, [
          { item_definition_id: fillerDef.item_definition_id, quantity: 1 }
        ]);
      }

      await expect(
        InventoryService.unequipItem(character.character_id, 'helmet')
      ).rejects.toThrow(/full/);
    });
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
});
