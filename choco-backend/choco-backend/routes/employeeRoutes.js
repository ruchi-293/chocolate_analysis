const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const crudFactory = require('../controllers/crudFactory');
const { protect, authorize } = require('../middleware/auth');

const c = crudFactory(Employee, { searchFields: ['fullName', 'role', 'department', 'factoryName'] });

router.get('/', protect, authorize('admin'), c.list);
router.get('/:id', protect, authorize('admin'), c.getOne);
router.post('/', protect, authorize('admin'), c.create);
router.put('/:id', protect, authorize('admin'), c.update);
router.delete('/:id', protect, authorize('admin'), c.remove);

module.exports = router;
