
const express = require("express");
const cors = require("cors");

const app = express();

// Batch 1: Authentication and recipient lists
const authRoutes = require("./routes/auth");
const recipientListRoutes = require("./routes/recipientList");
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

// Batch 2: Connections, queries and reports
const connectionRoutes = require("./routes/connectionRoutes");
const queryRoutes = require("./routes/queryRoutes");
const reportRoutes = require("./routes/reportRoutes");

// Central error handler
const errorHandler = require("./middleware/errorHandler");

// Middleware
const authRoutes = require("./routes/auth");
const recipientListRoutes = require("./routes/recipientList");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/", (req, res) => {
  res.send("Server running");
});

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
    status: "ok",
    message: "Notification Engine API is running",
    testMode: process.env.TEST_MODE === "true"
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/recipient-lists", recipientListRoutes);
app.use("/api/queries", queryRoutes);
app.use("/api/query-preview", queryRoutes);
app.use("/api/connections", connectionRoutes);
app.use("/api/reports", reportRoutes);

// Error handler must be last
app.use(errorHandler);

app.use((err, req, res, next) => {
  if (err.status && !err.statusCode) err.statusCode = err.status;
  errorHandler(err, req, res, next);
});

if (require.main === module) {
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
}

module.exports = app;
