const express = require('express');
const QuestAdminController = require('../controllers/QuestAdminController');

const router = express.Router();

router.get('/', QuestAdminController.listQuests);
router.post('/', QuestAdminController.createQuest);
router.get('/:questId', QuestAdminController.getQuestDetail);
router.put('/:questId', QuestAdminController.updateQuest);
router.delete('/:questId', QuestAdminController.deleteQuest);
router.post('/:questId/toggle', QuestAdminController.toggleQuestActive);

module.exports = router;
