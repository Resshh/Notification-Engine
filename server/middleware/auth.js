const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  if (req.user && req.user._id) {
    return next();
  }

  const authorization = req.headers.authorization || "";
  const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);

  if (!tokenMatch) {
    return res.status(401).json({
      success: false,
      error: "Please log in"
    });
  }

  try {
    const user = jwt.verify(tokenMatch[1], process.env.JWT_SECRET);
    req.user = {
      ...user,
      _id: user.id || user._id
    };
    return next();
  } catch {
    return res.status(401).json({
      success: false,
      error: "Please log in"
    });
  }
}

function requireAdmin(req, res, next) {
  return requireAuth(req, res, () => {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Admins only"
      });
    }

    return next();
  });
}

module.exports = requireAuth;
module.exports.requireAuth = requireAuth;
module.exports.requireAdmin = requireAdmin;
