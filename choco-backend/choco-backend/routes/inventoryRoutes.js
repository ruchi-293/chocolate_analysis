const express = require('express');
const router = express.Router();
const InventorySnapshot = require('../models/InventorySnapshot');
const crudFactory = require('../controllers/crudFactory');
const { protect, authorize } = require('../middleware/auth');

const c = crudFactory(InventorySnapshot, { searchFields: ['productName', 'warehouseLocation'] });

router.get('/', protect, c.list);
router.get('/:id', protect, c.getOne);
router.post('/', protect, authorize('admin'), c.create);
router.put('/:id', protect, authorize('admin'), c.update);
router.delete('/:id', protect, authorize('admin'), c.remove);

module.exports = router;
