const sequelize = require('../config/sequelize');
const Character = require('./Character');
const ItemDefinition = require('./ItemDefinition');
const PlayerItem = require('./PlayerItem');

Character.hasMany(PlayerItem, { foreignKey: 'character_id' });
PlayerItem.belongsTo(Character, { foreignKey: 'character_id' });

ItemDefinition.hasMany(PlayerItem, { foreignKey: 'item_definition_id' });
PlayerItem.belongsTo(ItemDefinition, { foreignKey: 'item_definition_id' });

module.exports = {
  sequelize,
  Character,
  ItemDefinition,
  PlayerItem
};
