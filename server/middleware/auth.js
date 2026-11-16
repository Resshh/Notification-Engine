/**
 * Authentication Middleware
 * Story 1.4 | Sprint 1
 * Ref: Sub-task #38, FR-04, BR-07
 *
 * Populates req.user from the login token (JWT).
 */

const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
  // If user is already set by upstream session/passport, preserve it
  if (req.user && req.user._id) {
    return next();
  }

  // Otherwise use the login token; no valid token leaves req.user unset (adminOnly -> 401)
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { ...user, _id: user.id };
  } catch {
    req.user = undefined;
  }
  return next();
}

module.exports = authMiddleware;

// ---- Batch 1: real login checks (FR-01, FR-02, BR-08) ----
// requireAuth: request must carry a valid login token.
// requireAdmin: and the user must be an admin.

function requireAuth(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET); // { id, name, role }
    next();
  } catch {
    res.status(401).json({ error: "Please log in" });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Admins only" });
    next();
  });
}

module.exports.requireAuth = requireAuth;
module.exports.requireAdmin = requireAdmin;
