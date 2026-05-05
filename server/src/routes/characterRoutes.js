const express = require('express');
const router = express.Router();
const characterController = require('../controllers/CharacterController');

router.post('/', characterController.create);
router.get('/', characterController.getAll);
router.get('/:id', characterController.getById);
router.put('/:id/position', characterController.updatePosition);
router.post('/:id/teleport', characterController.teleport);
router.get('/map/:mapId', characterController.getByMap);

module.exports = router;
