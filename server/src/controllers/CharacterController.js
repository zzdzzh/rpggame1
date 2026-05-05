const characterService = require('../services/CharacterService');

class CharacterController {
  async create(req, res) {
    try {
      const character = await characterService.createCharacter(req.body);
      res.status(201).json({
        success: true,
        data: character
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getById(req, res) {
    try {
      const character = await characterService.getCharacterById(req.params.id);
      if (!character) {
        return res.status(404).json({
          success: false,
          error: 'Character not found'
        });
      }
      res.json({
        success: true,
        data: character
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getAll(req, res) {
    try {
      const characters = await characterService.getAllCharacters();
      res.json({
        success: true,
        data: characters
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async updatePosition(req, res) {
    try {
      const { id } = req.params;
      const { x, y } = req.body;
      const character = await characterService.updateCharacterPosition(id, x, y);
      res.json({
        success: true,
        data: character
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async teleport(req, res) {
    try {
      const { id } = req.params;
      const { mapId, x, y } = req.body;
      const character = await characterService.updateCharacterMap(id, mapId, x, y);
      res.json({
        success: true,
        data: character
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getByMap(req, res) {
    try {
      const { mapId } = req.params;
      const characters = await characterService.getCharactersByMap(mapId);
      res.json({
        success: true,
        data: characters
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new CharacterController();
