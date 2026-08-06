const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true }, // e.g. 'PRODUCT_CREATE', 'PRODUCT_DELETE', 'LOGIN'
    entity: String, // e.g. 'Product'
    entityId: String,
    details: mongoose.Schema.Types.Mixed,
    ip: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('ActivityLog', activityLogSchema);
