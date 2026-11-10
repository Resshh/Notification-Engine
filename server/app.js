const express = require("express");
const cors = require("cors");

// ======================================
// Route Imports
// ======================================

const connectionRoutes = require("./routes/connectionRoutes");
const queryRoutes = require("./routes/queryRoutes");

// ======================================
// Middleware Imports
// ======================================

const errorHandler = require("./middleware/errorHandler");

// ======================================
// Express Application
// ======================================

const app = express();

// ======================================
// Global Middleware
// ======================================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ======================================
// Root Endpoint
// ======================================

app.get("/", (req, res) => {
  res.send("Server running");
});

// ======================================
// Health Check API
// ======================================

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Notification Engine API is running"
  });
});

// ======================================
// Batch 2 - Query Management Routes
// ======================================

// Stories 5.1, 5.2 and 5.4
app.use("/api/queries", queryRoutes);
app.use("/api/query-preview", queryRoutes);

// ======================================
// Batch 2 - Connection Management Routes
// ======================================

// Stories 1.1 and 1.4
app.use("/api/connections", connectionRoutes);

// ======================================
// Central Error Handler
// ======================================

// Must be registered after all application routes.
app.use(errorHandler);

// ======================================
// Export Express Application
// ======================================

module.exports = app;