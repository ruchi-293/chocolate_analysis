const express = require('express');
const router = express.Router();
const users = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');

// Registered user self-service
router.post('/favorites', protect, users.addFavorite);
router.delete('/favorites/:reportId', protect, users.removeFavorite);
router.get('/notifications', protect, users.getNotifications);
router.put('/notifications/:id/read', protect, users.markNotificationRead);

// Admin: user & role management
router.get('/', protect, authorize('admin'), users.listUsers);
router.put('/:id/role', protect, authorize('admin'), users.updateRole);
router.put('/:id/status', protect, authorize('admin'), users.updateStatus);

module.exports = router;
