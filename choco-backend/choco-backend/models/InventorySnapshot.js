const mongoose = require('mongoose');

const inventorySnapshotSchema = new mongoose.Schema(
  {
    inventoryId: { type: String, required: true, unique: true, trim: true },
    productId: { type: String, trim: true },
    productName: { type: String, required: true, trim: true },
    warehouseLocation: { type: String, required: true, trim: true },
    stockQuantity: { type: Number, required: true, min: 0 },
    reorderLevel: { type: Number, default: 50 },
    lastRestockedDate: { type: Date },
    stockStatus: { type: String, enum: ['In Stock', 'Low Stock', 'Out of Stock'], default: 'In Stock' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('InventorySnapshot', inventorySnapshotSchema);
