const express = require('express');
const router = express.Router();
const BlockController = require('../controllers/blockController');

// Block CRUD routes
router.get('/', BlockController.getAllBlocks);
router.get('/stats', BlockController.getStatistics);
router.get('/:id', BlockController.getBlock);
router.post('/', BlockController.createBlock);
router.put('/:id', BlockController.updateBlock);
router.delete('/:id', BlockController.deleteBlock);

// Bulk operations
router.post('/bulk', BlockController.bulkSaveBlocks);

// Camera state routes
router.get('/camera/state', BlockController.getCameraState);
router.put('/camera/state', BlockController.saveCameraState);

module.exports = router;