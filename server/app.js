require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const connectionRoutes = require("./routes/connectionRoutes");
const queryRoutes = require("./routes/queryRoutes");
const reportRoutes = require("./routes/reportRoutes");
const authRoutes = require("./routes/auth");
const recipientListRoutes = require("./routes/recipientLists");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send("Server running");
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "ok",
    message: "Notification Engine API is running",
    testMode: process.env.TEST_MODE !== "false" // same rule as engine/mailer.js
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/recipient-lists", recipientListRoutes);
app.use("/api/templates", require("./routes/TemplateRoutes"));
app.use("/api/jobs", require("./routes/jobs"));
app.use("/api/runs", require("./routes/runs"));
app.use("/api/queries", require("./routes/queries")); // Batch 1: GET /:id/sample
app.use("/api/queries", queryRoutes);
app.use("/api/query-preview", queryRoutes);
app.use("/api/connections", connectionRoutes);
app.use("/api/reports", reportRoutes);

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
    .then(async () => {
      await require("./engine/scheduler").startScheduler();
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
