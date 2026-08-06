const express = require('express');
const router = express.Router();
const analytics = require('../controllers/analyticsController');
const { protect, optionalAuth } = require('../middleware/auth');

// Public dashboard — high level only
router.get('/overview', analytics.overview);
router.get('/sales-by-variety', analytics.salesByVariety);
router.get('/sales-by-country', analytics.salesByCountry);
router.get('/factory-performance', optionalAuth, analytics.factoryPerformance);

// Registered users + admin only — deeper business insight
router.get('/inventory-status', protect, analytics.inventoryStatus);
router.get('/demand-forecast', protect, analytics.demandForecast);
router.get('/top-products', protect, analytics.topProducts);
router.get('/quality-stats', protect, analytics.qualityStats);

module.exports = router;
