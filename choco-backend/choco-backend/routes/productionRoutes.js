const express = require('express');
const router = express.Router();
const ProductionRecord = require('../models/ProductionRecord');
const crudFactory = require('../controllers/crudFactory');
const { protect, authorize } = require('../middleware/auth');

const c = crudFactory(ProductionRecord, { searchFields: ['factoryName'] });

router.get('/', c.list);
router.get('/:id', c.getOne);
router.post('/', protect, authorize('admin'), c.create);
router.put('/:id', protect, authorize('admin'), c.update);
router.delete('/:id', protect, authorize('admin'), c.remove);

module.exports = router;
