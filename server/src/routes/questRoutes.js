const express = require('express');
const QuestController = require('../controllers/QuestController');

const router = express.Router();

router.get('/available', QuestController.getAvailableQuests);
router.post('/:questId/accept', QuestController.acceptQuest);
router.get('/my', QuestController.getMyQuests);
router.post('/:playerQuestId/submit', QuestController.submitQuest);

module.exports = router;
