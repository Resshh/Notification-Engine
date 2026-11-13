
const jwt = require("jsonwebtoken");

// Verify JWT token and identify the logged-in user.
function requireAuth(req, res, next) {
  const authorization = req.headers.authorization || "";
  const match = authorization.match(/^Bearer\s+(\S+)$/i);

  if (!match) {
    return res.status(401).json({
      error: "Authentication required"
    });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({
      error: "Server authentication is not configured"
    });
  }

  try {
    const decoded = jwt.verify(match[1], process.env.JWT_SECRET, {
      algorithms: ["HS256"]
    });

    if (!decoded.id || !decoded.role) {
      return res.status(401).json({
        error: "Invalid authentication token"
      });
    }

    req.user = {
      _id: decoded.id,
      username: decoded.name || "",
      role: decoded.role
    };

    return next();
  } catch (error) {
    return res.status(401).json({
      error: "Invalid or expired authentication token"
    });
  }
}

// Only authenticated administrators can access protected routes.
function requireAdmin(req, res, next) {
  return requireAuth(req, res, () => {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        error: "Admin access required"
      });
    }

    return next();
  });
}

// Default export supports existing Batch 2 connectionRoutes.js.
module.exports = requireAuth;

// Named exports support Batch 1 recipientList.js.
module.exports.requireAuth = requireAuth;
module.exports.requireAdmin = requireAdmin;
