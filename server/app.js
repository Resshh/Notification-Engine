
const express = require("express");
const cors = require("cors");

const app = express();

// Batch 1: Authentication and recipient lists
const authRoutes = require("./routes/auth");
const recipientListRoutes = require("./routes/recipientList");

// Batch 2: Connections, queries and reports
const connectionRoutes = require("./routes/connectionRoutes");
const queryRoutes = require("./routes/queryRoutes");
const reportRoutes = require("./routes/reportRoutes");

// Central error handler
const errorHandler = require("./middleware/errorHandler");

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    ok: true,
    success: true,
    testMode: process.env.TEST_MODE === "true",
    message: "Notification Engine API is running"
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.send("Server running");
});

// Batch 1 routes
app.use("/api/auth", authRoutes);
app.use("/api/recipient-lists", recipientListRoutes);

// Batch 2 routes
app.use("/api/queries", queryRoutes);
app.use("/api/query-preview", queryRoutes);
app.use("/api/connections", connectionRoutes);
app.use("/api/reports", reportRoutes);

// Error handler must be last
app.use(errorHandler);

module.exports = app;
