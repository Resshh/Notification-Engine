
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");

const app = express();

// Middleware
app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    testMode: process.env.TEST_MODE === "true"
  });
});

// Authentication routes
app.use("/api/auth", require("./routes/auth"));

// Recipient List routes
app.use("/api/recipient-lists", require("./routes/recipientList"));

// Database Connection routes
app.use("/api/connections", require("./routes/connectionRoutes"));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err);

  res.status(err.status || 500).json({
    error: err.status ? err.message : "Something went wrong"
  });
});

// Connect MongoDB and start server
const PORT = process.env.PORT || 5000;

if (!process.env.MONGO_URI) {
  console.error("MONGO_URI is not configured");
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err);
    process.exit(1);
  });
