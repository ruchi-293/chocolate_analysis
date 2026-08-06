const Product = require('../models/Product');
const ActivityLog = require('../models/ActivityLog');
const { toCSV, toExcelBuffer, toPDF } = require('../utils/exportHelpers');
const { parseCSVBuffer, parseXLSXBuffer, parsePDFBuffer } = require('../utils/fileParsers');
const { mapRowToProduct } = require('../utils/columnMapper');

const EXPORT_FIELDS = [
  'productName', 'brand', 'variety', 'category', 'factory', 'country',
  'unitsProducedMonthly', 'unitPrice', 'revenueMonthly', 'stockQuantity',
  'qualityScore', 'nutriScore', 'isActive',
];

function logActivity(req, action, entityId, details) {
  ActivityLog.create({
    user: req.user?._id,
    action,
    entity: 'Product',
    entityId,
    details,
    ip: req.ip,
  }).catch((e) => console.warn('Activity log failed:', e.message));
}

// GET /api/products?search=&variety=&country=&sort=-createdAt&page=1&limit=20
exports.list = async (req, res) => {
  try {
    const { search, variety, country, factory, isActive, sort = '-createdAt', page = 1, limit = 20 } = req.query;

    const query = {};
    if (search) query.$text = { $search: search };
    if (variety) query.variety = variety;
    if (country) query.country = country;
    if (factory) query.factory = factory;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(parseInt(limit, 10) || 20, 200);

    const [items, total] = await Promise.all([
      Product.find(query)
        .sort(sort)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Product.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: items,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch products', error: err.message });
  }
};

// GET /api/products/:id
exports.getOne = async (req, res) => {
  const item = await Product.findById(req.params.id);
  if (!item) return res.status(404).json({ success: false, message: 'Product not found' });
  res.json({ success: true, data: item });
};

// POST /api/products  (admin only)
exports.create = async (req, res) => {
  try {
    const item = await Product.create({ ...req.body, sourceApi: 'manual' });
    logActivity(req, 'PRODUCT_CREATE', item._id, { productName: item.productName });
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    res.status(400).json({ success: false, message: 'Failed to create product', error: err.message });
  }
};

// PUT /api/products/:id  (admin only)
exports.update = async (req, res) => {
  try {
    const item = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ success: false, message: 'Product not found' });
    logActivity(req, 'PRODUCT_UPDATE', item._id, req.body);
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(400).json({ success: false, message: 'Failed to update product', error: err.message });
  }
};

// DELETE /api/products/:id  (admin only)
exports.remove = async (req, res) => {
  const item = await Product.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ success: false, message: 'Product not found' });
  logActivity(req, 'PRODUCT_DELETE', item._id, { productName: item.productName });
  res.json({ success: true, message: 'Product deleted' });
};

// POST /api/products/import  (admin only, multipart file field "file")
// Accepts .csv, .xlsx/.xls, or .pdf. Detects the format from the filename,
// parses it into raw rows, maps each row's headers onto the Product schema
// (see utils/columnMapper.js — this is what makes PascalCase headers like
// "ProductName"/"RevenuePerMonthUSD" work, not just one exact lowercase
// spelling), validates every row individually, and reports precisely how
// many rows succeeded, how many were skipped, and why — rather than a bare
// "Imported 0 records" with no explanation.
exports.importFile = async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

  const filename = req.file.originalname.toLowerCase();
  let rawRows = [];
  let sourceApi = 'manual';
  let pdfDetected = true;

  try {
    if (filename.endsWith('.csv')) {
      rawRows = await parseCSVBuffer(req.file.buffer);
      sourceApi = 'csv-import';
    } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      rawRows = await parseXLSXBuffer(req.file.buffer);
      sourceApi = 'xlsx-import';
    } else if (filename.endsWith('.pdf')) {
      const result = await parsePDFBuffer(req.file.buffer);
      rawRows = result.rows;
      pdfDetected = result.detected;
      sourceApi = 'pdf-import';
    } else {
      return res.status(400).json({ success: false, message: 'Unsupported file type. Use .csv, .xlsx, or .pdf.' });
    }
  } catch (err) {
    return res.status(400).json({ success: false, message: `Could not read the file: ${err.message}` });
  }

  if (filename.endsWith('.pdf') && !pdfDetected) {
    return res.status(400).json({
      success: false,
      message: 'Could not find a recognizable data table in this PDF. PDF import works best for ' +
        'simple, consistently-formatted tables (e.g. exported from a spreadsheet) with a header row ' +
        'containing column names like "ProductName", "Revenue", "Stock", etc. For guaranteed results, use CSV or XLSX.',
    });
  }

  if (!rawRows.length) {
    return res.status(400).json({ success: false, message: 'The file was read successfully but contained no data rows.' });
  }

  const validDocs = [];
  const errors = []; // { row, reason }

  rawRows.forEach((raw, idx) => {
    const mapped = mapRowToProduct(raw, sourceApi);
    const doc = new Product(mapped);
    const validationError = doc.validateSync();
    if (validationError) {
      const reasons = Object.values(validationError.errors).map((e) => e.message).join('; ');
      errors.push({ row: idx + 2, reason: reasons }); // +2 = header row + 1-indexing
    } else {
      validDocs.push(mapped);
    }
  });

  let insertedCount = 0;
  if (validDocs.length) {
    try {
      const inserted = await Product.insertMany(validDocs, { ordered: false });
      insertedCount = inserted.length;
    } catch (err) {
      // insertMany with ordered:false still throws on partial failure (e.g. a
      // duplicate key) but does perform the successful inserts — recover the count.
      insertedCount = err.insertedDocs ? err.insertedDocs.length : (err.result?.result?.nInserted ?? 0);
      if (err.writeErrors) {
        err.writeErrors.forEach((we) => errors.push({ row: 'n/a', reason: we.errmsg || 'Duplicate or write error' }));
      }
    }
  }

  logActivity(req, 'PRODUCT_FILE_IMPORT', null, {
    filename: req.file.originalname, inserted: insertedCount, skipped: errors.length, totalRows: rawRows.length,
  });

  const summary = errors.length
    ? `Imported ${insertedCount} of ${rawRows.length} rows — ${errors.length} skipped (see details).`
    : `Imported ${insertedCount} of ${rawRows.length} rows successfully.`;

  res.status(insertedCount > 0 ? 200 : 400).json({
    success: insertedCount > 0,
    message: summary,
    count: insertedCount,
    totalRows: rawRows.length,
    skipped: errors.length,
    errors: errors.slice(0, 25), // cap payload size; enough to diagnose a header-mapping problem
  });
};

// GET /api/products/export/csv
exports.exportCSVFile = async (req, res) => {
  try {
    const items = await Product.find().lean();
    const csv = toCSV(items, EXPORT_FIELDS);
    res.header('Content-Type', 'text/csv');
    res.attachment('chocoanalytics-dataset.csv');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, message: 'CSV export failed', error: err.message });
  }
};

// GET /api/products/export/excel
exports.exportExcelFile = async (req, res) => {
  try {
    const items = await Product.find().lean();
    const buffer = await toExcelBuffer(items, EXPORT_FIELDS, 'Products');
    res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.attachment('chocoanalytics-dataset.xlsx');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Excel export failed', error: err.message });
  }
};

// GET /api/products/export/pdf
exports.exportPDFFile = async (req, res) => {
  try {
    const items = await Product.find().lean();
    toPDF(res, items, EXPORT_FIELDS, 'ChocoAnalytics Dataset');
  } catch (err) {
    res.status(500).json({ success: false, message: 'PDF export failed', error: err.message });
  }
};
