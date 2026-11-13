/**
 * Story 1.3 - Test Database Connections
 *
 * Supports:
 * - SQL Server
 * - SAP HANA
 * - SAP Business One Service Layer
 *
 * Security:
 * - Decrypts saved passwords only when testing.
 * - Blocks production-looking environments.
 * - Never returns credentials.
 * - Saves the latest test status for stored connections.
 */

const Connection = require("../models/Connection");

const { decryptPassword } = require("../security/crypto");

const { isProductionHost } = require("../security/hostCheck");

const CONNECTION_TYPES = [
  "SQLServer",
  "HANA",
  "ServiceLayer"
];

// Select the appropriate connector.
function getConnector(type) {
  switch (type) {
    case "SQLServer":
      return require("../connectors/sqlServer");

    case "HANA":
      return require("../connectors/hana");

    case "ServiceLayer":
      return require("../connectors/serviceLayerClient");

    default:
      return null;
  }
}

// Validate the connection details before testing.
function validateConnectionDetails(details) {
  if (!details || typeof details !== "object") {
    throw new Error("Invalid connection details");
  }

  const {
    type,
    host,
    port,
    database,
    username,
    password
  } = details;

  if (!CONNECTION_TYPES.includes(type)) {
    throw new Error("Invalid connection type");
  }

  if (
    typeof host !== "string" ||
    !host.trim() ||
    typeof database !== "string" ||
    !database.trim() ||
    typeof username !== "string" ||
    !username.trim() ||
    typeof password !== "string" ||
    !password
  ) {
    throw new Error("All connection fields are required");
  }

  const parsedPort = Number(port);

  if (
    !Number.isInteger(parsedPort) ||
    parsedPort < 1 ||
    parsedPort > 65535
  ) {
    throw new Error("Invalid port number");
  }

  return {
    type,
    host: host.trim(),
    port: parsedPort,
    database: database.trim(),
    username: username.trim(),
    password
  };
}

// Test a connection without saving it to MongoDB.
async function testConnectionDetails(details) {
  const connection = validateConnectionDetails(details);

  // BR-02: Block production-looking environments.
  const safetyCheck = isProductionHost(
    connection.host,
    connection.database
  );

  if (!safetyCheck.ok) {
    return {
      ok: false,
      message: "Connection blocked by production safety policy."
    };
  }

  const connector = getConnector(connection.type);

  if (
    !connector ||
    typeof connector.testConnection !== "function"
  ) {
    return {
      ok: false,
      message: "Connection testing is unavailable for this type."
    };
  }

  try {
    const result = await connector.testConnection(connection);

    if (result && result.ok === true) {
      return {
        ok: true,
        message: `${connection.type} connection test successful.`
      };
    }

    return {
      ok: false,
      message: "Connection failed. Check the connection settings."
    };
  } catch (error) {
    // Never expose raw database-driver errors or credentials.
    return {
      ok: false,
      message: "Connection test failed. Check the server and credentials."
    };
  }
}

// Test a previously saved connection.
async function testSavedConnection(connectionId) {
  // Passwords are excluded from normal Mongoose queries.
  // Explicitly retrieve the encrypted password for this operation.
  const connection = await Connection.findById(connectionId)
    .select("+passwordEncrypted");

  if (!connection) {
    return null;
  }

  let result;

  try {
    // Decrypt credentials only for the duration of the test.
    const password = decryptPassword(
      connection.passwordEncrypted
    );

    result = await testConnectionDetails({
      type: connection.type,
      host: connection.host,
      port: connection.port,
      database: connection.database,
      username: connection.username,
      password
    });
  } catch (error) {
    result = {
      ok: false,
      message: "Connection test failed."
    };
  }

  const testedAt = new Date();

  const status = result.ok
    ? "SUCCESS"
    : "FAILED";

  // Update the test status without exposing the password.
  await Connection.updateOne(
    { _id: connection._id },
    {
      $set: {
        lastTestStatus: status,
        lastTestedAt: testedAt
      }
    }
  );

  return {
    ...result,
    lastTestStatus: status,
    lastTestedAt: testedAt
  };
}

module.exports = {
  testConnectionDetails,
  testSavedConnection
};