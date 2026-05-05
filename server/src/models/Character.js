const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Character = sequelize.define('Character', {
  character_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  character_type: {
    type: DataTypes.ENUM('player', 'monster', 'npc'),
    defaultValue: 'player'
  },
  map_id: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  x: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  y: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  level: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  hp: {
    type: DataTypes.INTEGER,
    defaultValue: 100
  },
  max_hp: {
    type: DataTypes.INTEGER,
    defaultValue: 100
  },
  mp: {
    type: DataTypes.INTEGER,
    defaultValue: 50
  },
  max_mp: {
    type: DataTypes.INTEGER,
    defaultValue: 50
  },
  attack: {
    type: DataTypes.INTEGER,
    defaultValue: 10
  },
  defense: {
    type: DataTypes.INTEGER,
    defaultValue: 5
  },
  move_speed: {
    type: DataTypes.FLOAT,
    defaultValue: 200
  },
  exp: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  gold: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'characters',
  underscored: true,
  timestamps: true
});

module.exports = Character;
