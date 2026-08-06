const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    materialSupplied: { type: String, default: 'Cocoa Beans' },
    country: String,
    contactEmail: String,
    rating: { type: Number, min: 0, max: 5, default: 4 },
    activeContracts: { type: Number, default: 0 },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Supplier', supplierSchema);
