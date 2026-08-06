const User = require('../models/User');

// POST /api/users/favorites  { reportId }
exports.addFavorite = async (req, res) => {
  const { reportId } = req.body;
  if (!reportId) return res.status(400).json({ success: false, message: 'reportId is required' });
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $addToSet: { favoriteReports: reportId } },
    { new: true }
  );
  res.json({ success: true, favoriteReports: user.favoriteReports });
};

// DELETE /api/users/favorites/:reportId
exports.removeFavorite = async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $pull: { favoriteReports: req.params.reportId } },
    { new: true }
  );
  res.json({ success: true, favoriteReports: user.favoriteReports });
};

// GET /api/users/notifications
exports.getNotifications = async (req, res) => {
  const user = await User.findById(req.user._id).select('notifications');
  res.json({ success: true, data: user.notifications });
};

// PUT /api/users/notifications/:id/read
exports.markNotificationRead = async (req, res) => {
  const user = await User.findById(req.user._id);
  const notif = user.notifications.id(req.params.id);
  if (!notif) return res.status(404).json({ success: false, message: 'Notification not found' });
  notif.read = true;
  await user.save();
  res.json({ success: true });
};

// ---- Admin: user management ----

// GET /api/users  (admin only)
exports.listUsers = async (req, res) => {
  const users = await User.find().select('name email role isActive isEmailVerified createdAt lastLoginAt');
  res.json({ success: true, data: users });
};

// PUT /api/users/:id/role  (admin only)  { role: 'admin' | 'user' }
exports.updateRole = async (req, res) => {
  const { role } = req.body;
  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ success: false, message: 'role must be "admin" or "user"' });
  }
  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('name email role');
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, data: user });
};

// PUT /api/users/:id/status  (admin only)  { isActive: boolean }
exports.updateStatus = async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { isActive: !!req.body.isActive },
    { new: true }
  ).select('name email isActive');
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, data: user });
};
