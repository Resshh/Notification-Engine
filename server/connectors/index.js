/**
 * Connector Dispatcher & Test Connection Router
 * Story 1.3 | Sprint 2
 * Ref: FR-03, Sub-tasks #31, #32, #33
 *
 * Dispatches testConnection requests to the appropriate connector module:
 *   - SQLServer: server/connectors/sqlServer.js
 *   - HANA: server/connectors/hana.js
 *   - ServiceLayer: server/connectors/serviceLayerClient.js
 *
 * Enforces production-host safety checks (Rule BR-02).
 */

const { isProductionHost } = require("../security/hostCheck");
const { sanitizeError } = require("../security/sanitiser");

function getConnector(type) {
  const normalized = (type || "").trim();

  if (normalized === "SQLServer" || normalized === "SQL Server") {
    return require("./sqlServer");
  }

  if (normalized === "HANA" || normalized === "SAP HANA") {
    return require("./hana");
  }

  if (normalized === "ServiceLayer" || normalized === "Service Layer") {
    return require("./serviceLayerClient");
  }

  throw new Error(
    `Unknown connection type: '${type}'. Supported types: SQLServer, HANA, ServiceLayer.`
  );
}

/**
 * Dispatches connection test to the corresponding connector.
 *
 * @param {object} connectionDetails - Decrypted connection details
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
async function testConnection(connectionDetails) {
  if (!connectionDetails || typeof connectionDetails !== "object") {
    return { ok: false, message: "Invalid connection details provided." };
  }

  // Enforce production host guard (BR-02)
  const hostCheck = isProductionHost(connectionDetails.host, connectionDetails.database);
  if (!hostCheck.ok) {
    return { ok: false, message: hostCheck.reason };
  }

  try {
    const connector = getConnector(connectionDetails.type);
    const result = await connector.testConnection(connectionDetails);

    return {
      ok: Boolean(result?.ok),
      message: result?.message || (result?.ok ? "Connection test successful." : "Connection test failed.")
    };
  } catch (err) {
    const safe = sanitizeError(err);
    return {
      ok: false,
      message: safe.message || "Connection test failed."
    };
  }
}

module.exports = {
  testConnection,
  getConnector
};
