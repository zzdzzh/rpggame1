const InventoryService = require('../services/InventoryService');

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
}

module.exports = new ItemController();
