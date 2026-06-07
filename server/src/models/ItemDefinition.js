const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const ItemDefinition = sequelize.define('ItemDefinition', {
  item_definition_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  item_type: {
    type: DataTypes.ENUM('consumable', 'equipment', 'material', 'quest'),
    allowNull: false
  },
  rarity: {
    type: DataTypes.ENUM('common', 'uncommon', 'rare', 'epic', 'legendary'),
    defaultValue: 'common'
  },
  icon: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  max_stack: {
    type: DataTypes.INTEGER,
    defaultValue: 99
  },
  level_requirement: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  is_bind_on_pickup: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  consumable_effect: {
    type: DataTypes.JSON,
    allowNull: true
  },
  equipment_stats: {
    type: DataTypes.JSON,
    allowNull: true
  },
  equip_slot: {
    type: DataTypes.ENUM('weapon', 'helmet', 'armor', 'accessory'),
    allowNull: true
  }
}, {
  tableName: 'item_definitions',
  underscored: true,
  timestamps: true
});

module.exports = ItemDefinition;
