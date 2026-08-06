const { Parser } = require('json2csv');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

/** Converts an array of plain objects to a CSV string. */
function toCSV(records, fields) {
  const parser = new Parser({ fields });
  return parser.parse(records);
}

/** Builds an Excel workbook buffer from records. */
async function toExcelBuffer(records, fields, sheetName = 'Dataset') {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = fields.map((f) => ({ header: f, key: f, width: 22 }));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE7D6C5' },
  };

  records.forEach((r) => sheet.addRow(r));
  return workbook.xlsx.writeBuffer();
}

/** Streams a simple tabular PDF report directly to an Express response. */
function toPDF(res, records, fields, title = 'ChocoAnalytics Report') {
  const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/\s+/g, '_')}.pdf"`);
  doc.pipe(res);

  doc.fontSize(18).fillColor('#4E342E').text(title, { align: 'left' });
  doc.moveDown(0.5);
  doc.fontSize(9).fillColor('#7B4F35').text(`Generated ${new Date().toLocaleString()} · ${records.length} records`);
  doc.moveDown(1);

  const startX = doc.x;
  let y = doc.y;
  const colWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / fields.length;

  doc.fontSize(9).fillColor('#FFFFFF');
  doc.rect(startX, y, colWidth * fields.length, 20).fill('#7B4F35');
  doc.fillColor('#FFFFFF');
  fields.forEach((f, i) => doc.text(String(f), startX + i * colWidth + 4, y + 5, { width: colWidth - 8 }));
  y += 22;

  doc.fillColor('#2E1F1B').fontSize(8.5);
  records.forEach((row, idx) => {
    if (y > doc.page.height - doc.page.margins.bottom - 20) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    if (idx % 2 === 0) {
      doc.rect(startX, y, colWidth * fields.length, 18).fill('#F8F3ED');
      doc.fillColor('#2E1F1B');
    }
    fields.forEach((f, i) => {
      const val = row[f] === undefined || row[f] === null ? '' : String(row[f]);
      doc.text(val, startX + i * colWidth + 4, y + 4, { width: colWidth - 8, ellipsis: true });
    });
    y += 18;
  });

  doc.end();
}

module.exports = { toCSV, toExcelBuffer, toPDF };
