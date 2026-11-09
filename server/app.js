const express = require("express");
const cors = require("cors");

const queryRoutes = require("./routes/queryRoutes");
const connectionRoutes = require("./routes/connectionRoutes");

const errorHandler = require("./middleware/errorHandler");

const app = express();

// Standard middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root endpoint
app.get("/", (req, res) => {
  res.send("Server running");
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Notification Engine API is running"
  });
});

// Query Management & Test Preview API (Story 5.1 & Story 5.2)
app.use("/api/queries", queryRoutes);
app.use("/api/query-preview", queryRoutes);

// Database Connection Management API
app.use("/api/connections", connectionRoutes);

// Central error handler - must be registered last
app.use(errorHandler);

module.exports = app;
