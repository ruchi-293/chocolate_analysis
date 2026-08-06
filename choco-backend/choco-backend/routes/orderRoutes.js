const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const crudFactory = require('../controllers/crudFactory');
const { protect, authorize } = require('../middleware/auth');

const c = crudFactory(Order, { searchFields: ['orderNumber', 'customerName', 'country'] });

// Orders contain business-sensitive data — registered users and admins only
router.get('/', protect, c.list);
router.get('/:id', protect, c.getOne);
router.post('/', protect, authorize('admin'), c.create);
router.put('/:id', protect, authorize('admin'), c.update);
router.delete('/:id', protect, authorize('admin'), c.remove);

module.exports = router;
