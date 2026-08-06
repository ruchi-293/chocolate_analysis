const { Readable } = require('stream');
const csvParser = require('csv-parser');
const ExcelJS = require('exceljs');

/** Extracts all text from a PDF buffer, page by page, using pdfjs-dist directly
 *  (rather than the abandoned `pdf-parse` wrapper, which bundles a 2017-era
 *  PDF.js that fails on PDFs produced by modern tools like reportlab). */
async function extractPdfText(buffer) {
  // pdfjs-dist ships as an ESM package; dynamic import works from CommonJS.
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const path = require('path');
  const standardFontDataUrl = path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts') + '/';
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer), standardFontDataUrl });
  const pdf = await loadingTask.promise;

  let fullText = '';
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    // Group text items into lines using their y-coordinate, since pdfjs
    // returns a flat list of positioned text fragments, not lines.
    const lineMap = new Map();
    for (const item of content.items) {
      const y = Math.round(item.transform[5]);
      if (!lineMap.has(y)) lineMap.set(y, []);
      lineMap.get(y).push(item);
    }
    const sortedYs = [...lineMap.keys()].sort((a, b) => b - a); // top to bottom
    for (const y of sortedYs) {
      const lineItems = lineMap.get(y).sort((a, b) => a.transform[4] - b.transform[4]);
      // Preserve column gaps as multiple spaces so \s{2,} splitting works later.
      // Two signals mark a column boundary: (1) a genuine coordinate jump
      // between glyphs (real spacing), and (2) a whitespace-only text item —
      // PDF writers like reportlab often collapse several spaces into ONE
      // space glyph with an inflated width rather than leaving a true gap,
      // so the width/coordinates alone don't reveal it; the item being pure
      // whitespace does.
      let line = '';
      let lastEndX = null;
      for (const item of lineItems) {
        const x = item.transform[4];
        const isWhitespaceItem = item.str.trim() === '' && item.str.length > 0;
        const hasCoordGap = lastEndX !== null && x - lastEndX > 8;
        if (isWhitespaceItem) {
          line += '   '; // known column boundary
        } else {
          if (hasCoordGap) line += '  ';
          line += item.str;
        }
        lastEndX = x + (item.width || 0);
      }
      fullText += line + '\n';
    }
  }
  return fullText;
}

const fs = require('fs');

/** Parses a CSV buffer into an array of raw row objects (header: value). */
function parseCSVBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const rows = [];
    Readable.from(buffer.toString('utf-8'))
      .pipe(csvParser())
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

/** Parses a CSV file from disk (used by the seed script for bundled datasets). */
function parseCSVFile(filePath) {
  return parseCSVBuffer(fs.readFileSync(filePath));
}

/** Parses an XLSX buffer (first worksheet) into an array of raw row objects. */
async function parseXLSXBuffer(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headerRow = sheet.getRow(1);
  const headers = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? '').trim();
  });

  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header
    const obj = {};
    let hasAnyValue = false;
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const header = headers[colNumber];
      if (!header) return;
      let value = cell.value;
      // Excel dates come back as Date objects or {result: ...} for formulas
      if (value && typeof value === 'object' && 'result' in value) value = value.result;
      if (value !== null && value !== undefined && value !== '') hasAnyValue = true;
      obj[header] = value instanceof Date ? value.toISOString().slice(0, 10) : value;
    });
    if (hasAnyValue) rows.push(obj);
  });
  return rows;
}

/**
 * Best-effort PDF table extraction. Works reliably for PDFs whose table rows
 * are plain text with consistent column spacing (e.g. exported from a
 * spreadsheet or generated with a simple layout) — it cannot reconstruct
 * tables from arbitrarily complex PDF layouts, since PDF has no native
 * concept of "table," only positioned text. When it can't find a header row
 * it recognizes, it returns an empty array so the caller can report that
 * clearly instead of silently importing garbage.
 */
async function parsePDFBuffer(buffer) {
  const { normalizeHeader } = require('./columnMapper');

  const text = await extractPdfText(buffer);
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // A header line is one where at least 3 "words" each normalize to a
  // recognized column synonym (ProductName, Brand, Revenue, etc.).
  const KNOWN_HEADER_WORDS = new Set([
    'productname', 'name', 'brand', 'variety', 'chocolatevariety', 'country',
    'factory', 'factoryname', 'unitsproducedmonthly', 'unitsproducedpermonth',
    'revenuemonthly', 'revenuepermonthusd', 'revenue', 'stockquantity',
    'stockavailable', 'stock', 'qualityscore', 'qualityrating', 'quality',
    'price', 'unitprice', 'category', 'cocoapercentage', 'sustainabilityscore',
  ]);

  let headerLineIdx = -1;
  let delimiter = /\s{2,}|\t|,/; // 2+ spaces, tab, or comma between columns
  let headers = [];

  for (let i = 0; i < Math.min(lines.length, 60); i++) {
    const candidate = lines[i].split(delimiter).map((c) => c.trim()).filter(Boolean);
    const recognizedCount = candidate.filter((c) => KNOWN_HEADER_WORDS.has(normalizeHeader(c))).length;
    if (candidate.length >= 3 && recognizedCount >= 2) {
      headerLineIdx = i;
      headers = candidate;
      break;
    }
  }

  if (headerLineIdx === -1) return { rows: [], detected: false };

  const rows = [];
  for (let i = headerLineIdx + 1; i < lines.length; i++) {
    const cells = lines[i].split(delimiter).map((c) => c.trim()).filter(Boolean);
    if (cells.length < 2) continue; // not a data row (e.g. a page footer/heading)
    if (cells.length > headers.length + 2) continue; // clearly not this table
    // Multi-page tables often repeat their header row on later pages — skip
    // any row whose values are just the header labels again.
    const isRepeatedHeader = cells.every((c, idx) => c === headers[idx]);
    if (isRepeatedHeader) continue;
    const obj = {};
    headers.forEach((h, idx) => { if (cells[idx] !== undefined) obj[h] = cells[idx]; });
    rows.push(obj);
  }

  return { rows, detected: true };
}

module.exports = { parseCSVBuffer, parseCSVFile, parseXLSXBuffer, parsePDFBuffer };
