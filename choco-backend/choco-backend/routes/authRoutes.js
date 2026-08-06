const express = require('express');
const router = express.Router();
const auth = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/signup', auth.signup);
router.post('/login', auth.login);
router.post('/admin-login', auth.adminLogin);
router.get('/verify-email', auth.verifyEmail);
router.post('/forgot-password', auth.forgotPassword);
router.post('/reset-password', auth.resetPassword);
router.get('/me', protect, auth.getMe);

module.exports = router;
