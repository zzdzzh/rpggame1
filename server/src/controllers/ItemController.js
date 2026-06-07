const InventoryService = require('../services/InventoryService');
const ItemService = require('../services/ItemService');

function getIo() {
  try {
    return require('../index').io;
  } catch {
    return null;
  }
}

function broadcastCharacterUpdate(characterId, character) {
  const io = getIo();
  if (io) {
    io.emit('characterUpdate', { character_id: characterId, ...character });
  }
}

class ItemController {
  async getInventory(req, res) {
    try {
      const characterId = req.characterId || Number(req.query.character_id);
      if (!characterId) {
        return res.status(400).json({ error: 'character_id is required' });
      }

      const result = await InventoryService.getInventory(characterId, req.query);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async discardItem(req, res) {
    try {
      const characterId = req.characterId || Number(req.body.character_id);
      const { player_item_id, quantity } = req.body;

      if (!characterId || !player_item_id || quantity === undefined) {
        return res.status(400).json({ error: 'character_id, player_item_id and quantity are required' });
      }

      const result = await InventoryService.discardItem(characterId, Number(player_item_id), Number(quantity));
      res.json(result);
    } catch (error) {
      if (error.message === 'PlayerItem not found') {
        return res.status(404).json({ error: error.message });
      }
      res.status(400).json({ error: error.message });
    }
  }

  async useItem(req, res) {
    try {
      const characterId = req.characterId || Number(req.body.character_id);
      const { player_item_id, quantity } = req.body;

      if (!characterId || !player_item_id || quantity === undefined) {
        return res.status(400).json({ error: 'character_id, player_item_id and quantity are required' });
      }

      const result = await InventoryService.useConsumable(characterId, Number(player_item_id), Number(quantity));
      broadcastCharacterUpdate(characterId, result.character);
      res.json(result);
    } catch (error) {
      if (error.message === 'PlayerItem not found') {
        return res.status(404).json({ error: error.message });
      }
      res.status(400).json({ error: error.message });
    }
  }

  async equipItem(req, res) {
    try {
      const characterId = req.characterId || Number(req.body.character_id);
      const { player_item_id } = req.body;

      if (!characterId || !player_item_id) {
        return res.status(400).json({ error: 'character_id and player_item_id are required' });
      }

      const result = await InventoryService.equipItem(characterId, Number(player_item_id));
      broadcastCharacterUpdate(characterId, result.character);
      res.json(result);
    } catch (error) {
      if (error.message === 'PlayerItem not found') {
        return res.status(404).json({ error: error.message });
      }
      res.status(400).json({ error: error.message });
    }
  }

  async unequipItem(req, res) {
    try {
      const characterId = req.characterId || Number(req.body.character_id);
      const { slot } = req.body;

      if (!characterId || !slot) {
        return res.status(400).json({ error: 'character_id and slot are required' });
      }

      const result = await InventoryService.unequipItem(characterId, slot);
      broadcastCharacterUpdate(characterId, result.character);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async listItemDefinitions(req, res) {
    try {
      const result = await ItemService.findAll(req.query, req.query);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async getItemDefinition(req, res) {
    try {
      const result = await ItemService.findById(Number(req.params.id));
      res.json(result);
    } catch (error) {
      if (error.code === 'NOT_FOUND') {
        return res.status(404).json({ error: error.message });
      }
      res.status(400).json({ error: error.message });
    }
  }

  async createItemDefinition(req, res) {
    try {
      const result = await ItemService.create(req.body);
      res.status(201).json(result);
    } catch (error) {
      if (error.code === 'VALIDATION_ERROR') {
        return res.status(400).json({ error: error.message });
      }
      res.status(400).json({ error: error.message });
    }
  }

  async updateItemDefinition(req, res) {
    try {
      const result = await ItemService.update(Number(req.params.id), req.body);
      res.json(result);
    } catch (error) {
      if (error.code === 'NOT_FOUND') {
        return res.status(404).json({ error: error.message });
      }
      if (error.code === 'VALIDATION_ERROR') {
        return res.status(400).json({ error: error.message });
      }
      res.status(400).json({ error: error.message });
    }
  }

  async deleteItemDefinition(req, res) {
    try {
      await ItemService.remove(Number(req.params.id));
      res.status(204).send();
    } catch (error) {
      if (error.code === 'NOT_FOUND') {
        return res.status(404).json({ error: error.message });
      }
      if (error.code === 'HELD_BY_PLAYERS') {
        return res.status(400).json({ error: error.message });
      }
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new ItemController();
