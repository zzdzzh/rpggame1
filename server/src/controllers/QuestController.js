const QuestService = require('../services/QuestService');

class QuestController {
  async getAvailableQuests(req, res) {
    try {
      const characterId = req.characterId || Number(req.query.character_id);
      if (!characterId) {
        return res.status(400).json({ error: 'character_id is required' });
      }

      const result = await QuestService.getAvailableQuests(characterId, req.query);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async acceptQuest(req, res) {
    try {
      const characterId = req.characterId || Number(req.body.character_id);
      const questId = Number(req.params.questId);

      if (!characterId) {
        return res.status(400).json({ error: 'character_id is required' });
      }
      if (!questId) {
        return res.status(400).json({ error: 'questId is required' });
      }

      const result = await QuestService.acceptQuest(characterId, questId);
      res.json(result);
    } catch (error) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json({ error: error.message });
    }
  }

  async getMyQuests(req, res) {
    try {
      const characterId = req.characterId || Number(req.query.character_id);
      if (!characterId) {
        return res.status(400).json({ error: 'character_id is required' });
      }

      const result = await QuestService.getMyQuests(characterId, req.query);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new QuestController();
