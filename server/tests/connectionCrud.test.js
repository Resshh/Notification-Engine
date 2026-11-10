/**
 * Story 1.2 — View, Update and Delete Connections
 *
 * Tests:
 * - List connections
 * - View connection by ID
 * - Update connection details
 * - Encrypt replacement passwords
 * - Delete connections
 * - Reject invalid input
 * - Enforce administrator access
 * - Prevent credential exposure
 *
 * Uses mocked Mongoose methods.
 * No real MongoDB connection is required.
 */

const Connection = require("../models/Connection");

const {
  getConnections,
  getConnectionById,
  updateConnection,
  deleteConnection
} = require("../controllers/connectionController");

const {
  encryptPassword,
  decryptPassword
} = require("../security/crypto");

const CONNECTION_ID = "507f1f77bcf86cd799439011";
const ADMIN_ID = "507f1f77bcf86cd799439012";

let previousEncryptionKey;

// Use a test-only encryption key.
beforeAll(() => {
  previousEncryptionKey = process.env.ENCRYPTION_KEY;
  process.env.ENCRYPTION_KEY = "02".repeat(32);
});

afterAll(() => {
  if (previousEncryptionKey === undefined) {
    delete process.env.ENCRYPTION_KEY;
  } else {
    process.env.ENCRYPTION_KEY = previousEncryptionKey;
  }
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ======================================
// Test Helpers
// ======================================

function mockResponse() {
  return {
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
  };
}

function mockRequest(overrides = {}) {
  return {
    user: {
      _id: ADMIN_ID,
      role: "admin"
    },

    params: {
      id: CONNECTION_ID
    },

    body: {},

    ...overrides
  };
}

function mockConnection() {
  return {
    _id: CONNECTION_ID,
    name: "Test SQL Server",
    type: "SQLServer",
    host: "localhost",
    port: 1433,
    database: "TestDB",
    username: "testuser",

    passwordEncrypted: encryptPassword("old-password"),

    createdBy: ADMIN_ID,

    lastTestStatus: "SUCCESS",
    lastTestedAt: new Date("2026-11-01"),

    save: jest.fn().mockResolvedValue(undefined)
  };
}

function mockNext() {
  return jest.fn((error) => {
    if (error) {
      throw error;
    }
  });
}

// ======================================
// Test 1 — View All Connections
// ======================================

test("Story 1.2 - Admin can list connections without exposing passwords", async () => {
  const connection = mockConnection();

  jest.spyOn(Connection, "find").mockReturnValue({
    sort: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue([connection])
    })
  });

  const req = mockRequest();
  const res = mockResponse();

  await getConnections(req, res, mockNext());

  expect(res.statusCode).toBe(200);
  expect(res.body.success).toBe(true);
  expect(res.body.count).toBe(1);
  expect(res.body.connections).toHaveLength(1);

  const returnedConnection = res.body.connections[0];

  expect(returnedConnection.name).toBe("Test SQL Server");
  expect(returnedConnection.password).toBeUndefined();
  expect(returnedConnection.passwordEncrypted).toBeUndefined();
});

// ======================================
// Test 2 — Empty Connection List
// ======================================

test("Story 1.2 - Return an empty list when no connections exist", async () => {
  jest.spyOn(Connection, "find").mockReturnValue({
    sort: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue([])
    })
  });

  const req = mockRequest();
  const res = mockResponse();

  await getConnections(req, res, mockNext());

  expect(res.statusCode).toBe(200);
  expect(res.body.success).toBe(true);
  expect(res.body.count).toBe(0);
  expect(res.body.connections).toEqual([]);
});

// ======================================
// Test 3 — View Connection By ID
// ======================================

test("Story 1.2 - Admin can view a connection by ID", async () => {
  const connection = mockConnection();

  jest.spyOn(Connection, "findById").mockReturnValue({
    lean: jest.fn().mockResolvedValue(connection)
  });

  const req = mockRequest();
  const res = mockResponse();

  await getConnectionById(req, res, mockNext());

  expect(res.statusCode).toBe(200);
  expect(res.body.success).toBe(true);
  expect(res.body.connection.id).toBe(CONNECTION_ID);
  expect(res.body.connection.name).toBe("Test SQL Server");

  expect(res.body.connection.password).toBeUndefined();
  expect(res.body.connection.passwordEncrypted).toBeUndefined();
});

// ======================================
// Test 4 — Invalid Connection ID
// ======================================

test("Story 1.2 - Reject invalid connection IDs", async () => {
  const req = mockRequest({
    params: {
      id: "invalid-id"
    }
  });

  const res = mockResponse();

  await getConnectionById(req, res, mockNext());

  expect(res.statusCode).toBe(400);
  expect(res.body.success).toBe(false);
  expect(res.body.message).toBe("Invalid connection ID");
});

// ======================================
// Test 5 — Connection Not Found
// ======================================

test("Story 1.2 - Return 404 when connection does not exist", async () => {
  jest.spyOn(Connection, "findById").mockReturnValue({
    lean: jest.fn().mockResolvedValue(null)
  });

  const req = mockRequest();
  const res = mockResponse();

  await getConnectionById(req, res, mockNext());

  expect(res.statusCode).toBe(404);
  expect(res.body.success).toBe(false);
  expect(res.body.message).toBe("Connection not found");
});

// ======================================
// Test 6 — Update Connection
// ======================================

test("Story 1.2 - Admin can update connection details", async () => {
  const connection = mockConnection();

  const selectMock = jest.fn().mockResolvedValue(connection);

  jest.spyOn(Connection, "findById").mockReturnValue({
    select: selectMock
  });

  const req = mockRequest({
    body: {
      name: "Updated SQL Server",
      host: "127.0.0.1",
      port: 1434
    }
  });

  const res = mockResponse();

  await updateConnection(req, res, mockNext());

  expect(res.statusCode).toBe(200);
  expect(res.body.success).toBe(true);

  expect(connection.name).toBe("Updated SQL Server");
  expect(connection.host).toBe("127.0.0.1");
  expect(connection.port).toBe(1434);

  expect(selectMock).toHaveBeenCalledWith("+passwordEncrypted");
  expect(connection.save).toHaveBeenCalledTimes(1);

  expect(connection.lastTestStatus).toBe("NOT_TESTED");
  expect(connection.lastTestedAt).toBeNull();

  expect(res.body.connection.passwordEncrypted).toBeUndefined();
});

// ======================================
// Test 7 — Encrypt Updated Password
// ======================================

test("Story 1.2 - Updated passwords are encrypted before saving", async () => {
  const connection = mockConnection();

  jest.spyOn(Connection, "findById").mockReturnValue({
    select: jest.fn().mockResolvedValue(connection)
  });

  const req = mockRequest({
    body: {
      password: "new-secure-password"
    }
  });

  const res = mockResponse();

  await updateConnection(req, res, mockNext());

  expect(res.statusCode).toBe(200);

  expect(connection.passwordEncrypted).not.toBe(
    "new-secure-password"
  );

  expect(
    decryptPassword(connection.passwordEncrypted)
  ).toBe("new-secure-password");

  expect(connection.save).toHaveBeenCalledTimes(1);

  expect(res.body.connection.password).toBeUndefined();
  expect(res.body.connection.passwordEncrypted).toBeUndefined();
});

// ======================================
// Test 8 — Reject Invalid Updates
// ======================================

test("Story 1.2 - Reject invalid port updates", async () => {
  const req = mockRequest({
    body: {
      port: 70000
    }
  });

  const res = mockResponse();

  await updateConnection(req, res, mockNext());

  expect(res.statusCode).toBe(400);
  expect(res.body.success).toBe(false);
  expect(res.body.message).toBe("Invalid port number");
});

// ======================================
// Test 9 — Prevent Unauthorized Field Updates
// ======================================

test("Story 1.2 - Prevent changing protected fields", async () => {
  const req = mockRequest({
    body: {
      createdBy: "507f1f77bcf86cd799439099"
    }
  });

  const res = mockResponse();

  await updateConnection(req, res, mockNext());

  expect(res.statusCode).toBe(400);
  expect(res.body.success).toBe(false);
});

// ======================================
// Test 10 — Reject Empty Updates
// ======================================

test("Story 1.2 - Reject empty update requests", async () => {
  const req = mockRequest({
    body: {}
  });

  const res = mockResponse();

  await updateConnection(req, res, mockNext());

  expect(res.statusCode).toBe(400);
  expect(res.body.success).toBe(false);
});

// ======================================
// Test 11 — Delete Connection
// ======================================

test("Story 1.2 - Admin can delete a connection", async () => {
  const connection = mockConnection();

  const deleteMock = jest
    .spyOn(Connection, "findByIdAndDelete")
    .mockResolvedValue(connection);

  const req = mockRequest();
  const res = mockResponse();

  await deleteConnection(req, res, mockNext());

  expect(res.statusCode).toBe(200);
  expect(res.body.success).toBe(true);

  expect(res.body.message).toBe(
    "Connection deleted successfully"
  );

  expect(deleteMock).toHaveBeenCalledWith(CONNECTION_ID);
});

// ======================================
// Test 12 — Delete Missing Connection
// ======================================

test("Story 1.2 - Return 404 when deleting a missing connection", async () => {
  jest
    .spyOn(Connection, "findByIdAndDelete")
    .mockResolvedValue(null);

  const req = mockRequest();
  const res = mockResponse();

  await deleteConnection(req, res, mockNext());

  expect(res.statusCode).toBe(404);
  expect(res.body.success).toBe(false);
});

// ======================================
// Test 13 — Reject Unauthenticated Users
// ======================================

test.each([
  ["list", getConnections],
  ["view", getConnectionById],
  ["update", updateConnection],
  ["delete", deleteConnection]
])(
  "Story 1.2 - Reject unauthenticated users attempting to %s connections",
  async (action, handler) => {
    const req = mockRequest({
      user: undefined
    });

    const res = mockResponse();

    await handler(req, res, mockNext());

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  }
);

// ======================================
// Test 14 — Reject Non-Admin Users
// ======================================

test.each([
  ["list", getConnections],
  ["view", getConnectionById],
  ["update", updateConnection],
  ["delete", deleteConnection]
])(
  "Story 1.2 - Reject non-admin users attempting to %s connections",
  async (action, handler) => {
    const req = mockRequest({
      user: {
        _id: ADMIN_ID,
        role: "user"
      }
    });

    const res = mockResponse();

    await handler(req, res, mockNext());

    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
  }
);