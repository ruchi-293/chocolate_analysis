const mongoose = require('mongoose');

const factorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    location: { type: String, trim: true },
    country: { type: String, trim: true },
    capacityTonsPerMonth: { type: Number, default: 0 },
    outputTonsPerMonth: { type: Number, default: 0 },
    employeeCount: { type: Number, default: 0 },
    efficiencyScore: { type: Number, min: 0, max: 100, default: 85 },
    status: { type: String, enum: ['Active', 'Maintenance', 'Offline'], default: 'Active' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Factory', factorySchema);
