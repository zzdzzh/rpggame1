const sequelize = require('../config/sequelize');
const Character = require('./Character');
const ItemDefinition = require('./ItemDefinition');
const PlayerItem = require('./PlayerItem');

// Define relationships
Character.hasMany(PlayerItem, {
  foreignKey: 'character_id',
  as: 'playerItems'
});

PlayerItem.belongsTo(Character, {
  foreignKey: 'character_id',
  as: 'character'
});

ItemDefinition.hasMany(PlayerItem, {
  foreignKey: 'item_definition_id',
  as: 'playerItems'
});

PlayerItem.belongsTo(ItemDefinition, {
  foreignKey: 'item_definition_id',
  as: 'ItemDefinition'
});

module.exports = {
  sequelize,
  Character,
  ItemDefinition,
  PlayerItem
};
