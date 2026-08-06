const mongoose = require('mongoose');

/**
 * One document per calendar month. This is what powers the public
 * Analysis Dashboard's Production Trend, Sustainability, and Market charts
 * — previously those were hardcoded arrays in the frontend; now they read
 * from here via /api/metrics/*.
 */
const monthlyMetricSchema = new mongoose.Schema(
  {
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 }, // 1 = Jan
    monthLabel: { type: String, required: true }, // 'Jan', 'Feb', ...

    productionTons: { type: Number, default: 0 },
    revenueCr: { type: Number, default: 0 }, // ₹ Crore
    profitCr: { type: Number, default: 0 },
    marketGrowthPct: { type: Number, default: 0 },
    customerSatisfaction: { type: Number, default: 0 }, // out of 5

    waterKlPerTon: { type: Number, default: 0 },
    energyMwh: { type: Number, default: 0 },
    carbonEmissionsTons: { type: Number, default: 0 },
    ecoPackagingPct: { type: Number, default: 0 },
  },
  { timestamps: true }
);

monthlyMetricSchema.index({ year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('MonthlyMetric', monthlyMetricSchema);
