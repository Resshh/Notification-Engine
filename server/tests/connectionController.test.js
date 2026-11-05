const test = require("node:test");
const assert = require("node:assert/strict");

const Connection = require("../models/Connection");

// Use a dummy encryption key only when no key is configured.
// This is for unit testing, not production.
process.env.ENCRYPTION_KEY ||= "01".repeat(32);

const {
  createConnection
} = require("../controllers/connectionController");

// Helper to simulate Express response.
const createResponse = () => ({
  statusCode: 200,
  body: null,

  status(code) {
    this.statusCode = code;
    return this;
  },

  json(data) {
    this.body = data;
    return this;
  }
});

// Sample connection details.
const validConnection = {
  name: "Test SQL Server",
  type: "SQLServer",
  host: "localhost",
  port: 1433,
  database: "TestDB",
  username: "test_user",
  password: "dummy-password"
};

// Test 1: Unauthenticated user.
test("Story 1.1 - Reject unauthenticated connection creation", async () => {
  const req = {
    body: validConnection
  };

  const res = createResponse();

  await createConnection(req, res, (error) => {
    throw error;
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
});

// Test 2: Non-admin user.
test("Story 1.1 - Reject non-admin connection creation", async () => {
  const req = {
    user: {
      _id: "user123",
      role: "user"
    },
    body: validConnection
  };

  const res = createResponse();

  await createConnection(req, res, (error) => {
    throw error;
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.message, "Admin access required");
});

// Test 3: Missing required fields.
test("Story 1.1 - Reject missing connection fields", async () => {
  const req = {
    user: {
      _id: "admin123",
      role: "admin"
    },
    body: {
      name: "Incomplete Connection",
      type: "SQLServer"
    }
  };

  const res = createResponse();

  await createConnection(req, res, (error) => {
    throw error;
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
});

// Test 4: Invalid port number.
test("Story 1.1 - Reject invalid port numbers", async () => {
  const req = {
    user: {
      _id: "admin123",
      role: "admin"
    },
    body: {
      ...validConnection,
      port: 70000
    }
  };

  const res = createResponse();

  await createConnection(req, res, (error) => {
    throw error;
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, "Invalid port number");
});

// Test 5: Valid connection creation.
test("Story 1.1 - Encrypt password and return safe connection details", async () => {
  const originalCreate = Connection.create;

  let savedData;

  // Mock database creation.
  Connection.create = async (data) => {
    savedData = data;

    return {
      _id: "connection123",
      ...data,
      lastTestStatus: "NotTested",
      lastTestedAt: null
    };
  };

  try {
    const req = {
      user: {
        _id: "admin123",
        role: "admin"
      },
      body: validConnection
    };

    const res = createResponse();

    await createConnection(req, res, (error) => {
      throw error;
    });

    // Verify successful creation.
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);

    // Verify encrypted password was saved.
    assert.ok(savedData.passwordEncrypted);

    assert.notEqual(
      savedData.passwordEncrypted,
      validConnection.password
    );

    // Verify plaintext password was not saved.
    assert.equal(savedData.password, undefined);

    // Verify the API does not expose credentials.
    assert.equal(res.body.connection.password, undefined);

    assert.equal(
      res.body.connection.passwordEncrypted,
      undefined
    );

    // Verify returned connection details.
    assert.equal(
      res.body.connection.name,
      validConnection.name
    );

    assert.equal(
      res.body.connection.type,
      validConnection.type
    );

  } finally {
    // Restore the original database function.
    Connection.create = originalCreate;
  }
});