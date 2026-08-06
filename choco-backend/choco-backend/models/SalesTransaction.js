const mongoose = require('mongoose');

const salesTransactionSchema = new mongoose.Schema(
  {
    saleId: { type: String, required: true, unique: true, trim: true },
    date: { type: Date, required: true },
    productId: { type: String, trim: true },
    productName: { type: String, required: true, trim: true },
    region: { type: String, trim: true },
    country: { type: String, trim: true },
    channel: { type: String, trim: true },
    quantitySold: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    revenueUSD: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

salesTransactionSchema.index({ date: 1 });

module.exports = mongoose.model('SalesTransaction', salesTransactionSchema);
