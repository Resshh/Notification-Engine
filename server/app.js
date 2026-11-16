require("dotenv").config();

const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const recipientListRoutes = require("./routes/recipientList");
const connectionRoutes = require("./routes/connectionRoutes");
const queryRoutes = require("./routes/queryRoutes");
const reportRoutes = require("./routes/reportRoutes");
const templateRoutes = require("./routes/TemplateRoutes");
const runHistoryRoutes = require("./routes/runHistoryRoutes");
const jobsRoutes = require("./routes/jobs");
const runsRoutes = require("./routes/runs");
const querySampleRoutes = require("./routes/queries");
const errorHandler = require("./middleware/errorHandler");
const { isTestMode } = require("./engine/mailer");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send("Server running");
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    ok: true,
    success: true,
    status: "ok",
    testMode: isTestMode(),
    message: "Notification Engine API is running"
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/recipient-lists", recipientListRoutes);
app.use("/api/queries", querySampleRoutes);
app.use("/api/queries", queryRoutes);
app.use("/api/query-preview", queryRoutes);
app.use("/api/connections", connectionRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/run-history", runHistoryRoutes);
app.use("/api/jobs", jobsRoutes);
app.use("/api/runs", runsRoutes);

app.use((err, req, res, next) => {
  if (err.status && !err.statusCode) {
    err.statusCode = err.status;
  }

  errorHandler(err, req, res, next);
});

if (require.main === module) {
  const connectDB = require("./config/db");
  const port = process.env.PORT || 5000;

  connectDB().then(() => {
    app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  });
}

module.exports = app;
