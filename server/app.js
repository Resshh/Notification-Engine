const express = require("express");

// ======================================
// Batch 2 Routes
// ======================================

const connectionRoutes = require("./routes/connectionRoutes");

// ======================================
// Express Application
// ======================================

const app = express();

// ======================================
// Global Middleware
// ======================================

app.use(express.json());

// ======================================
// Health Check API
// ======================================

app.get("/api/health", (req, res) => {
  return res.status(200).json({
    status: "ok"
  });
});

// ======================================
// Application Routes
// ======================================

// Batch 1 - Notification Engine
// Batch 1 routes will be registered here.

// Batch 2 - Data Connectors
app.use("/api/connections", connectionRoutes);

// ======================================
// Export Express Application
// ======================================

module.exports = app;