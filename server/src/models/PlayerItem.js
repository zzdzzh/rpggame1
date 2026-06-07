const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const PlayerItem = sequelize.define('PlayerItem', {
  player_item_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  character_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  item_definition_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  is_bound: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  acquired_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'player_items',
  underscored: true,
  timestamps: false
});

module.exports = PlayerItem;
