const mongoose = require('mongoose');

/**
 * This is the primary "dataset" collection surfaced in the Admin Dataset
 * Management page: view / search / filter / sort / add / edit / delete /
 * import CSV/XLSX/PDF / export CSV-Excel-PDF.
 *
 * Seeded initially from the free OpenFoodFacts API (see seed/seedData.js),
 * then fully editable by admins like any normal collection. Fields below
 * marked "extended" match the richer 29-column ChocoAnalytics dataset
 * (CocoaPercentage, SustainabilityScore, etc.) and are optional so older,
 * simpler imports (e.g. plain OpenFoodFacts rows) still validate fine.
 */
const productSchema = new mongoose.Schema(
  {
    productName: { type: String, required: true, trim: true },
    brand: { type: String, trim: true, default: 'Unbranded' },
    variety: {
      type: String,
      enum: ['Dark', 'Milk', 'White', 'Ruby', 'Compound', 'Hazelnut', 'Almond',
             'Caramel', 'Fruit & Nut', 'Sugar-Free', 'Organic', 'Vegan Dark', 'Other'],
      default: 'Other',
    },
    category: { type: String, trim: true, default: 'Chocolate Bar' },

    factory: { type: String, trim: true },
    country: { type: String, trim: true },
    region: { type: String, trim: true }, // extended

    unitsProducedMonthly: { type: Number, default: 0 },
    unitsSoldMonthly: { type: Number, default: 0 }, // extended
    unitPrice: { type: Number, default: 0 },
    revenueMonthly: { type: Number, default: 0 },
    productionCost: { type: Number, default: 0 }, // extended
    profit: { type: Number, default: 0 }, // extended

    stockQuantity: { type: Number, default: 0 },
    reorderLevel: { type: Number, default: 50 },
    warehouseLocation: { type: String, trim: true }, // extended
    supplierName: { type: String, trim: true }, // extended

    qualityScore: { type: Number, min: 0, max: 100, default: 90 }, // normalized 0-100 (QualityRating x10 on import)
    qualityRating10: { type: Number, min: 0, max: 10 }, // extended — raw 1-10 scale as provided
    customerRating: { type: Number, min: 0, max: 5 }, // extended
    sustainabilityScore: { type: Number, min: 0, max: 100 }, // extended
    defectiveUnits: { type: Number, default: 0 }, // extended
    demandIndex: { type: Number, min: 0, max: 100 }, // extended

    cocoaPercentage: { type: Number, min: 0, max: 100 }, // extended
    carbonFootprint: { type: Number }, // extended, kg CO2e
    waterUsage: { type: Number }, // extended, liters
    energyConsumption: { type: Number }, // extended, kWh
    packagingType: { type: String, trim: true }, // extended
    ingredients: { type: String, trim: true }, // extended, comma-separated

    productionDate: { type: Date }, // extended
    expiryDate: { type: Date }, // extended

    nutriScore: { type: String, uppercase: true },
    imageUrl: String,
    sourceApi: { type: String, default: 'manual' }, // 'openfoodfacts' | 'manual' | 'csv-import' | 'xlsx-import' | 'pdf-import'
    externalId: { type: String, index: true },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.index({ productName: 'text', brand: 'text', category: 'text' });

module.exports = mongoose.model('Product', productSchema);
