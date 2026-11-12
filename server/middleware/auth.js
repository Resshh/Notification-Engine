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
