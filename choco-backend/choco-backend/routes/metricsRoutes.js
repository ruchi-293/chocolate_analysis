const express = require('express');
const router = express.Router();
const metrics = require('../controllers/metricsController');

router.get('/production-trend', metrics.productionTrend);
router.get('/production-by-factory', metrics.productionByFactory);
router.get('/sustainability-trend', metrics.sustainabilityTrend);
router.get('/market-trend', metrics.marketTrend);
router.get('/regional', metrics.regional);

module.exports = router;
