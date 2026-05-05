const Character = require('../models/Character');

class CharacterService {
  constructor() {
    this.positionUpdateInterval = null;
  }

  async createCharacter(characterData) {
    return await Character.create(characterData);
  }

  async getCharacterById(characterId) {
    return await Character.findByPk(characterId);
  }

  async getAllCharacters() {
    return await Character.findAll();
  }

  async updateCharacterPosition(characterId, x, y) {
    const character = await Character.findByPk(characterId);
    if (!character) {
      throw new Error('Character not found');
    }
    character.x = x;
    character.y = y;
    await character.save();
    return character;
  }

  async updateCharacterMap(characterId, mapId, x, y) {
    const character = await Character.findByPk(characterId);
    if (!character) {
      throw new Error('Character not found');
    }
    character.map_id = mapId;
    character.x = x;
    character.y = y;
    await character.save();
    return character;
  }

  async getCharactersByMap(mapId) {
    return await Character.findAll({
      where: { map_id: mapId }
    });
  }

  startPositionBroadcast(callback, intervalMs = 3000) {
    if (this.positionUpdateInterval) {
      clearInterval(this.positionUpdateInterval);
    }

    this.positionUpdateInterval = setInterval(async () => {
      try {
        const characters = await this.getAllCharacters();
        const positionData = characters.map(c => ({
          characterId: c.character_id,
          name: c.name,
          characterType: c.character_type,
          mapId: c.map_id,
          x: c.x,
          y: c.y
        }));
        callback(positionData);
      } catch (error) {
        console.error('Error broadcasting positions:', error);
      }
    }, intervalMs);

    return this.positionUpdateInterval;
  }

  stopPositionBroadcast() {
    if (this.positionUpdateInterval) {
      clearInterval(this.positionUpdateInterval);
      this.positionUpdateInterval = null;
    }
  }
}

module.exports = new CharacterService();
