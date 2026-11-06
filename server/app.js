// Load environment variables
require("dotenv").config();

const express = require("express");

// Batch 2 - Database Connection Routes
const connectionRoutes = require("./routes/connectionRoutes");

const app = express();

// Middleware
app.use(express.json());

// Health Check API
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok"
  });
});

// ======================================
// Register Application Routes
// ======================================

// Batch 1 - Notification Engine
// Batch 1 routes will be registered here.

// Batch 2 - Data Connectors
app.use("/api/connections", connectionRoutes);

// ======================================
// Start Server
// ======================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});