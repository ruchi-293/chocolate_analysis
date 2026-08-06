const User = require('../models/User');

/**
 * Ensures at least one admin account exists, using SEED_ADMIN_EMAIL /
 * SEED_ADMIN_PASSWORD from .env. Safe to call every time the server
 * starts — it's a no-op if an admin already exists. Password is hashed
 * automatically by the User model's pre-save bcrypt hook.
 */
async function ensureAdminExists() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn(
      '[seedAdmin] SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set in .env — skipping automatic admin creation. ' +
        'Set them in .env or run "npm run seed" to create an admin manually.'
    );
    return null;
  }

  const existingAdmin = await User.findOne({ role: 'admin' });
  if (existingAdmin) {
    return existingAdmin; // at least one admin already exists, nothing to do
  }

  const existingByEmail = await User.findOne({ email: email.toLowerCase() });
  if (existingByEmail) {
    // Email is taken by a non-admin account — promote it rather than fail silently
    existingByEmail.role = 'admin';
    await existingByEmail.save();
    console.log(`[seedAdmin] Promoted existing account to admin: ${email}`);
    return existingByEmail;
  }

  const admin = await User.create({
    name: 'ChocoAnalytics Admin',
    email,
    password,
    role: 'admin',
    isEmailVerified: true,
  });
  console.log(`[seedAdmin] Created first admin account: ${email}`);
  return admin;
}

module.exports = ensureAdminExists;
