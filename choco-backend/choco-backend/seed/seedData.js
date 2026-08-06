require('dotenv').config();
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const ensureAdminExists = require('../utils/seedAdmin');
const { parseCSVFile } = require('../utils/fileParsers');
const { mapRowToProduct } = require('../utils/columnMapper');

const Product = require('../models/Product');
const Factory = require('../models/Factory');
const Employee = require('../models/Employee');
const ProductionRecord = require('../models/ProductionRecord');
const SalesTransaction = require('../models/SalesTransaction');
const InventorySnapshot = require('../models/InventorySnapshot');
const Order = require('../models/Order');
const Supplier = require('../models/Supplier');
const MonthlyMetric = require('../models/MonthlyMetric');
const RegionalSales = require('../models/RegionalSales');

const DATA_DIR = path.join(__dirname, 'data');

/**
 * Every seed step below is independently wrapped in try/catch. This is a
 * deliberate fix: the previous version of this script made a live network
 * call to OpenFoodFacts with no error handling, and when that call failed
 * (network hiccup, rate limit, DNS issue — all realistic), the ENTIRE
 * script aborted before factories, production records, or orders ever got
 * seeded. That's what caused empty charts/tables/KPIs even though most of
 * the seeding logic was otherwise fine. Seeding is now fully offline
 * (bundled CSVs in seed/data/), and one step failing no longer blocks the
 * rest — you'll see a per-step summary either way.
 */
async function runStep(label, fn) {
  try {
    await fn();
    console.log(`✓ ${label}`);
  } catch (err) {
    console.error(`✗ ${label} — ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------
async function seedFactories() {
  const count = await Factory.countDocuments();
  if (count > 0) return console.log('  (factories already seeded, skipping)');

  const rows = await parseCSVFile(path.join(DATA_DIR, 'factories.csv'));
  const docs = rows.map((r) => ({
    name: r.FactoryName,
    location: r.Location,
    country: r.Country,
    capacityTonsPerMonth: Number(r.CapacityTonsPerMonth),
    outputTonsPerMonth: Number(r.OutputTonsPerMonth),
    employeeCount: Number(r.EmployeeCount),
    efficiencyScore: Number(r.EfficiencyScore),
    status: r.Status,
  }));
  await Factory.insertMany(docs, { ordered: false });
  console.log(`  inserted ${docs.length} factories`);
}

// ---------------------------------------------------------------------------
// Products (now CSV-driven — fully offline, no dependency on an external API)
// ---------------------------------------------------------------------------
async function seedProducts() {
  const count = await Product.countDocuments();
  if (count > 0) return console.log('  (products already seeded, skipping)');

  const rows = await parseCSVFile(path.join(DATA_DIR, 'products.csv'));
  const docs = rows.map((r) => mapRowToProduct(r, 'csv-seed'));
  const inserted = await Product.insertMany(docs, { ordered: false });
  console.log(`  inserted ${inserted.length} products`);
}

// ---------------------------------------------------------------------------
// Suppliers (kept as a short hand-written reference list, same as before)
// ---------------------------------------------------------------------------
async function seedSuppliers() {
  const count = await Supplier.countDocuments();
  if (count > 0) return console.log('  (suppliers already seeded, skipping)');
  await Supplier.insertMany([
    { name: 'Ivory Cocoa Traders', materialSupplied: 'Cocoa Beans', country: "Côte d'Ivoire", contactEmail: 'sales@ivorycocoa.example', rating: 4.5, activeContracts: 6 },
    { name: 'Ghana Bean Collective', materialSupplied: 'Cocoa Beans', country: 'Ghana', contactEmail: 'trade@ghanabeans.example', rating: 4.2, activeContracts: 4 },
    { name: 'Alpine Dairy Co.', materialSupplied: 'Milk Powder', country: 'Switzerland', contactEmail: 'orders@alpinedairy.example', rating: 4.8, activeContracts: 3 },
    { name: 'EcoPack Solutions', materialSupplied: 'Eco Packaging', country: 'Germany', contactEmail: 'hello@ecopack.example', rating: 4.6, activeContracts: 5 },
  ]);
  console.log('  inserted 4 suppliers');
}

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------
async function seedEmployees() {
  const count = await Employee.countDocuments();
  if (count > 0) return console.log('  (employees already seeded, skipping)');

  const rows = await parseCSVFile(path.join(DATA_DIR, 'employees.csv'));
  const docs = rows.map((r) => ({
    employeeId: r.EmployeeID,
    fullName: r.FullName,
    role: r.Role,
    department: r.Department,
    factoryName: r.FactoryName,
    country: r.Country,
    hireDate: new Date(r.HireDate),
    annualSalaryUSD: Number(r.AnnualSalaryUSD),
    performanceScore: Number(r.PerformanceScore),
    status: r.Status,
  }));
  await Employee.insertMany(docs, { ordered: false });
  console.log(`  inserted ${docs.length} employees`);
}

// ---------------------------------------------------------------------------
// Production records (this is what backs the Production Trend / Production
// by Line charts and the Daily/Weekly/Monthly/Yearly Output KPI cards)
// ---------------------------------------------------------------------------
async function seedProductionRecords() {
  const count = await ProductionRecord.countDocuments();
  if (count > 0) return console.log('  (production records already seeded, skipping)');

  const rows = await parseCSVFile(path.join(DATA_DIR, 'production.csv'));
  const docs = rows.map((r) => ({
    productionId: r.ProductionID,
    factoryName: r.FactoryName,
    date: new Date(r.Date),
    unitsProducedTons: Number(r.UnitsProducedTons),
    defectiveUnitsTons: Number(r.DefectiveUnitsTons),
    downtimeHours: Number(r.DowntimeHours),
    efficiencyPercent: Number(r.EfficiencyPercent),
  }));
  await ProductionRecord.insertMany(docs, { ordered: false });
  console.log(`  inserted ${docs.length} production records`);
}

// ---------------------------------------------------------------------------
// Sales transactions
// ---------------------------------------------------------------------------
async function seedSalesTransactions() {
  const count = await SalesTransaction.countDocuments();
  if (count > 0) return console.log('  (sales transactions already seeded, skipping)');

  const rows = await parseCSVFile(path.join(DATA_DIR, 'sales.csv'));
  const docs = rows.map((r) => ({
    saleId: r.SaleID,
    date: new Date(r.Date),
    productId: r.ProductID,
    productName: r.ProductName,
    region: r.Region,
    country: r.Country,
    channel: r.Channel,
    quantitySold: Number(r.QuantitySold),
    unitPrice: Number(r.UnitPrice),
    revenueUSD: Number(r.RevenueUSD),
  }));
  await SalesTransaction.insertMany(docs, { ordered: false });
  console.log(`  inserted ${docs.length} sales transactions`);
}

// ---------------------------------------------------------------------------
// Inventory snapshots
// ---------------------------------------------------------------------------
async function seedInventorySnapshots() {
  const count = await InventorySnapshot.countDocuments();
  if (count > 0) return console.log('  (inventory snapshots already seeded, skipping)');

  const rows = await parseCSVFile(path.join(DATA_DIR, 'inventory.csv'));
  const docs = rows.map((r) => ({
    inventoryId: r.InventoryID,
    productId: r.ProductID,
    productName: r.ProductName,
    warehouseLocation: r.WarehouseLocation,
    stockQuantity: Number(r.StockQuantity),
    reorderLevel: Number(r.ReorderLevel),
    lastRestockedDate: new Date(r.LastRestockedDate),
    stockStatus: r.StockStatus,
  }));
  await InventorySnapshot.insertMany(docs, { ordered: false });
  console.log(`  inserted ${docs.length} inventory snapshots`);
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------
async function seedOrders() {
  const count = await Order.countDocuments();
  if (count > 0) return console.log('  (orders already seeded, skipping)');

  const rows = await parseCSVFile(path.join(DATA_DIR, 'orders.csv'));
  const docs = rows.map((r) => ({
    orderNumber: r.OrderID,
    customerName: r.CustomerName,
    country: r.Country,
    productId: r.ProductID,
    productName: r.ProductName,
    quantity: Number(r.Quantity),
    totalAmount: Number(r.RevenueUSD),
    status: r.DeliveryStatus,
    orderDate: new Date(r.OrderDate),
  }));
  await Order.insertMany(docs, { ordered: false });
  console.log(`  inserted ${docs.length} orders`);
}

// ---------------------------------------------------------------------------
// Monthly metrics (unchanged from before — backs the public dashboard's
// Sustainability and Market charts) and regional sales
// ---------------------------------------------------------------------------
async function seedMonthlyMetrics() {
  const count = await MonthlyMetric.countDocuments();
  if (count > 0) return console.log('  (monthly metrics already seeded, skipping)');

  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const productionTons = [3200, 3450, 3700, 3900, 4100, 4250, 4400, 4300, 4550, 4700, 4600, 4820];
  const revenueCr = [42, 44, 45, 47, 49, 50, 52, 51, 54, 55, 56, 57.5];
  const profitCr = [8, 8.5, 9, 9.4, 9.8, 10, 10.5, 10.2, 11, 11.4, 11.8, 12.1];
  const waterKlPerTon = [3.8, 3.7, 3.6, 3.5, 3.5, 3.4, 3.3, 3.3, 3.2, 3.2, 3.2, 3.2];
  const energyMwh = [460, 455, 448, 440, 435, 428, 422, 418, 415, 412, 410, 410];
  const currentYear = new Date().getFullYear();

  const docs = monthLabels.map((label, i) => ({
    year: currentYear, month: i + 1, monthLabel: label,
    productionTons: productionTons[i], revenueCr: revenueCr[i], profitCr: profitCr[i],
    marketGrowthPct: Math.round((9 + i * 0.45) * 10) / 10,
    customerSatisfaction: Math.round((4.4 + i * 0.02) * 10) / 10,
    waterKlPerTon: waterKlPerTon[i], energyMwh: energyMwh[i],
    carbonEmissionsTons: Math.round((1.05 - i * 0.017) * 100) / 100,
    ecoPackagingPct: Math.round(50 + i * 1.5),
  }));
  await MonthlyMetric.insertMany(docs);
  console.log(`  inserted ${docs.length} monthly metrics`);
}

async function seedRegionalSales() {
  const count = await RegionalSales.countDocuments();
  if (count > 0) return console.log('  (regional sales already seeded, skipping)');
  await RegionalSales.insertMany([
    { scope: 'state', name: 'Maharashtra', revenueIndex: 46 },
    { scope: 'state', name: 'Karnataka', revenueIndex: 38 },
    { scope: 'state', name: 'Delhi NCR', revenueIndex: 41 },
    { scope: 'state', name: 'Gujarat', revenueIndex: 29 },
    { scope: 'state', name: 'Tamil Nadu', revenueIndex: 33 },
    { scope: 'export_region', name: 'Europe', revenueIndex: 34 },
    { scope: 'export_region', name: 'N. America', revenueIndex: 28 },
    { scope: 'export_region', name: 'Middle East', revenueIndex: 15 },
    { scope: 'export_region', name: 'Asia Pacific', revenueIndex: 18 },
    { scope: 'export_region', name: 'Africa', revenueIndex: 5 },
  ]);
  console.log('  inserted 10 regional sales records');
}

// ---------------------------------------------------------------------------
// Run everything — each step isolated, none block the others
// ---------------------------------------------------------------------------
(async () => {
  await connectDB();

  await runStep('Factories', seedFactories);
  await runStep('Products', seedProducts);
  await runStep('Suppliers', seedSuppliers);
  await runStep('Employees', seedEmployees);
  await runStep('Production records', seedProductionRecords);
  await runStep('Sales transactions', seedSalesTransactions);
  await runStep('Inventory snapshots', seedInventorySnapshots);
  await runStep('Orders', seedOrders);
  await runStep('Monthly metrics', seedMonthlyMetrics);
  await runStep('Regional sales', seedRegionalSales);
  await runStep('Admin account', ensureAdminExists);

  console.log('\nSeeding complete.');
  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error('Unexpected fatal error during seeding:', err);
  process.exit(1);
});
