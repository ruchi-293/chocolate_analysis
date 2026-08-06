const express = require('express');
const router = express.Router();
const SalesTransaction = require('../models/SalesTransaction');
const crudFactory = require('../controllers/crudFactory');
const { protect, authorize } = require('../middleware/auth');

const c = crudFactory(SalesTransaction, { searchFields: ['productName', 'region', 'country', 'channel'] });

router.get('/', protect, c.list);
router.get('/:id', protect, c.getOne);
router.post('/', protect, authorize('admin'), c.create);
router.put('/:id', protect, authorize('admin'), c.update);
router.delete('/:id', protect, authorize('admin'), c.remove);

module.exports = router;
