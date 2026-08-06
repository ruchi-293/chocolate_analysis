/**
 * Maps arbitrary spreadsheet/table headers onto the Product schema's field
 * names, regardless of casing or formatting style. This is what makes
 * import work with, for example, the ChocoAnalytics generated dataset
 * ("ProductName", "RevenuePerMonthUSD", "UnitsProducedPerMonth", ...) as
 * well as simpler hand-made CSVs ("product_name", "revenue", ...) — the
 * previous importer only recognized one exact lowercase spelling per field,
 * so a PascalCase file like the generated dataset matched nothing and every
 * row silently failed validation (hence "Imported 0 records").
 */

// canonicalField -> [normalized synonyms]. Normalization lowercases and
// strips everything except letters/numbers, so 'Product Name', 'product_name',
// and 'ProductName' all normalize to 'productname' and match the same entry.
const SYNONYMS = {
  productName: ['productname', 'name', 'product', 'itemname'],
  brand: ['brand', 'brandname'],
  variety: ['variety', 'chocolatevariety', 'type', 'chocolatetype'],
  category: ['category'],
  factory: ['factory', 'factoryname'],
  country: ['country'],
  region: ['region'],
  warehouseLocation: ['warehouselocation', 'warehouse'],
  supplierName: ['suppliername', 'supplier'],

  unitsProducedMonthly: ['unitsproducedmonthly', 'unitsproducedpermonth', 'unitsproduced', 'monthlyunitsproduced'],
  unitsSoldMonthly: ['unitssoldmonthly', 'unitssoldpermonth', 'unitssold', 'monthlyunitssold'],
  unitPrice: ['unitprice', 'price', 'priceperunit'],
  revenueMonthly: ['revenuemonthly', 'revenuepermonthusd', 'revenuepermonth', 'revenue', 'revenueusd'],
  productionCost: ['productioncostusd', 'productioncost', 'cost'],
  profit: ['profitusd', 'profit'],

  stockQuantity: ['stockquantity', 'stockavailable', 'stock'],
  reorderLevel: ['reorderlevel'],

  qualityRating10: ['qualityrating', 'quality10'],
  qualityScore: ['qualityscore', 'quality'],
  customerRating: ['customerrating', 'rating'],
  sustainabilityScore: ['sustainabilityscore', 'sustainability'],
  defectiveUnits: ['defectiveunits', 'defects'],
  demandIndex: ['demandindex', 'demand'],

  cocoaPercentage: ['cocoapercentage', 'cocoapct', 'cocoa'],
  carbonFootprint: ['carbonfootprintkgco2e', 'carbonfootprint', 'co2e', 'carbon'],
  waterUsage: ['waterusageliters', 'waterusage', 'water'],
  energyConsumption: ['energyconsumptionkwh', 'energyconsumption', 'energy'],
  packagingType: ['packagingtype', 'packaging'],
  ingredients: ['ingredients'],

  productionDate: ['productiondate', 'manufacturedate', 'madedate'],
  expiryDate: ['expirydate', 'expirationdate', 'bestbefore'],

  externalId: ['productid', 'sku', 'externalid', 'code'],
  imageUrl: ['imageurl', 'image'],
  productStatus: ['productstatus', 'status'], // mapped to isActive below, not a schema field directly
};

// Flatten to normalizedSynonym -> canonicalField for O(1) lookup
const LOOKUP = {};
for (const [canonical, synonyms] of Object.entries(SYNONYMS)) {
  for (const syn of synonyms) LOOKUP[syn] = canonical;
}

function normalizeHeader(h) {
  return String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

const VALID_VARIETIES = ['Dark', 'Milk', 'White', 'Ruby', 'Compound', 'Hazelnut', 'Almond',
                          'Caramel', 'Fruit & Nut', 'Sugar-Free', 'Organic', 'Vegan Dark', 'Other'];

function normalizeVariety(raw) {
  if (!raw) return 'Other';
  const clean = String(raw).trim();
  const match = VALID_VARIETIES.find((v) => v.toLowerCase() === clean.toLowerCase());
  if (match) return match;
  // loose contains-match, e.g. "Fruit and Nut" -> "Fruit & Nut"
  const looseMatch = VALID_VARIETIES.find((v) =>
    clean.toLowerCase().replace(/[^a-z]/g, '').includes(v.toLowerCase().replace(/[^a-z]/g, ''))
  );
  return looseMatch || 'Other';
}

function toNumber(v, fallback = 0) {
  if (v === undefined || v === null || v === '') return fallback;
  const n = Number(String(v).replace(/[,$₹%]/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

function toDate(v) {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Takes one raw row object (however its keys were originally cased) and
 * returns a Product-shaped object ready for `new Product(doc)`.
 */
function mapRowToProduct(rawRow, sourceApi) {
  const normalized = {};
  for (const [key, value] of Object.entries(rawRow)) {
    const canonical = LOOKUP[normalizeHeader(key)];
    if (canonical && (value !== undefined && value !== null && value !== '')) {
      normalized[canonical] = value;
    }
  }

  const qualityRating10 = normalized.qualityRating10 !== undefined ? toNumber(normalized.qualityRating10) : undefined;
  // qualityScore is stored 0-100; if only the 1-10 rating was given, scale it up.
  const qualityScore = normalized.qualityScore !== undefined
    ? toNumber(normalized.qualityScore)
    : (qualityRating10 !== undefined ? qualityRating10 * 10 : 90);

  const isActive = normalized.productStatus
    ? String(normalized.productStatus).trim().toLowerCase() !== 'inactive'
    : true;

  const doc = {
    productName: normalized.productName ? String(normalized.productName).trim() : undefined,
    brand: normalized.brand ? String(normalized.brand).trim() : 'Unbranded',
    variety: normalizeVariety(normalized.variety),
    category: normalized.category ? String(normalized.category).trim() : 'Chocolate',
    factory: normalized.factory ? String(normalized.factory).trim() : undefined,
    country: normalized.country ? String(normalized.country).trim() : undefined,
    region: normalized.region ? String(normalized.region).trim() : undefined,
    warehouseLocation: normalized.warehouseLocation ? String(normalized.warehouseLocation).trim() : undefined,
    supplierName: normalized.supplierName ? String(normalized.supplierName).trim() : undefined,

    unitsProducedMonthly: toNumber(normalized.unitsProducedMonthly),
    unitsSoldMonthly: toNumber(normalized.unitsSoldMonthly),
    unitPrice: toNumber(normalized.unitPrice),
    revenueMonthly: toNumber(normalized.revenueMonthly),
    productionCost: toNumber(normalized.productionCost),
    profit: normalized.profit !== undefined
      ? toNumber(normalized.profit)
      : toNumber(normalized.revenueMonthly) - toNumber(normalized.productionCost),

    stockQuantity: toNumber(normalized.stockQuantity),
    reorderLevel: normalized.reorderLevel !== undefined ? toNumber(normalized.reorderLevel) : 50,

    qualityScore: Math.min(100, Math.max(0, qualityScore)),
    qualityRating10,
    customerRating: normalized.customerRating !== undefined ? toNumber(normalized.customerRating) : undefined,
    sustainabilityScore: normalized.sustainabilityScore !== undefined ? toNumber(normalized.sustainabilityScore) : undefined,
    defectiveUnits: toNumber(normalized.defectiveUnits),
    demandIndex: normalized.demandIndex !== undefined ? toNumber(normalized.demandIndex) : undefined,

    cocoaPercentage: normalized.cocoaPercentage !== undefined ? toNumber(normalized.cocoaPercentage) : undefined,
    carbonFootprint: normalized.carbonFootprint !== undefined ? toNumber(normalized.carbonFootprint) : undefined,
    waterUsage: normalized.waterUsage !== undefined ? toNumber(normalized.waterUsage) : undefined,
    energyConsumption: normalized.energyConsumption !== undefined ? toNumber(normalized.energyConsumption) : undefined,
    packagingType: normalized.packagingType ? String(normalized.packagingType).trim() : undefined,
    ingredients: normalized.ingredients ? String(normalized.ingredients).trim() : undefined,

    productionDate: toDate(normalized.productionDate),
    expiryDate: toDate(normalized.expiryDate),

    externalId: normalized.externalId ? String(normalized.externalId).trim() : undefined,
    imageUrl: normalized.imageUrl ? String(normalized.imageUrl).trim() : undefined,

    isActive,
    sourceApi,
  };

  // Strip undefined keys so Mongoose defaults apply cleanly
  Object.keys(doc).forEach((k) => doc[k] === undefined && delete doc[k]);
  return doc;
}

module.exports = { mapRowToProduct, normalizeHeader, normalizeVariety };
