const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, unique: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    department: { type: String, trim: true },
    factoryName: { type: String, trim: true },
    country: { type: String, trim: true },
    hireDate: { type: Date },
    annualSalaryUSD: { type: Number, default: 0 },
    performanceScore: { type: Number, min: 0, max: 100 },
    status: { type: String, enum: ['Active', 'On Leave', 'Terminated'], default: 'Active' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Employee', employeeSchema);
