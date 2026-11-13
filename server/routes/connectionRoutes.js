const express = require("express");

const adminOnly = require("../middleware/adminOnly");

const {
  createConnection,
  getConnections,
  getConnectionById,
  updateConnection,
  deleteConnection
} = require("../controllers/connectionController");

const {
  testConnectionTransient,
  testConnectionById
} = require("../controllers/connectionTestController");

const router = express.Router();

// ======================================
// Administrator Authorization
// ======================================

// Protect all connection management endpoints.
router.use(adminOnly);

// ======================================
// Story 1.1 - Create Connection
// ======================================

// POST /api/connections
router.post("/", createConnection);

// ======================================
// Story 1.3 - Test Connection
// ======================================

// POST /api/connections/test
// Test connection details before saving.
router.post("/test", testConnectionTransient);

// POST /api/connections/:id/test
// Test an existing saved connection.
router.post("/:id/test", testConnectionById);

// ======================================
// Story 1.2 - View Connections
// ======================================

// GET /api/connections
// List all saved connections.
router.get("/", getConnections);

// GET /api/connections/:id
// View a specific connection.
router.get("/:id", getConnectionById);

// ======================================
// Story 1.2 - Update Connection
// ======================================

// PUT /api/connections/:id
router.put("/:id", updateConnection);

// PATCH /api/connections/:id
router.patch("/:id", updateConnection);

// ======================================
// Story 1.2 - Delete Connection
// ======================================

// DELETE /api/connections/:id
router.delete("/:id", deleteConnection);

module.exports = router;