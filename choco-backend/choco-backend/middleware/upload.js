const multer = require('multer');

const storage = multer.memoryStorage();

const ALLOWED_EXTENSIONS = ['.csv', '.xlsx', '.xls', '.pdf'];
const ALLOWED_MIMETYPES = [
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/pdf',
];

const fileFilter = (req, file, cb) => {
  const name = file.originalname.toLowerCase();
  const extOk = ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
  const mimeOk = ALLOWED_MIMETYPES.includes(file.mimetype);
  if (extOk || mimeOk) {
    cb(null, true);
  } else {
    cb(new Error('Only CSV, Excel (.xlsx/.xls), or PDF files are allowed for import'));
  }
};

// 10MB — PDFs and formatted spreadsheets run larger than plain CSV
module.exports = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });
