/**
 * Story 1.3 - Test Database Connections
 *
 * Endpoints:
 * POST /api/connections/test
 * POST /api/connections/:id/test
 *
 * Supports:
 * - Testing unsaved connection details
 * - Testing saved connections
 * - Admin-only access
 * - Safe responses without credentials
 */

const {
  testConnectionDetails,
  testSavedConnection
} = require("../services/connectionService");

// Validate MongoDB ObjectId format.
const isValidId = (id) =>
  typeof id === "string" &&
  /^[0-9a-fA-F]{24}$/.test(id);

// Verify administrator access.
const checkAdmin = (req, res) => {
  if (!req.user || !req.user._id) {
    res.status(401).json({
      success: false,
      message: "Authentication required"
    });

    return false;
  }

  if (req.user.role !== "admin") {
    res.status(403).json({
      success: false,
      message: "Admin access required"
    });

    return false;
  }

  return true;
};

// ============================================================
// TEST UNSAVED CONNECTION
// POST /api/connections/test
// ============================================================

const testConnectionTransient = async (req, res, next) => {
  try {
    if (!checkAdmin(req, res)) {
      return;
    }

    if (
      !req.body ||
      typeof req.body !== "object" ||
      Array.isArray(req.body)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid connection details"
      });
    }

    const result = await testConnectionDetails(req.body);

    return res.status(200).json({
      success: true,
      ok: result.ok,
      message: result.message
    });
  } catch (error) {
    if (
      [
        "Invalid connection details",
        "Invalid connection type",
        "All connection fields are required",
        "Invalid port number"
      ].includes(error.message)
    ) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return next(error);
  }
};

// ============================================================
// TEST SAVED CONNECTION
// POST /api/connections/:id/test
// ============================================================

const testConnectionById = async (req, res, next) => {
  try {
    if (!checkAdmin(req, res)) {
      return;
    }

    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid connection ID"
      });
    }

    const result = await testSavedConnection(id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Connection not found"
      });
    }

    return res.status(200).json({
      success: true,
      ok: result.ok,
      message: result.message,
      lastTestStatus: result.lastTestStatus,
      lastTestedAt: result.lastTestedAt
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  testConnectionTransient,
  testConnectionById
};