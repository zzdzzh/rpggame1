const { Character, ItemDefinition, PlayerItem, sequelize } = require('../models');

const SLOTS_TOTAL = 200;

const EQUIP_SLOT_FIELDS = {
  weapon: 'equip_weapon_id',
  helmet: 'equip_helmet_id',
  armor: 'equip_armor_id',
  accessory: 'equip_accessory_id'
};

async function addItems(characterId, items, externalTransaction) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('items must be a non-empty array');
  }

  const transaction = externalTransaction || await sequelize.transaction();

  try {
    const character = await Character.findByPk(characterId, { transaction });
    if (!character) {
      throw new Error('Character not found');
    }

    const definitionIds = items.map(i => i.item_definition_id);
    const definitions = await ItemDefinition.findAll({
      where: { item_definition_id: definitionIds },
      transaction
    });
    const definitionMap = new Map(definitions.map(d => [d.item_definition_id, d]));

    for (const item of items) {
      if (!definitionMap.has(item.item_definition_id)) {
        throw new Error(`ItemDefinition not found: ${item.item_definition_id}`);
      }
    }

    const currentSlots = await PlayerItem.count({
      where: { character_id: characterId },
      transaction
    });

    let slotsNeeded = 0;
    const plan = [];

    for (const item of items) {
      const definition = definitionMap.get(item.item_definition_id);
      const quantity = Math.max(1, Number(item.quantity) || 0);
      const isBound = definition.is_bind_on_pickup
        ? true
        : Boolean(item.is_bound);

      const existingRows = await PlayerItem.findAll({
        where: {
          character_id: characterId,
          item_definition_id: definition.item_definition_id,
          is_bound: isBound
        },
        order: [['quantity', 'ASC']],
        transaction
      });

      let remaining = quantity;
      const stackUpdates = [];

      for (const row of existingRows) {
        if (remaining <= 0) break;
        const space = definition.max_stack - row.quantity;
        if (space <= 0) continue;
        const add = Math.min(space, remaining);
        stackUpdates.push({ player_item_id: row.player_item_id, add });
        remaining -= add;
      }

      const newSlots = Math.ceil(remaining / definition.max_stack);
      slotsNeeded += newSlots;

      plan.push({
        definition,
        quantity,
        isBound,
        stackUpdates,
        remaining
      });
    }

    if (currentSlots + slotsNeeded > SLOTS_TOTAL) {
      throw new Error('Inventory full');
    }

    const added = [];

    for (const entry of plan) {
      const { definition, quantity, isBound, stackUpdates, remaining } = entry;

      for (const update of stackUpdates) {
        await PlayerItem.increment(
          { quantity: update.add },
          { where: { player_item_id: update.player_item_id }, transaction }
        );
      }

      let stillRemaining = remaining;
      while (stillRemaining > 0) {
        const slotQuantity = Math.min(stillRemaining, definition.max_stack);
        const row = await PlayerItem.create(
          {
            character_id: characterId,
            item_definition_id: definition.item_definition_id,
            quantity: slotQuantity,
            is_bound: isBound,
            acquired_at: new Date()
          },
          { transaction }
        );
        added.push({
          item_definition_id: definition.item_definition_id,
          quantity: slotQuantity,
          player_item_id: row.player_item_id
        });
        stillRemaining -= slotQuantity;
      }

      for (const update of stackUpdates) {
        added.push({
          item_definition_id: definition.item_definition_id,
          quantity: update.add,
          player_item_id: update.player_item_id
        });
      }
    }

    if (!externalTransaction) {
      await transaction.commit();
    }

    return {
      success: true,
      added,
      failed: []
    };
  } catch (error) {
    if (!externalTransaction) {
      await transaction.rollback();
    }
    throw error;
  }
}

async function discardItem(characterId, playerItemId, quantity) {
  if (!playerItemId || quantity <= 0) {
    throw new Error('Invalid discard parameters');
  }

  const transaction = await sequelize.transaction();

  try {
    const row = await PlayerItem.findByPk(playerItemId, {
      include: [{ model: ItemDefinition, as: 'ItemDefinition' }],
      transaction
    });

    if (!row) {
      throw new Error('PlayerItem not found');
    }

    if (row.character_id !== characterId) {
      throw new Error('PlayerItem does not belong to character');
    }

    if (row.is_bound) {
      throw new Error('Cannot discard bound item');
    }

    if (quantity > row.quantity) {
      throw new Error('Discard quantity exceeds current quantity');
    }

    const remaining = row.quantity - quantity;

    if (remaining === 0) {
      await row.destroy({ transaction });
    } else {
      row.quantity = remaining;
      await row.save({ transaction });
    }

    await transaction.commit();

    return {
      success: true,
      discarded_quantity: quantity,
      remaining_quantity: remaining,
      player_item_id: playerItemId
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function getInventory(characterId, filters = {}) {
  const { item_type, sort_by = 'acquired_at', sort_order = 'desc' } = filters;

  const where = { character_id: characterId };

  const includeWhere = {};
  if (item_type) {
    includeWhere.item_type = item_type;
  }

  const sortDirection = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  const rarityRank = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };

  const rows = await PlayerItem.findAll({
    where,
    include: [
      {
        model: ItemDefinition,
        as: 'ItemDefinition',
        where: includeWhere
      }
    ]
  });

  rows.sort((a, b) => {
    if (sort_by === 'name') {
      const cmp = a.ItemDefinition.name.localeCompare(b.ItemDefinition.name);
      return sortDirection === 'ASC' ? cmp : -cmp;
    }
    if (sort_by === 'rarity') {
      const rankA = rarityRank[a.ItemDefinition.rarity] || 0;
      const rankB = rarityRank[b.ItemDefinition.rarity] || 0;
      const cmp = rankA - rankB;
      return sortDirection === 'ASC' ? cmp : -cmp;
    }
    const timeA = new Date(a.acquired_at).getTime();
    const timeB = new Date(b.acquired_at).getTime();
    return sortDirection === 'ASC' ? timeA - timeB : timeB - timeA;
  });

  const items = rows.map(row => ({
    player_item_id: row.player_item_id,
    item_definition_id: row.item_definition_id,
    name: row.ItemDefinition.name,
    icon: row.ItemDefinition.icon,
    item_type: row.ItemDefinition.item_type,
    rarity: row.ItemDefinition.rarity,
    quantity: row.quantity,
    max_stack: row.ItemDefinition.max_stack,
    is_bound: row.is_bound,
    acquired_at: row.acquired_at
  }));

  return {
    character_id: characterId,
    slots_used: rows.length,
    slots_total: SLOTS_TOTAL,
    items
  };
}

async function useConsumable(characterId, playerItemId, quantity) {
  if (!playerItemId || quantity <= 0) {
    throw new Error('Invalid use parameters');
  }

  const transaction = await sequelize.transaction();

  try {
    const row = await PlayerItem.findByPk(playerItemId, {
      include: [{ model: ItemDefinition, as: 'ItemDefinition' }],
      transaction
    });

    if (!row) {
      throw new Error('PlayerItem not found');
    }

    if (row.character_id !== characterId) {
      throw new Error('PlayerItem does not belong to character');
    }

    if (row.ItemDefinition.item_type !== 'consumable') {
      throw new Error('Item is not consumable');
    }

    if (quantity > row.quantity) {
      throw new Error('Use quantity exceeds current quantity');
    }

    const character = await Character.findByPk(characterId, { transaction });
    const effect = row.ItemDefinition.consumable_effect || {};
    let restoredHp = 0;
    let restoredMp = 0;

    if (effect.type === 'restore') {
      if (effect.target === 'hp') {
        const before = character.hp;
        character.hp = Math.min(character.hp + effect.value * quantity, character.max_hp);
        restoredHp = character.hp - before;
      } else if (effect.target === 'mp') {
        const before = character.mp;
        character.mp = Math.min(character.mp + effect.value * quantity, character.max_mp);
        restoredMp = character.mp - before;
      }
    }

    await character.save({ transaction });

    const remaining = row.quantity - quantity;
    if (remaining === 0) {
      await row.destroy({ transaction });
    } else {
      row.quantity = remaining;
      await row.save({ transaction });
    }

    await transaction.commit();

    return {
      success: true,
      restored_hp: restoredHp,
      restored_mp: restoredMp,
      new_hp: character.hp,
      new_mp: character.mp,
      remaining_quantity: remaining
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

const EQUIP_SLOT_MAP = {
  weapon: 'equip_weapon_id',
  helmet: 'equip_helmet_id',
  armor: 'equip_armor_id',
  accessory: 'equip_accessory_id'
};

async function _applyEquipmentStats(character, itemDefinition, sign = 1) {
  const stats = itemDefinition.equipment_stats || {};
  if (stats.attack) character.attack += sign * stats.attack;
  if (stats.defense) character.defense += sign * stats.defense;
  if (stats.max_hp) {
    character.max_hp += sign * stats.max_hp;
    character.hp = Math.min(character.hp, character.max_hp);
  }
  if (stats.max_mp) {
    character.max_mp += sign * stats.max_mp;
    character.mp = Math.min(character.mp, character.max_mp);
  }
}

async function equipItem(characterId, playerItemId) {
  if (!playerItemId) {
    throw new Error('playerItemId is required');
  }

  const transaction = await sequelize.transaction();

  try {
    const row = await PlayerItem.findByPk(playerItemId, {
      include: [{ model: ItemDefinition, as: 'ItemDefinition' }],
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!row) {
      throw new Error('PlayerItem not found');
    }

    if (row.character_id !== characterId) {
      throw new Error('PlayerItem does not belong to character');
    }

    const definition = row.ItemDefinition;

    if (definition.item_type !== 'equipment') {
      throw new Error('Item is not equipment');
    }

    if (!definition.equip_slot) {
      throw new Error('Equipment has no equip_slot defined');
    }

    const slotField = EQUIP_SLOT_MAP[definition.equip_slot];
    if (!slotField) {
      throw new Error(`Unknown equip slot: ${definition.equip_slot}`);
    }

    const character = await Character.findByPk(characterId, { transaction });

    let replaced = false;
    const oldItemDefinitionId = character[slotField];

    if (oldItemDefinitionId) {
      const oldDefinition = await ItemDefinition.findByPk(oldItemDefinitionId, { transaction });
      if (oldDefinition) {
        await _applyEquipmentStats(character, oldDefinition, -1);

        // Return old equipment to inventory
        await PlayerItem.create({
          character_id: characterId,
          item_definition_id: oldDefinition.item_definition_id,
          quantity: 1,
          is_bound: false,
          acquired_at: new Date()
        }, { transaction });
      }
      replaced = true;
    }

    // Remove new equipment from inventory
    const remaining = row.quantity - 1;
    if (remaining === 0) {
      await row.destroy({ transaction });
    } else {
      row.quantity = remaining;
      await row.save({ transaction });
    }

    // Apply new equipment stats
    await _applyEquipmentStats(character, definition, 1);
    character[slotField] = definition.item_definition_id;
    await character.save({ transaction });

    await transaction.commit();

    return {
      success: true,
      equipped_slot: definition.equip_slot,
      replaced
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function unequipItem(characterId, slot) {
  if (!slot) {
    throw new Error('slot is required');
  }

  const slotField = EQUIP_SLOT_MAP[slot];
  if (!slotField) {
    throw new Error(`Unknown equip slot: ${slot}`);
  }

  const transaction = await sequelize.transaction();

  try {
    const character = await Character.findByPk(characterId, { transaction });
    if (!character) {
      throw new Error('Character not found');
    }

    const itemDefinitionId = character[slotField];
    if (!itemDefinitionId) {
      throw new Error(`Slot ${slot} is empty`);
    }

    const definition = await ItemDefinition.findByPk(itemDefinitionId, { transaction });
    if (!definition) {
      throw new Error('Equipped item definition not found');
    }

    // Check inventory capacity
    const currentSlots = await PlayerItem.count({
      where: { character_id: characterId },
      transaction
    });

    if (currentSlots >= SLOTS_TOTAL) {
      throw new Error('Inventory full, cannot unequip');
    }

    // Return to inventory
    await PlayerItem.create({
      character_id: characterId,
      item_definition_id: definition.item_definition_id,
      quantity: 1,
      is_bound: false,
      acquired_at: new Date()
    }, { transaction });

    // Remove stats
    await _applyEquipmentStats(character, definition, -1);
    character[slotField] = null;
    await character.save({ transaction });

    await transaction.commit();

    return {
      success: true,
      unequipped_slot: slot,
      item_definition_id: definition.item_definition_id
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

module.exports = {
  SLOTS_TOTAL,
  addItems,
  discardItem,
  getInventory,
  useConsumable,
  equipItem,
  unequipItem
};
