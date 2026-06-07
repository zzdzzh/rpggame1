const { Character, ItemDefinition, PlayerItem, sequelize } = require('../models');

const SLOTS_TOTAL = 200;

const EQUIP_SLOT_FIELDS = {
  weapon: 'equip_weapon_id',
  helmet: 'equip_helmet_id',
  armor: 'equip_armor_id',
  accessory: 'equip_accessory_id'
};

async function addItems(characterId, items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('items must be a non-empty array');
  }

  const transaction = await sequelize.transaction();

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

    await transaction.commit();

    return {
      success: true,
      added,
      failed: []
    };
  } catch (error) {
    await transaction.rollback();
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
      include: [{ model: ItemDefinition }],
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
      include: [{ model: ItemDefinition }],
      transaction
    });

    if (!row) {
      throw new Error('PlayerItem not found');
    }

    if (row.character_id !== characterId) {
      throw new Error('PlayerItem does not belong to character');
    }

    if (row.ItemDefinition.item_type !== 'consumable') {
      throw new Error('Item is not a consumable');
    }

    if (quantity > row.quantity) {
      throw new Error('Use quantity exceeds current quantity');
    }

    const effect = row.ItemDefinition.consumable_effect;
    if (!effect || !effect.type || !effect.target || effect.value === undefined) {
      throw new Error('Invalid consumable effect configuration');
    }

    const character = await Character.findByPk(characterId, { transaction });
    if (!character) {
      throw new Error('Character not found');
    }

    let actualValue = 0;
    let reason = null;

    if (effect.type === 'restore') {
      if (effect.target === 'hp') {
        const before = character.hp;
        const after = Math.min(character.hp + effect.value, character.max_hp);
        actualValue = after - before;
        if (actualValue < effect.value) {
          reason = 'capped_by_max_hp';
        }
        character.hp = after;
      } else if (effect.target === 'mp') {
        const before = character.mp;
        const after = Math.min(character.mp + effect.value, character.max_mp);
        actualValue = after - before;
        if (actualValue < effect.value) {
          reason = 'capped_by_max_mp';
        }
        character.mp = after;
      } else {
        throw new Error(`Unsupported restore target: ${effect.target}`);
      }
    } else {
      throw new Error(`Unsupported consumable effect type: ${effect.type}`);
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
      effect: {
        type: effect.type,
        target: effect.target,
        value: effect.value,
        actual_value: actualValue,
        reason
      },
      character: {
        character_id: character.character_id,
        hp: character.hp,
        max_hp: character.max_hp,
        mp: character.mp,
        max_mp: character.max_mp
      },
      remaining_quantity: remaining,
      player_item_id: playerItemId
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function equipItem(characterId, playerItemId) {
  const transaction = await sequelize.transaction();

  try {
    const row = await PlayerItem.findByPk(playerItemId, {
      include: [{ model: ItemDefinition }],
      transaction
    });

    if (!row) {
      throw new Error('PlayerItem not found');
    }

    if (row.character_id !== characterId) {
      throw new Error('PlayerItem does not belong to character');
    }

    if (row.ItemDefinition.item_type !== 'equipment') {
      throw new Error('Item is not equipment');
    }

    const slot = row.ItemDefinition.equip_slot;
    if (!slot || !EQUIP_SLOT_FIELDS[slot]) {
      throw new Error('Invalid equipment slot');
    }

    const character = await Character.findByPk(characterId, { transaction });
    if (!character) {
      throw new Error('Character not found');
    }

    const slotField = EQUIP_SLOT_FIELDS[slot];
    const previousItemId = character[slotField];
    let previousItem = null;

    if (previousItemId) {
      const prevRow = await PlayerItem.findByPk(previousItemId, {
        include: [{ model: ItemDefinition }],
        transaction
      });
      if (prevRow) {
        previousItem = {
          player_item_id: prevRow.player_item_id,
          name: prevRow.ItemDefinition.name
        };
        const stats = prevRow.ItemDefinition.equipment_stats || {};
        character.attack = Math.max(0, character.attack - (stats.attack || 0));
        character.defense = Math.max(0, character.defense - (stats.defense || 0));
        character.max_hp = Math.max(1, character.max_hp - (stats.max_hp || 0));
        character.max_mp = Math.max(0, character.max_mp - (stats.max_mp || 0));
        character.hp = Math.min(character.hp, character.max_hp);
        character.mp = Math.min(character.mp, character.max_mp);
      }
    }

    const newStats = row.ItemDefinition.equipment_stats || {};
    character.attack += (newStats.attack || 0);
    character.defense += (newStats.defense || 0);
    character.max_hp += (newStats.max_hp || 0);
    character.max_mp += (newStats.max_mp || 0);
    character.hp = Math.min(character.hp, character.max_hp);
    character.mp = Math.min(character.mp, character.max_mp);

    character[slotField] = playerItemId;
    await character.save({ transaction });

    await transaction.commit();

    return {
      success: true,
      equipped_slot: slot,
      previous_item: previousItem,
      character: {
        character_id: character.character_id,
        attack: character.attack,
        defense: character.defense,
        max_hp: character.max_hp,
        max_mp: character.max_mp,
        hp: character.hp,
        mp: character.mp
      }
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function unequipItem(characterId, slot) {
  if (!slot || !EQUIP_SLOT_FIELDS[slot]) {
    throw new Error('Invalid slot');
  }

  const transaction = await sequelize.transaction();

  try {
    const character = await Character.findByPk(characterId, { transaction });
    if (!character) {
      throw new Error('Character not found');
    }

    const slotField = EQUIP_SLOT_FIELDS[slot];
    const playerItemId = character[slotField];

    if (!playerItemId) {
      throw new Error('No item equipped in this slot');
    }

    const row = await PlayerItem.findByPk(playerItemId, {
      include: [{ model: ItemDefinition }],
      transaction
    });

    if (!row) {
      throw new Error('Equipped item not found in inventory');
    }

    const stats = row.ItemDefinition.equipment_stats || {};
    character.attack = Math.max(0, character.attack - (stats.attack || 0));
    character.defense = Math.max(0, character.defense - (stats.defense || 0));
    character.max_hp = Math.max(1, character.max_hp - (stats.max_hp || 0));
    character.max_mp = Math.max(0, character.max_mp - (stats.max_mp || 0));
    character.hp = Math.min(character.hp, character.max_hp);
    character.mp = Math.min(character.mp, character.max_mp);

    character[slotField] = null;
    await character.save({ transaction });

    await transaction.commit();

    return {
      success: true,
      unequipped_item: {
        player_item_id: row.player_item_id,
        name: row.ItemDefinition.name
      },
      character: {
        character_id: character.character_id,
        attack: character.attack,
        defense: character.defense,
        max_hp: character.max_hp,
        max_mp: character.max_mp,
        hp: character.hp,
        mp: character.mp
      }
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function recalculateCharacterStats(character, transaction) {
  const slots = ['equip_weapon_id', 'equip_helmet_id', 'equip_armor_id', 'equip_accessory_id'];
  let bonus = { attack: 0, defense: 0, max_hp: 0, max_mp: 0 };

  for (const slotField of slots) {
    const itemId = character[slotField];
    if (!itemId) continue;

    const row = await PlayerItem.findByPk(itemId, {
      include: [{ model: ItemDefinition }],
      transaction
    });

    if (row && row.ItemDefinition.equipment_stats) {
      const stats = row.ItemDefinition.equipment_stats;
      bonus.attack += stats.attack || 0;
      bonus.defense += stats.defense || 0;
      bonus.max_hp += stats.max_hp || 0;
      bonus.max_mp += stats.max_mp || 0;
    }
  }

  return bonus;
}

module.exports = {
  SLOTS_TOTAL,
  addItems,
  discardItem,
  getInventory,
  useConsumable,
  equipItem,
  unequipItem,
  recalculateCharacterStats
};
