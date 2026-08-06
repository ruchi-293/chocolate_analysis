require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const ensureAdminExists = require('./utils/seedAdmin');

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const metricsRoutes = require('./routes/metricsRoutes');
const userRoutes = require('./routes/userRoutes');
const factoryRoutes = require('./routes/factoryRoutes');
const orderRoutes = require('./routes/orderRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const activityLogRoutes = require('./routes/activityLogRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const productionRoutes = require('./routes/productionRoutes');
const salesRoutes = require('./routes/salesRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');

const app = express();

// ---- CORS ----
// Reads allowed origins from .env (comma-separated ALLOWED_ORIGINS, falling
// back to CLIENT_URL). Also allows requests with no Origin header (curl,
// Postman, server-to-server) and 'null' origin (a frontend HTML file opened
// directly from disk with file://, which is common while developing this
// project before it's served from a real dev server).
const configuredOrigins = (process.env.ALLOWED_ORIGINS || process.env.CLIENT_URL || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const devDefaultOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
];

const allowedOrigins = [...new Set([...configuredOrigins, ...devDefaultOrigins])];

app.use(
  cors({
    origin(origin, callback) {
      // No origin (curl/Postman/native apps) or a file:// page (origin === 'null')
      if (!origin || origin === 'null') return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      console.warn(`[CORS] Blocked request from unlisted origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

// ---- Core middleware ----
app.use(helmet());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Basic rate limiting on auth endpoints to slow brute-force attempts
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50 });
app.use('/api/auth', authLimiter);

// ---- Routes ----
app.get('/api/health', (req, res) => res.json({ success: true, message: 'ChocoAnalytics API is running' }));

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/factories', factoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/inventory', inventoryRoutes);

// ---- 404 handler ----
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// ---- Global error handler ----
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
});

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => ensureAdminExists()) // auto-create the first admin from .env if none exists yet
  .then(() => {
    app.listen(PORT, () => console.log(`ChocoAnalytics API listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });

module.exports = app;
