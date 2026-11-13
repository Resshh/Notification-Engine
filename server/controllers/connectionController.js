const Connection = require("../models/Connection");
const { encryptPassword } = require("../security/crypto");

// ======================================
// Shared Helpers
// ======================================

const CONNECTION_TYPES = ["SQLServer", "HANA", "ServiceLayer"];

const UPDATABLE_FIELDS = [
  "name",
  "type",
  "host",
  "port",
  "database",
  "username",
  "password"
];

// Return safe connection details without credentials.
const safeConnection = (connection) => ({
  id: connection._id,
  name: connection.name,
  type: connection.type,
  host: connection.host,
  port: connection.port,
  database: connection.database,
  username: connection.username,
  lastTestStatus: connection.lastTestStatus,
  lastTestedAt: connection.lastTestedAt
});

// Validate MongoDB ObjectId format.
const isValidId = (id) =>
  typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);

// Check authorization for connection management.
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

// Handle Mongoose validation errors.
const handleError = (error, res, next) => {
  if (
    error.name === "ValidationError" ||
    error.name === "CastError"
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid connection details"
    });
  }

  return next(error);
};

// ======================================
// Story 1.1 — Create Connection
// ======================================

const createConnection = async (req, res, next) => {
  try {
    // Authentication will be provided by the shared auth middleware.
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    // Only administrators can manage database connections.
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required"
      });
    }

    const {
      name,
      type,
      host,
      port,
      database,
      username,
      password
    } = req.body;

    // Validate required fields.
    if (
      typeof name !== "string" ||
      typeof type !== "string" ||
      typeof host !== "string" ||
      typeof database !== "string" ||
      typeof username !== "string" ||
      typeof password !== "string" ||
      !name.trim() ||
      !host.trim() ||
      !database.trim() ||
      !username.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "All connection fields are required"
      });
    }

    const parsedPort = Number(port);

    if (
      !Number.isInteger(parsedPort) ||
      parsedPort < 1 ||
      parsedPort > 65535
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid port number"
      });
    }

    if (!CONNECTION_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid connection type"
      });
    }

    // Encrypt the password before saving it.
    const passwordEncrypted = encryptPassword(password);

    const connection = await Connection.create({
      name: name.trim(),
      type,
      host: host.trim(),
      port: parsedPort,
      database: database.trim(),
      username: username.trim(),
      passwordEncrypted,
      createdBy: req.user._id
    });

    return res.status(201).json({
      success: true,
      message: "Connection created successfully",
      connection: safeConnection(connection)
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// Story 1.2 — View All Connections
// GET /api/connections
// ======================================

const getConnections = async (req, res, next) => {
  try {
    if (!checkAdmin(req, res)) {
      return;
    }

    // Passwords are excluded by the model's select:false setting.
    const connections = await Connection.find({})
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: connections.length,
      connections: connections.map(safeConnection)
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// Story 1.2 — View Connection By ID
// GET /api/connections/:id
// ======================================

const getConnectionById = async (req, res, next) => {
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

    const connection = await Connection.findById(id).lean();

    if (!connection) {
      return res.status(404).json({
        success: false,
        message: "Connection not found"
      });
    }

    return res.status(200).json({
      success: true,
      connection: safeConnection(connection)
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// Story 1.2 — Update Connection
// PUT /api/connections/:id
// PATCH /api/connections/:id
// ======================================

const updateConnection = async (req, res, next) => {
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

    const body = req.body;

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one field to update"
      });
    }

    const updates = {};

    // Only allow connection fields to be modified.
    for (const [field, value] of Object.entries(body)) {
      if (!UPDATABLE_FIELDS.includes(field)) {
        return res.status(400).json({
          success: false,
          message: `Field '${field}' cannot be updated`
        });
      }

      // Validate the connection type.
      if (field === "type") {
        if (!CONNECTION_TYPES.includes(value)) {
          return res.status(400).json({
            success: false,
            message: "Invalid connection type"
          });
        }

        updates.type = value;
        continue;
      }

      // Validate the port.
      if (field === "port") {
        if (
          typeof value !== "string" &&
          typeof value !== "number"
        ) {
          return res.status(400).json({
            success: false,
            message: "Invalid port number"
          });
        }

        const parsedPort = Number(value);

        if (
          !Number.isInteger(parsedPort) ||
          parsedPort < 1 ||
          parsedPort > 65535
        ) {
          return res.status(400).json({
            success: false,
            message: "Invalid port number"
          });
        }

        updates.port = parsedPort;
        continue;
      }

      // Encrypt replacement passwords.
      if (field === "password") {
        if (
          typeof value !== "string" ||
          !value.trim()
        ) {
          return res.status(400).json({
            success: false,
            message: "Password cannot be empty"
          });
        }

        updates.passwordEncrypted = encryptPassword(value);
        continue;
      }

      // Validate text fields.
      if (
        typeof value !== "string" ||
        !value.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: `Invalid ${field}`
        });
      }

      updates[field] = value.trim();
    }

    // Explicitly retrieve the existing encrypted password.
    // This allows the complete document to be validated on save.
    const connection = await Connection.findById(id)
      .select("+passwordEncrypted");

    if (!connection) {
      return res.status(404).json({
        success: false,
        message: "Connection not found"
      });
    }

    // Apply only validated changes.
    Object.assign(connection, updates);

    // Connection details changed, so previous test results may be stale.
    if (Object.keys(updates).some((field) => field !== "name")) {
      connection.lastTestStatus = "NOT_TESTED";
      connection.lastTestedAt = null;
    }

    // Save with Mongoose schema validation.
    await connection.save();

    return res.status(200).json({
      success: true,
      message: "Connection updated successfully",
      connection: safeConnection(connection)
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// Story 1.2 — Delete Connection
// DELETE /api/connections/:id
// ======================================

const deleteConnection = async (req, res, next) => {
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

    // Check if queries are using this connection (Story 1.2, Sub-task 25, BR-04)
    try {
      const mongoose = require("mongoose");
      const Query = require("../models/Query");
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        const attachedCount = await Query.countDocuments({ connectionId: id });
        if (attachedCount > 0) {
          return res.status(400).json({
            success: false,
            message: `Cannot delete connection: ${attachedCount} saved query(ies) are currently using it.`
          });
        }
      }
    } catch (e) {
      // Continue if query check fails non-critically
    }

    const connection = await Connection.findByIdAndDelete(id);

    if (!connection) {
      return res.status(404).json({
        success: false,
        message: "Connection not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Connection deleted successfully"
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// Story 1.3 — Test Connection
// POST /api/connections/test
// POST /api/connections/:id/test
// ======================================

const { testConnection: dispatchTestConnection } = require("../connectors/index");
const { decryptPassword } = require("../security/crypto");

const testConnectionController = async (req, res, next) => {
  try {
    if (!checkAdmin(req, res)) {
      return;
    }

    const { id } = req.params;
    let targetDetails;
    let savedConnectionDoc = null;

    if (id || req.body.id || req.body.connectionId) {
      const targetId = id || req.body.id || req.body.connectionId;
      if (!isValidId(targetId)) {
        return res.status(400).json({
          success: false,
          ok: false,
          message: "Invalid connection ID"
        });
      }

      savedConnectionDoc = await Connection.findById(targetId).select("+passwordEncrypted");
      if (!savedConnectionDoc) {
        return res.status(404).json({
          success: false,
          ok: false,
          message: "Connection not found"
        });
      }

      const password = req.body.password && typeof req.body.password === "string" && req.body.password.trim()
        ? req.body.password
        : decryptPassword(savedConnectionDoc.passwordEncrypted);

      targetDetails = {
        name: req.body.name || savedConnectionDoc.name,
        type: req.body.type || savedConnectionDoc.type,
        host: req.body.host || savedConnectionDoc.host,
        port: req.body.port ? Number(req.body.port) : savedConnectionDoc.port,
        database: req.body.database || savedConnectionDoc.database,
        username: req.body.username || savedConnectionDoc.username,
        password
      };
    } else {
      // Unsaved form testing
      const { name, type, host, port, database, username, password } = req.body;
      if (!type || !host || !database || !username) {
        return res.status(400).json({
          success: false,
          ok: false,
          message: "Missing connection details: type, host, database, and username are required."
        });
      }

      targetDetails = {
        name: name || "Transient Connection Test",
        type,
        host,
        port: port ? Number(port) : (type === "SQLServer" ? 1433 : type === "HANA" ? 39015 : 50000),
        database,
        username,
        password: password || ""
      };
    }

    const result = await dispatchTestConnection(targetDetails);

    // If testing a saved connection, store the result on the document (Sub-task 34)
    if (savedConnectionDoc) {
      savedConnectionDoc.lastTestStatus = result.ok ? "SUCCESS" : "FAILED";
      savedConnectionDoc.lastTestedAt = new Date();
      await savedConnectionDoc.save();
    }

    return res.status(200).json({
      success: result.ok,
      ok: result.ok,
      message: result.message,
      lastTestStatus: savedConnectionDoc ? savedConnectionDoc.lastTestStatus : (result.ok ? "SUCCESS" : "FAILED"),
      lastTestedAt: savedConnectionDoc ? savedConnectionDoc.lastTestedAt : new Date()
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ======================================
// Exports
// ======================================

module.exports = {
  createConnection,
  getConnections,
  getConnectionById,
  updateConnection,
  deleteConnection,
  testConnectionController
};