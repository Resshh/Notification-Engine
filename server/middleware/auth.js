const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
//   || ''
// This is a fallback.
// If the Authorization header is missing (undefined), it uses an empty string instead.

// .replace('Bearer ', '')
// Removes the word Bearer  from the beginning of the token.
// So:Bearer abc123xyz
// becomes:abc123xyz

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET); 

// jwt.verify() checks whether the token is valid using the secret key.
// process.env.JWT_SECRET gets the secret key from the environment variables.
// If the token is valid, jwt.verify() returns the payload stored inside the token.Its given to req.user 
// so that it can be used in the next middleware or route handler.

    next(); // If the token is valid, Express moves to the next middleware or route handler.
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
