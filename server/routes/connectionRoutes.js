const express = require("express");

const authMiddleware = require("../middleware/auth");
const adminOnly = require("../middleware/adminOnly");

const {
  createConnection,
  getConnections,
  getConnectionById,
  updateConnection,
  deleteConnection,
  testConnectionController
} = require("../controllers/connectionController");

const router = express.Router();

// ======================================
// Authentication & Administrator Authorization
// ======================================

// Ensure req.user is set (dev stub if unauthenticated) then check admin role
router.use(authMiddleware);
router.use(adminOnly);

// ======================================
// Story 1.3 — Test Connection
// ======================================

// POST /api/connections/test (test unsaved form details)
router.post("/test", testConnectionController);

// POST /api/connections/:id/test (test saved connection)
router.post("/:id/test", testConnectionController);

// ======================================
// Story 1.1 — Create Connection
// ======================================

// POST /api/connections
router.post("/", createConnection);

// ======================================
// Story 1.2 — View Connections
// ======================================

// GET /api/connections
// List all saved connections.
router.get("/", getConnections);

// GET /api/connections/:id
// View a specific connection.
router.get("/:id", getConnectionById);

// ======================================
// Story 1.2 — Update Connection
// ======================================

// PUT /api/connections/:id
router.put("/:id", updateConnection);

// PATCH /api/connections/:id
router.patch("/:id", updateConnection);

// ======================================
// Story 1.2 — Delete Connection
// ======================================

// DELETE /api/connections/:id
router.delete("/:id", deleteConnection);

module.exports = router;