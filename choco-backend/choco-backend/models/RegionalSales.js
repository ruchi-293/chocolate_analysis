const mongoose = require('mongoose');

/**
 * Backs the public dashboard's "Sales by State" (domestic) and
 * "Export Distribution" (by world region) charts.
 */
const regionalSalesSchema = new mongoose.Schema(
  {
    scope: { type: String, enum: ['state', 'export_region'], required: true },
    name: { type: String, required: true }, // e.g. 'Maharashtra' or 'Europe'
    revenueIndex: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('RegionalSales', regionalSalesSchema);
