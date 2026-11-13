// requireAuth: request must carry a valid login token (FR-01).
// requireAdmin: and the user must be an admin (FR-02, BR-08).
// Use on routes:  router.post('/', requireAdmin, handler)
const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET); // { id, name, role }
    next();
  } catch {
    res.status(401).json({ error: 'Please log in' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
    next();
  });
}

module.exports = { requireAuth, requireAdmin };
/**
 * Authentication Middleware
 * Story 1.4 | Sprint 1
 * Ref: Sub-task #38, FR-04, BR-07
 *
 * Populates req.user. In development, provides a stub admin user
 * until Batch 1 central authentication is integrated.
 */

const mongoose = require("mongoose");

const DEFAULT_ADMIN_ID = new mongoose.Types.ObjectId("672000000000000000000001");

const DEFAULT_ADMIN_USER = {
  _id: DEFAULT_ADMIN_ID,
  username: "admin",
  email: "admin@notificationengine.local",
  role: "admin"
};

function authMiddleware(req, res, next) {
  // If user is already set by upstream session/passport, preserve it
  if (req.user && req.user._id) {
    return next();
  }

  // Allow role override via header for testing
  const roleHeader = req.headers["x-user-role"];
  if (roleHeader) {
    req.user = {
      ...DEFAULT_ADMIN_USER,
      role: roleHeader
    };
    return next();
  }

  // Attach default admin user for development
  req.user = { ...DEFAULT_ADMIN_USER };
  return next();
}

module.exports = authMiddleware;
