const express = require('express');
const router = express.Router();
const products = require('../controllers/productController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Public: anyone can view the dataset listing (read-only, high-level)
router.get('/', products.list);
router.get('/:id', products.getOne);

// Registered users & admins: download reports
router.get('/export/csv', protect, products.exportCSVFile);
router.get('/export/excel', protect, products.exportExcelFile);
router.get('/export/pdf', protect, products.exportPDFFile);

// Admin only: create / edit / delete / import
router.post('/', protect, authorize('admin'), products.create);
router.put('/:id', protect, authorize('admin'), products.update);
router.delete('/:id', protect, authorize('admin'), products.remove);
router.post('/import', protect, authorize('admin'), upload.single('file'), products.importFile);
router.post('/import-csv', protect, authorize('admin'), upload.single('file'), products.importFile); // back-compat alias

module.exports = router;
