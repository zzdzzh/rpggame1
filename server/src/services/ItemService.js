const { ItemDefinition, PlayerItem, Character, sequelize } = require('../models');
const { Op } = require('sequelize');

const VALID_ITEM_TYPES = ['consumable', 'equipment', 'material', 'quest'];
const VALID_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const VALID_EQUIP_SLOTS = ['weapon', 'helmet', 'armor', 'accessory'];

function validateItemDefinition(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate || data.name !== undefined) {
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      errors.push('name is required');
    }
  }

  if (!isUpdate || data.item_type !== undefined) {
    if (!VALID_ITEM_TYPES.includes(data.item_type)) {
      errors.push(`item_type must be one of: ${VALID_ITEM_TYPES.join(', ')}`);
    }
  }

  if (data.rarity !== undefined && !VALID_RARITIES.includes(data.rarity)) {
    errors.push(`rarity must be one of: ${VALID_RARITIES.join(', ')}`);
  }

  if (data.max_stack !== undefined) {
    const maxStack = Number(data.max_stack);
    if (!Number.isInteger(maxStack) || maxStack < 1) {
      errors.push('max_stack must be an integer >= 1');
    }
  }

  const itemType = data.item_type;

  if (itemType === 'consumable') {
    const effect = data.consumable_effect;
    if (!isUpdate || effect !== undefined) {
      if (!effect || typeof effect !== 'object') {
        errors.push('consumable_effect is required for consumable items');
      } else {
        if (!effect.type) errors.push('consumable_effect.type is required');
        if (!effect.target) errors.push('consumable_effect.target is required');
        if (effect.value === undefined) errors.push('consumable_effect.value is required');
      }
    }
  }

  if (itemType === 'equipment') {
    if (!isUpdate || data.equipment_stats !== undefined) {
      if (!data.equipment_stats || typeof data.equipment_stats !== 'object') {
        errors.push('equipment_stats is required for equipment items');
      }
    }
    if (!isUpdate || data.equip_slot !== undefined) {
      if (!VALID_EQUIP_SLOTS.includes(data.equip_slot)) {
        errors.push(`equip_slot must be one of: ${VALID_EQUIP_SLOTS.join(', ')}`);
      }
    }
    if (data.max_stack !== undefined && Number(data.max_stack) !== 1) {
      errors.push('equipment max_stack must be 1');
    }
  }

  return errors;
}

async function create(data) {
  const errors = validateItemDefinition(data);
  if (errors.length > 0) {
    const error = new Error(errors.join('; '));
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  const definition = await ItemDefinition.create(data);
  return definition;
}

async function findAll(filters = {}, pagination = {}) {
  const { name, item_type, rarity } = filters;
  const page = Math.max(1, Number(pagination.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(pagination.page_size) || 20));

  const where = {};
  if (name) {
    where.name = { [Op.like]: `%${name}%` };
  }
  if (item_type) {
    where.item_type = item_type;
  }
  if (rarity) {
    where.rarity = rarity;
  }

  const { count, rows } = await ItemDefinition.findAndCountAll({
    where,
    order: [['item_definition_id', 'ASC']],
    limit: pageSize,
    offset: (page - 1) * pageSize
  });

  return {
    total: count,
    page,
    page_size: pageSize,
    items: rows
  };
}

async function findById(id) {
  const definition = await ItemDefinition.findByPk(id);
  if (!definition) {
    const error = new Error('ItemDefinition not found');
    error.code = 'NOT_FOUND';
    throw error;
  }
  return definition;
}

async function update(id, data) {
  const definition = await ItemDefinition.findByPk(id);
  if (!definition) {
    const error = new Error('ItemDefinition not found');
    error.code = 'NOT_FOUND';
    throw error;
  }

  const merged = {
    item_type: data.item_type !== undefined ? data.item_type : definition.item_type,
    ...data
  };

  const errors = validateItemDefinition(merged, true);
  if (errors.length > 0) {
    const error = new Error(errors.join('; '));
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  const oldEquipmentStats = definition.equipment_stats || {};
  const newEquipmentStats = data.equipment_stats;
  const statsChanged =
    newEquipmentStats !== undefined &&
    JSON.stringify(oldEquipmentStats) !== JSON.stringify(newEquipmentStats);

  await definition.update(data);

  if (statsChanged && definition.item_type === 'equipment') {
    await recalculateEquippedCharacters(id, oldEquipmentStats, newEquipmentStats || {});
  }

  return definition;
}

async function remove(id) {
  const definition = await ItemDefinition.findByPk(id);
  if (!definition) {
    const error = new Error('ItemDefinition not found');
    error.code = 'NOT_FOUND';
    throw error;
  }

  const heldCount = await PlayerItem.count({
    where: { item_definition_id: id }
  });

  if (heldCount > 0) {
    const error = new Error('Cannot delete item definition that is held by players');
    error.code = 'HELD_BY_PLAYERS';
    throw error;
  }

  await definition.destroy();
}

async function recalculateEquippedCharacters(itemDefinitionId, oldStats, newStats) {
  const slotFields = ['equip_weapon_id', 'equip_helmet_id', 'equip_armor_id', 'equip_accessory_id'];

  for (const slotField of slotFields) {
    const characters = await Character.findAll({
      where: {
        [slotField]: { [Op.ne]: null }
      }
    });

    for (const character of characters) {
      const playerItem = await PlayerItem.findByPk(character[slotField]);
      if (!playerItem || playerItem.item_definition_id !== itemDefinitionId) continue;

      const diffAttack = (newStats.attack || 0) - (oldStats.attack || 0);
      const diffDefense = (newStats.defense || 0) - (oldStats.defense || 0);
      const diffMaxHp = (newStats.max_hp || 0) - (oldStats.max_hp || 0);
      const diffMaxMp = (newStats.max_mp || 0) - (oldStats.max_mp || 0);

      character.attack = Math.max(0, character.attack + diffAttack);
      character.defense = Math.max(0, character.defense + diffDefense);
      character.max_hp = Math.max(1, character.max_hp + diffMaxHp);
      character.max_mp = Math.max(0, character.max_mp + diffMaxMp);
      character.hp = Math.min(character.hp, character.max_hp);
      character.mp = Math.min(character.mp, character.max_mp);

      await character.save();
    }
  }
}

module.exports = {
  create,
  findAll,
  findById,
  update,
  remove,
  recalculateEquippedCharacters
};
