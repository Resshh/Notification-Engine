const mongoose = require("mongoose");
const { DeliveryLog, Job, JobRun } = require("../models");
const { sanitizeMessage } = require("../security/sanitiser");

function serializeRun(run) {
  const job = run.jobId && typeof run.jobId === "object"
    ? run.jobId
    : null;

  return {
    id: String(run._id),
    jobId: job?._id ? String(job._id) : String(run.jobId || ""),
    jobName: job?.name || "Deleted job",
    manual: run.manual,
    startTime: run.startTime,
    endTime: run.endTime,
    rowsFetched: run.rowsFetched,
    rowsMatched: run.rowsMatched,
    emailsSent: run.emailsSent,
    skippedDuplicates: run.skippedDuplicates,
    failed: run.failed,
    status: run.status,
    error: run.error ? sanitizeMessage(run.error) : run.error
  };
}

async function getRunHistory(req, res, next) {
  try {
    const [jobs, runs] = await Promise.all([
      Job.find().select("name").sort({ name: 1 }).lean(),
      JobRun.find()
        .sort({ startTime: -1 })
        .populate({ path: "jobId", select: "name" })
        .lean()
    ]);

    return res.json({
      jobs: jobs.map((job) => ({ id: String(job._id), name: job.name })),
      runs: runs.map(serializeRun)
    });
  } catch (error) {
    return next(error);
  }
}

async function getRunDeliveries(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid run ID." });
    }

    const run = await JobRun.findById(id)
      .populate({ path: "jobId", select: "name" })
      .lean();

    if (!run) {
      return res.status(404).json({ message: "Run not found." });
    }

    const deliveryLogs = await DeliveryLog.find({ runId: id })
      .sort({ createdAt: 1 })
      .lean();

    return res.json({
      run: serializeRun(run),
      deliveryLogs: deliveryLogs.map((log) => ({
        id: String(log._id),
        recipient: log.recipient,
        subject: log.subject,
        status: log.status,
        retryCount: log.retryCount,
        errorMessage: log.errorMessage ? sanitizeMessage(log.errorMessage) : log.errorMessage,
        createdAt: log.createdAt
      }))
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getRunHistory,
  getRunDeliveries
};
