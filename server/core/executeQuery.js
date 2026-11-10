/**
 * executeQuery — Internal query execution engine
 * Story 6.2 | Sprint 1
 * Ref: FR-17, FR-18, sub-tasks #182, #184, #185, #186
 *
 * Orchestrates the full pipeline for one query execution:
 *   1. Load the saved query document
 *   2. Load its connection and decrypt the password
 *   3. Validate the query (shared validator)
 *   4. Pick the right connector (HANA / SQL Server / Service Layer)
 *   5. Run the query
 *   6. Format the result into the common shape
 *
 * Used internally by runQuery() and by the Test Query API (Story 5.2).
 */

// ======================================
// Imports
// ======================================

const { decryptPassword } = require("../security/crypto");
const { validateQuerySafety } = require("../security/validator");
const { sanitizeError } = require("../security/sanitiser");
const { formatResult } = require("./formatter");

const Connection = require("../models/Connection");
const Query = require("../models/Query");

// ======================================
// Connector Registry
// ======================================

// Each connector is loaded lazily so the server can start
// even when an optional connector is unavailable.

function getConnector(type) {
  const connectorMap = {
    "SAP HANA": () => require("../connectors/hana"),

    "HANA": () => require("../connectors/hana"),

    "SQL Server": () => require("../connectors/sqlServer"),

    "SQLServer": () => require("../connectors/sqlServer"),

    "Service Layer": () =>
      require("../connectors/serviceLayerClient"),

    "ServiceLayer": () =>
      require("../connectors/serviceLayerClient")
  };

  const loader = connectorMap[type];

  if (!loader) {
    throw new Error(`Unknown connection type: '${type}'.`);
  }

  return loader();
}

// ======================================
// Source Names
// ======================================

const SOURCE_NAMES = {
  "SAP HANA": "HANA",
  "HANA": "HANA",

  "SQL Server": "SQLServer",
  "SQLServer": "SQLServer",

  "Service Layer": "ServiceLayer",
  "ServiceLayer": "ServiceLayer"
};

// ======================================
// Merge Query Parameters
// ======================================

/**
 * Merge saved query parameters with runtime parameters.
 *
 * Runtime parameters override saved defaults.
 *
 * @param {Array} savedParams
 * @param {Object} runtimeParams
 * @returns {Object}
 */

function mergeParams(savedParams = [], runtimeParams = {}) {
  const merged = {};

  // Add saved parameter defaults.
  for (const param of savedParams) {
    if (param && param.name) {
      merged[param.name] =
        param.defaultValue !== undefined
          ? param.defaultValue
          : null;
    }
  }

  // Override defaults using runtime parameters.
  for (const [key, value] of Object.entries(runtimeParams)) {
    merged[key] = value;
  }

  return merged;
}

// ======================================
// Execute Query
// ======================================

/**
 * Execute a saved query using its configured data source.
 *
 * @param {Object} queryDoc
 * @param {Object} runtimeParams
 * @param {Object} options
 *
 * @returns {Promise<{ columns, rows, meta }>}
 */

async function executeQuery(queryDoc, runtimeParams = {}, options = {}) {
  let connectionDoc;

  try {
    // ======================================
    // Step 1: Load Database Connection
    // ======================================

    // passwordEncrypted has select:false in the Connection model.
    // Explicitly retrieve it for internal query execution.

    connectionDoc = await Connection.findById(queryDoc.connectionId)
      .select("+passwordEncrypted")
      .lean();

    if (!connectionDoc) {
      throw new Error(
        `Connection not found for query '${queryDoc.name}'.`
      );
    }

    // ======================================
    // Step 2: Decrypt Connection Password
    // ======================================

    // Separate the encrypted password from connection details.
    const {
      passwordEncrypted,
      ...connectionWithoutCiphertext
    } = connectionDoc;

    if (!passwordEncrypted) {
      throw new Error(
        "Saved connection credentials are unavailable."
      );
    }

    // Decrypt using the shared encryption utility.
    const plainPassword = decryptPassword(passwordEncrypted);

    // Pass only the required connection details to the connector.
    // Do not include passwordEncrypted.

    const connectionDetails = {
      ...connectionWithoutCiphertext,
      password: plainPassword
    };

    // ======================================
    // Step 3: Validate Query
    // ======================================

    const validation = validateQuerySafety({
      kind: queryDoc.kind,
      queryText: queryDoc.queryText,
      entity: queryDoc.entity,
      filter: queryDoc.filter,
      select: queryDoc.select,
      params: queryDoc.params,
      execApproved: queryDoc.execApproved
    });

    if (!validation.valid) {
      throw new Error(
        `Query blocked: ${validation.error}`
      );
    }

    // ======================================
    // Step 4: Merge Query Parameters
    // ======================================

    const mergedParams = mergeParams(
      queryDoc.params,
      runtimeParams
    );

    // ======================================
    // Step 5: Apply Row Limit
    // ======================================

    // Runtime limit overrides the query's configured limit.

    const effectiveLimit =
      options.limit !== undefined
        ? options.limit
        : (
            queryDoc.rowLimit ||
            parseInt(process.env.MAX_ROW_LIMIT, 10) ||
            1000
          );

    // ======================================
    // Step 6: Select Connector
    // ======================================

    const connector = getConnector(connectionDoc.type);

    // ======================================
    // Step 7: Execute Query
    // ======================================

    const raw = await connector.executeQuery(
      connectionDetails,
      queryDoc,
      mergedParams,
      {
        limit: effectiveLimit
      }
    );

    // ======================================
    // Step 8: Format Query Result
    // ======================================

    const sourceName =
      SOURCE_NAMES[connectionDoc.type] ||
      connectionDoc.type;

    const formatted = formatResult(
      raw,
      sourceName,
      queryDoc.columnMapping || {}
    );

    return formatted;

  } catch (error) {
    // ======================================
    // Error Handling
    // ======================================

    // Sanitize errors before returning them.
    // Do not expose passwords or sensitive connection details.

    const safeError = sanitizeError(error);

    throw new Error(safeError.message);
  }
}

// ======================================
// Exports
// ======================================

module.exports = {
  executeQuery,
  mergeParams
};