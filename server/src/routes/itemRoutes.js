const express = require('express');
const ItemController = require('../controllers/ItemController');

const router = express.Router();

router.get('/inventory', ItemController.getInventory);
router.post('/inventory/discard', ItemController.discardItem);
router.post('/inventory/use', ItemController.useItem);
router.post('/inventory/equip', ItemController.equipItem);
router.post('/inventory/unequip', ItemController.unequipItem);

router.get('/admin/items', ItemController.listItemDefinitions);
router.get('/admin/items/:id', ItemController.getItemDefinition);
router.post('/admin/items', ItemController.createItemDefinition);
router.put('/admin/items/:id', ItemController.updateItemDefinition);
router.delete('/admin/items/:id', ItemController.deleteItemDefinition);

module.exports = router;
