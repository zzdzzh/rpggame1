const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Quest = sequelize.define('Quest', {
  quest_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  description: {
    type: DataTypes.TEXT
  },
  quest_type: {
    type: DataTypes.ENUM('main', 'side', 'daily'),
    allowNull: false
  },
  level_min: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  level_max: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  trigger_conditions_json: {
    type: DataTypes.JSON,
    allowNull: false
  },
  prerequisites_json: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  },
  objectives_json: {
    type: DataTypes.JSON,
    allowNull: false
  },
  rewards_json: {
    type: DataTypes.JSON,
    allowNull: false
  },
  max_concurrent_limit: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  tableName: 'quests',
  underscored: true,
  timestamps: true,
  indexes: [
    { fields: ['is_active'] },
    { fields: ['quest_type'] }
  ]
});

module.exports = Quest;
