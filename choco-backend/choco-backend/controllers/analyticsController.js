const Product = require('../models/Product');
const Factory = require('../models/Factory');
const Order = require('../models/Order');
const MonthlyMetric = require('../models/MonthlyMetric');
const ProductionRecord = require('../models/ProductionRecord');

// GET /api/analytics/overview  (public — high level only)
exports.overview = async (req, res) => {
  try {
    const [totalProducts, factoryCount, revenueAgg, recordCount] = await Promise.all([
      Product.countDocuments({ isActive: true }),
      Factory.countDocuments(),
      Product.aggregate([{ $group: { _id: null, revenue: { $sum: '$revenueMonthly' } } }]),
      ProductionRecord.countDocuments(),
    ]);

    let totalProductionTons = 0;
    if (recordCount > 0) {
      const agg = await ProductionRecord.aggregate([
        { $match: { date: { $gte: new Date(Date.now() - 30 * 86400000) } } },
        { $group: { _id: null, tons: { $sum: '$unitsProducedTons' } } },
      ]);
      totalProductionTons = Math.round(agg[0]?.tons || 0);
    } else {
      const latestMetric = await MonthlyMetric.findOne().sort({ year: -1, month: -1 });
      totalProductionTons = latestMetric?.productionTons || 0;
    }

    res.json({
      success: true,
      data: {
        totalActiveProducts: totalProducts,
        activeFactories: factoryCount,
        totalMonthlyRevenue: revenueAgg[0]?.revenue || 0,
        totalProductionTons,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load overview', error: err.message });
  }
};

// GET /api/analytics/sales-by-variety  (public)
exports.salesByVariety = async (req, res) => {
  try {
    const rows = await Product.aggregate([
      { $group: { _id: '$variety', revenue: { $sum: '$revenueMonthly' }, units: { $sum: '$unitsProducedMonthly' } } },
      { $sort: { revenue: -1 } },
    ]);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load sales analytics', error: err.message });
  }
};

// GET /api/analytics/sales-by-country  (public)
exports.salesByCountry = async (req, res) => {
  try {
    const rows = await Product.aggregate([
      { $match: { country: { $ne: null } } },
      { $group: { _id: '$country', revenue: { $sum: '$revenueMonthly' } } },
      { $sort: { revenue: -1 } },
      { $limit: 15 },
    ]);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load regional analytics', error: err.message });
  }
};

// GET /api/analytics/factory-performance  (public: aggregate only; full detail requires login)
exports.factoryPerformance = async (req, res) => {
  try {
    const factories = await Factory.find().select(
      req.user ? '' : 'name location outputTonsPerMonth efficiencyScore status' // hide capacity/employee count from guests
    );
    res.json({ success: true, data: factories });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load factory performance', error: err.message });
  }
};

// GET /api/analytics/inventory-status  (registered users + admin only — not public)
exports.inventoryStatus = async (req, res) => {
  try {
    const lowStock = await Product.find({ $expr: { $lte: ['$stockQuantity', '$reorderLevel'] } })
      .select('productName stockQuantity reorderLevel factory');
    const totalStockValue = await Product.aggregate([
      { $group: { _id: null, value: { $sum: { $multiply: ['$stockQuantity', '$unitPrice'] } } } },
    ]);
    res.json({
      success: true,
      data: { lowStockItems: lowStock, totalStockValue: totalStockValue[0]?.value || 0 },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load inventory status', error: err.message });
  }
};

// GET /api/analytics/demand-forecast  (registered users + admin only)
// Simple moving-average style projection over recorded monthly units — a
// stand-in for a real ML forecasting service.
exports.demandForecast = async (req, res) => {
  try {
    const rows = await Product.aggregate([
      { $group: { _id: '$variety', avgMonthlyUnits: { $avg: '$unitsProducedMonthly' } } },
    ]);
    const forecast = rows.map((r) => ({
      variety: r._id,
      nextMonthProjected: Math.round(r.avgMonthlyUnits * 1.08), // +8% seasonal bump, illustrative
    }));
    res.json({ success: true, data: forecast });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load forecast', error: err.message });
  }
};

// GET /api/analytics/top-products?limit=5  (registered users + admin only)
// Backs the User Dashboard's "Top Selling Chocolates" panel.
exports.topProducts = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 5, 20);
    const rows = await Product.find({ isActive: true })
      .sort('-revenueMonthly')
      .limit(limit)
      .select('productName brand variety revenueMonthly unitsProducedMonthly imageUrl');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load top products', error: err.message });
  }
};

// GET /api/analytics/quality-stats  (registered users + admin only)
// Backs the User Dashboard's "Quality Statistics" panel.
exports.qualityStats = async (req, res) => {
  try {
    const [byVariety, overall] = await Promise.all([
      Product.aggregate([
        { $group: { _id: '$variety', avgQuality: { $avg: '$qualityScore' }, count: { $sum: 1 } } },
        { $sort: { avgQuality: -1 } },
      ]),
      Product.aggregate([
        {
          $group: {
            _id: null,
            avgQuality: { $avg: '$qualityScore' },
            belowThreshold: { $sum: { $cond: [{ $lt: ['$qualityScore', 80] }, 1, 0] } },
            total: { $sum: 1 },
          },
        },
      ]),
    ]);
    res.json({
      success: true,
      data: {
        byVariety: byVariety.map((r) => ({ variety: r._id, avgQuality: Math.round(r.avgQuality * 10) / 10, count: r.count })),
        overall: overall[0]
          ? {
              avgQuality: Math.round(overall[0].avgQuality * 10) / 10,
              belowThreshold: overall[0].belowThreshold,
              total: overall[0].total,
            }
          : { avgQuality: 0, belowThreshold: 0, total: 0 },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load quality statistics', error: err.message });
  }
};
