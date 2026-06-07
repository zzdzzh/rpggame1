const QuestAdminService = require('../services/QuestAdminService');

class QuestAdminController {
  async listQuests(req, res) {
    try {
      const result = await QuestAdminService.listQuests(req.query);
      res.json(result);
    } catch (error) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json({ error: error.message });
    }
  }

  async getQuestDetail(req, res) {
    try {
      const questId = Number(req.params.questId);
      if (!Number.isFinite(questId) || questId <= 0) {
        return res.status(400).json({ error: 'questId is required' });
      }

      const result = await QuestAdminService.getQuestDetail(questId);
      res.json(result);
    } catch (error) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json({ error: error.message });
    }
  }

  async createQuest(req, res) {
    try {
      const result = await QuestAdminService.createQuest(req.body);
      res.status(201).json(result);
    } catch (error) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json({ error: error.message });
    }
  }

  async updateQuest(req, res) {
    try {
      const questId = Number(req.params.questId);
      if (!Number.isFinite(questId) || questId <= 0) {
        return res.status(400).json({ error: 'questId is required' });
      }

      const result = await QuestAdminService.updateQuest(questId, req.body);
      res.json(result);
    } catch (error) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json({ error: error.message });
    }
  }

  async deleteQuest(req, res) {
    try {
      const questId = Number(req.params.questId);
      if (!Number.isFinite(questId) || questId <= 0) {
        return res.status(400).json({ error: 'questId is required' });
      }

      const result = await QuestAdminService.deleteQuest(questId);
      res.json(result);
    } catch (error) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json({ error: error.message });
    }
  }

  async toggleQuestActive(req, res) {
    try {
      const questId = Number(req.params.questId);
      if (!Number.isFinite(questId) || questId <= 0) {
        return res.status(400).json({ error: 'questId is required' });
      }

      const result = await QuestAdminService.toggleQuestActive(questId);
      res.json(result);
    } catch (error) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json({ error: error.message });
    }
  }
}

module.exports = new QuestAdminController();
