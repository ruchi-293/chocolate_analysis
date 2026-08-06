const express = require('express');
const router = express.Router();
const ActivityLog = require('../models/ActivityLog');
const { protect, authorize } = require('../middleware/auth');

// GET /api/activity-logs?page=1&limit=50
router.get('/', protect, authorize('admin'), async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(parseInt(limit, 10) || 50, 200);

  const [items, total] = await Promise.all([
    ActivityLog.find()
      .populate('user', 'name email')
      .sort('-createdAt')
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    ActivityLog.countDocuments(),
  ]);

  res.json({ success: true, data: items, pagination: { page: pageNum, limit: limitNum, total } });
});

module.exports = router;
