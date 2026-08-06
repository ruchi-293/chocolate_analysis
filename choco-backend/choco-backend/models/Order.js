const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    customerName: { type: String, required: true },
    country: String,

    // Denormalized product info for direct table display without needing
    // a populate() round-trip — the CSV-driven seed data (and any future
    // CSV import) references products by name/ID, which we keep here.
    productId: { type: String, trim: true },
    productName: { type: String, trim: true },
    quantity: { type: Number, min: 1 },

    // Legacy structure kept for backward compatibility with any orders
    // created via the admin CRUD form before this field was added.
    items: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        quantity: Number,
        unitPrice: Number,
      },
    ],

    totalAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
      default: 'Pending',
    },
    orderDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
