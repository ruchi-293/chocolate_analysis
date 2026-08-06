const MonthlyMetric = require('../models/MonthlyMetric');
const RegionalSales = require('../models/RegionalSales');
const Factory = require('../models/Factory');
const ProductionRecord = require('../models/ProductionRecord');

// GET /api/metrics/production-trend  (public)
// Backs: Monthly Production Trend (line), Cumulative Yearly Output (area),
// and the Daily/Weekly/Monthly/Yearly Output KPI cards.
// Aggregates the real, granular ProductionRecord collection (daily, per
// factory) rather than a static placeholder — falls back to MonthlyMetric
// only if no production records have been seeded yet.
exports.productionTrend = async (req, res) => {
  try {
    const recordCount = await ProductionRecord.countDocuments();

    if (recordCount > 0) {
      const monthly = await ProductionRecord.aggregate([
        {
          $group: {
            _id: { year: { $year: '$date' }, month: { $month: '$date' } },
            tons: { $sum: '$unitsProducedTons' },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        { $limit: 12 },
      ]);
      const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

      const [last7d, last30d] = await Promise.all([
        ProductionRecord.aggregate([
          { $match: { date: { $gte: new Date(Date.now() - 7 * 86400000) } } },
          { $group: { _id: null, tons: { $sum: '$unitsProducedTons' } } },
        ]),
        ProductionRecord.aggregate([
          { $match: { date: { $gte: new Date(Date.now() - 30 * 86400000) } } },
          { $group: { _id: null, tons: { $sum: '$unitsProducedTons' } } },
        ]),
      ]);
      const latestRecord = await ProductionRecord.findOne().sort({ date: -1 }).select('date');
      const dailyTotal = latestRecord
        ? (await ProductionRecord.aggregate([
            { $match: { date: latestRecord.date } },
            { $group: { _id: null, tons: { $sum: '$unitsProducedTons' } } },
          ]))[0]?.tons || 0
        : 0;

      return res.json({
        success: true,
        data: {
          labels: monthly.map((m) => MONTH_LABELS[m._id.month - 1]),
          productionTons: monthly.map((m) => Math.round(m.tons)),
          kpis: {
            daily: Math.round(dailyTotal),
            weekly: Math.round(last7d[0]?.tons || 0),
            monthly: Math.round(last30d[0]?.tons || 0),
            yearly: Math.round(monthly.reduce((sum, m) => sum + m.tons, 0)),
          },
        },
      });
    }

    // Fallback: no granular records yet, use the monthly aggregate collection
    const rows = await MonthlyMetric.find().sort({ year: 1, month: 1 });
    res.json({
      success: true,
      data: { labels: rows.map((r) => r.monthLabel), productionTons: rows.map((r) => r.productionTons) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load production trend', error: err.message });
  }
};

// GET /api/metrics/production-by-factory  (public)
// Backs: Production by Line (bar) — real output per factory over the last
// 30 days of ProductionRecord data, falling back to Factory's static
// monthly capacity figure only if no production records exist yet.
exports.productionByFactory = async (req, res) => {
  try {
    const recordCount = await ProductionRecord.countDocuments();

    if (recordCount > 0) {
      const rows = await ProductionRecord.aggregate([
        { $match: { date: { $gte: new Date(Date.now() - 30 * 86400000) } } },
        { $group: { _id: '$factoryName', tons: { $sum: '$unitsProducedTons' } } },
        { $sort: { tons: -1 } },
        { $limit: 8 },
      ]);
      return res.json({
        success: true,
        data: { labels: rows.map((r) => r._id), outputTonsPerMonth: rows.map((r) => Math.round(r.tons)) },
      });
    }

    const factories = await Factory.find().select('name outputTonsPerMonth').sort('-outputTonsPerMonth').limit(8);
    res.json({
      success: true,
      data: {
        labels: factories.map((f) => f.name),
        outputTonsPerMonth: factories.map((f) => f.outputTonsPerMonth),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load factory production', error: err.message });
  }
};

// GET /api/metrics/sustainability-trend  (public)
// Backs: Resource Use Trend (line) + Eco-Friendly Packaging (doughnut)
exports.sustainabilityTrend = async (req, res) => {
  try {
    const rows = await MonthlyMetric.find().sort({ year: 1, month: 1 });
    const latest = rows[rows.length - 1];
    res.json({
      success: true,
      data: {
        labels: rows.map((r) => r.monthLabel),
        waterKlPerTon: rows.map((r) => r.waterKlPerTon),
        energyMwh: rows.map((r) => r.energyMwh),
        latest: latest
          ? {
              waterKlPerTon: latest.waterKlPerTon,
              energyMwh: latest.energyMwh,
              carbonEmissionsTons: latest.carbonEmissionsTons,
              ecoPackagingPct: latest.ecoPackagingPct,
            }
          : null,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load sustainability metrics', error: err.message });
  }
};

// GET /api/metrics/market-trend  (public)
// Backs: Revenue vs Profit (line) + Market KPI cards
exports.marketTrend = async (req, res) => {
  try {
    const rows = await MonthlyMetric.find().sort({ year: 1, month: 1 });
    const latest = rows[rows.length - 1];
    res.json({
      success: true,
      data: {
        labels: rows.map((r) => r.monthLabel),
        revenueCr: rows.map((r) => r.revenueCr),
        profitCr: rows.map((r) => r.profitCr),
        latest: latest
          ? {
              revenueCr: latest.revenueCr,
              profitCr: latest.profitCr,
              marketGrowthPct: latest.marketGrowthPct,
              customerSatisfaction: latest.customerSatisfaction,
            }
          : null,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load market trend', error: err.message });
  }
};

// GET /api/metrics/regional?scope=state|export_region  (public)
// Backs: Sales by State (bar) and Export Distribution (doughnut)
exports.regional = async (req, res) => {
  try {
    const scope = req.query.scope === 'export_region' ? 'export_region' : 'state';
    const rows = await RegionalSales.find({ scope }).sort('-revenueIndex');
    res.json({
      success: true,
      data: { labels: rows.map((r) => r.name), values: rows.map((r) => r.revenueIndex) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load regional sales', error: err.message });
  }
};
