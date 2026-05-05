const express = require('express');
const BackgroundController = require('../controllers/BackgroundController');

const router = express.Router();

router.get('/backgrounds', BackgroundController.getBackgroundInfo);
router.get('/backgrounds/:filename/dimensions', BackgroundController.getBackgroundDimensions);

module.exports = router;