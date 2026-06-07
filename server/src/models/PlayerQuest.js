const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const PlayerQuest = sequelize.define('PlayerQuest', {
  player_quest_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  character_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  quest_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('accepted', 'in_progress', 'ready_for_reward', 'completed'),
    allowNull: false
  },
  progress_json: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {}
  },
  accepted_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  claimed_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'player_quests',
  underscored: true,
  timestamps: true,
  indexes: [
    { fields: ['character_id', 'status'] },
    { fields: ['character_id', 'quest_id'], unique: true }
  ]
});

module.exports = PlayerQuest;
