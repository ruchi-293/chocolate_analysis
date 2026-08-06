const mongoose = require('mongoose');

/**
 * One row per factory per day. This is the real, granular data source
 * behind the "Production Trend" and "Production by Line" charts — richer
 * than the monthly-aggregate MonthlyMetric collection, and tied to actual
 * named factories so "Production by Line" reflects real factories rather
 * than placeholder labels.
 */
const productionRecordSchema = new mongoose.Schema(
  {
    productionId: { type: String, required: true, unique: true, trim: true },
    factoryName: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    unitsProducedTons: { type: Number, required: true, min: 0 },
    defectiveUnitsTons: { type: Number, default: 0 },
    downtimeHours: { type: Number, default: 0 },
    efficiencyPercent: { type: Number, min: 0, max: 100 },
  },
  { timestamps: true }
);

productionRecordSchema.index({ factoryName: 1, date: 1 });

module.exports = mongoose.model('ProductionRecord', productionRecordSchema);
