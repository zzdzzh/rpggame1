const sequelize = require('../config/sequelize');
const Character = require('./Character');
const ItemDefinition = require('./ItemDefinition');
const PlayerItem = require('./PlayerItem');
const Quest = require('./Quest');
const PlayerQuest = require('./PlayerQuest');

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

Quest.hasMany(PlayerQuest, { foreignKey: 'quest_id' });
PlayerQuest.belongsTo(Quest, { foreignKey: 'quest_id' });

Character.hasMany(PlayerQuest, { foreignKey: 'character_id' });
PlayerQuest.belongsTo(Character, { foreignKey: 'character_id' });

module.exports = {
  sequelize,
  Character,
  ItemDefinition,
  PlayerItem,
  Quest,
  PlayerQuest
};
