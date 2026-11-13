/**
 * Story 1.3 - Test Database Connections
 *
 * Tests:
 * - Admin authorization
 * - Transient connection testing
 * - SQL Server, HANA and Service Layer
 * - Connection validation
 * - Production safety checks
 * - Saved connection testing
 * - Password decryption
 * - Test status persistence
 * - Safe error responses
 */

const express = require("express");
const request = require("supertest");

const Connection = require("../models/Connection");

const sqlServer = require("../connectors/sqlServer");
const hana = require("../connectors/hana");
const serviceLayer = require("../connectors/serviceLayerClient");

const { encryptPassword } = require("../security/crypto");

const connectionRoutes = require("../routes/connectionRoutes");

describe("Story 1.3 - Test Database Connections", () => {
  let app;
  let currentUser;

  const adminUser = {
    _id: "672000000000000000000099",
    id: "672000000000000000000099",
    role: "admin"
  };

  const connectionDetails = {
    type: "SQLServer",
    host: "localhost",
    port: 1433,
    database: "SalesTest",
    username: "sa",
    password: "SecretPass123!"
  };

  beforeAll(() => {
    process.env.ENCRYPTION_KEY =
      "597001adc930d4a1750761523a49cd1ebbb2cce786e481718e7c242e1abb87a3";

    app = express();

    app.use(express.json());

    // Simulate authenticated users in test requests.
    app.use((req, res, next) => {
      req.user = currentUser;
      next();
    });

    app.use("/api/connections", connectionRoutes);
  });

  beforeEach(() => {
    jest.restoreAllMocks();
    currentUser = adminUser;
  });

  // ============================================================
  // ADMIN AUTHORIZATION
  // ============================================================

  test("rejects unauthenticated connection tests", async () => {
    currentUser = null;

    const response = await request(app)
      .post("/api/connections/test")
      .send(connectionDetails);

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  test("rejects non-admin connection tests", async () => {
    currentUser = {
      _id: "672000000000000000000098",
      id: "672000000000000000000098",
      role: "user"
    };

    const response = await request(app)
      .post("/api/connections/test")
      .send(connectionDetails);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  // ============================================================
  // TRANSIENT CONNECTION TESTING
  // ============================================================

  test("tests an unsaved SQL Server connection", async () => {
    const tester = jest.spyOn(sqlServer, "testConnection")
      .mockResolvedValue({
        ok: true,
        message: "Connection successful."
      });

    const response = await request(app)
      .post("/api/connections/test")
      .send(connectionDetails);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.ok).toBe(true);

    expect(tester).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SQLServer",
        database: "SalesTest",
        password: "SecretPass123!"
      })
    );

    expect(JSON.stringify(response.body))
      .not.toContain("SecretPass123!");
  });

  test("tests an unsaved SAP HANA connection", async () => {
    const tester = jest.spyOn(hana, "testConnection")
      .mockResolvedValue({
        ok: true,
        message: "HANA connection successful."
      });

    const response = await request(app)
      .post("/api/connections/test")
      .send({
        ...connectionDetails,
        type: "HANA",
        port: 39015,
        database: "HANA_TEST"
      });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(tester).toHaveBeenCalledTimes(1);
  });

  test("tests an unsaved Service Layer connection", async () => {
    const tester = jest.spyOn(serviceLayer, "testConnection")
      .mockResolvedValue({
        ok: true,
        message: "Mock connection successful."
      });

    const response = await request(app)
      .post("/api/connections/test")
      .send({
        ...connectionDetails,
        type: "ServiceLayer",
        port: 50000,
        database: "SBODemoIN"
      });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(tester).toHaveBeenCalledTimes(1);
  });

  // ============================================================
  // VALIDATION
  // ============================================================

  test("rejects invalid connection types", async () => {
    const response = await request(app)
      .post("/api/connections/test")
      .send({
        ...connectionDetails,
        type: "InvalidType"
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test("rejects invalid ports", async () => {
    const response = await request(app)
      .post("/api/connections/test")
      .send({
        ...connectionDetails,
        port: 70000
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test("rejects missing passwords", async () => {
    const response = await request(app)
      .post("/api/connections/test")
      .send({
        ...connectionDetails,
        password: ""
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  // ============================================================
  // PRODUCTION SAFETY
  // ============================================================

  test("blocks production-looking hosts", async () => {
    const tester = jest.spyOn(sqlServer, "testConnection")
      .mockResolvedValue({ ok: true });

    const response = await request(app)
      .post("/api/connections/test")
      .send({
        ...connectionDetails,
        host: "prod-db.example.com"
      });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(false);

    // No connection attempt should be made.
    expect(tester).not.toHaveBeenCalled();
  });

  // ============================================================
  // SAVED CONNECTION TESTING
  // ============================================================

  function mockSavedConnection() {
    const savedConnection = {
      _id: "672000000000000000000001",
      name: "Test SQL Connection",
      type: "SQLServer",
      host: "localhost",
      port: 1433,
      database: "SalesTest",
      username: "sa",
      passwordEncrypted: encryptPassword("SecretPass123!")
    };

    jest.spyOn(Connection, "findById").mockReturnValue({
      select: jest.fn().mockResolvedValue(savedConnection)
    });

    jest.spyOn(Connection, "updateOne")
      .mockResolvedValue({ matchedCount: 1 });

    return savedConnection;
  }

  test("rejects invalid saved connection IDs", async () => {
    const response = await request(app)
      .post("/api/connections/invalid-id/test");

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test("returns 404 when a saved connection does not exist", async () => {
    jest.spyOn(Connection, "findById").mockReturnValue({
      select: jest.fn().mockResolvedValue(null)
    });

    const response = await request(app)
      .post("/api/connections/672000000000000000000099/test");

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  test("decrypts credentials and tests a saved connection", async () => {
    const savedConnection = mockSavedConnection();

    const tester = jest.spyOn(sqlServer, "testConnection")
      .mockResolvedValue({
        ok: true,
        message: "Connection successful."
      });

    const response = await request(app)
      .post(`/api/connections/${savedConnection._id}/test`);

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.lastTestStatus).toBe("SUCCESS");

    expect(tester).toHaveBeenCalledWith(
      expect.objectContaining({
        password: "SecretPass123!"
      })
    );

    expect(Connection.updateOne).toHaveBeenCalledWith(
      { _id: savedConnection._id },
      {
        $set: {
          lastTestStatus: "SUCCESS",
          lastTestedAt: expect.any(Date)
        }
      }
    );

    expect(JSON.stringify(response.body))
      .not.toContain("SecretPass123!");

    expect(JSON.stringify(response.body))
      .not.toContain(savedConnection.passwordEncrypted);
  });

  test("saves FAILED status when a connection test fails", async () => {
    const savedConnection = mockSavedConnection();

    jest.spyOn(sqlServer, "testConnection")
      .mockResolvedValue({
        ok: false,
        message: "Login failed."
      });

    const response = await request(app)
      .post(`/api/connections/${savedConnection._id}/test`);

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(false);
    expect(response.body.lastTestStatus).toBe("FAILED");

    expect(Connection.updateOne).toHaveBeenCalledWith(
      { _id: savedConnection._id },
      {
        $set: {
          lastTestStatus: "FAILED",
          lastTestedAt: expect.any(Date)
        }
      }
    );
  });

  // ============================================================
  // ERROR SANITIZATION
  // ============================================================

  test("does not expose database-driver errors", async () => {
    jest.spyOn(sqlServer, "testConnection")
      .mockRejectedValue(
        new Error("password=SecretPass123! internal database failure")
      );

    const response = await request(app)
      .post("/api/connections/test")
      .send(connectionDetails);

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(false);

    expect(JSON.stringify(response.body))
      .not.toContain("SecretPass123!");
  });
});