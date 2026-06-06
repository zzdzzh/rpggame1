const express = require('express');
const ItemController = require('../controllers/ItemController');

const router = express.Router();

router.get('/inventory', ItemController.getInventory);
router.post('/inventory/discard', ItemController.discardItem);

module.exports = router;
