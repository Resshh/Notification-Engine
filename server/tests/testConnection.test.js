/**
 * Tests for Story 1.3 - Test Database Connections
 * Ref: Sub-tasks #30 - #36, FR-03, BR-02, Figure 2
 */

const { testConnection } = require("../connectors/index");
const Connection = require("../models/Connection");
const { encryptPassword } = require("../security/crypto");

describe("Story 1.3 - Test Database Connections", () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY =
      "597001adc930d4a1750761523a49cd1ebbb2cce786e481718e7c242e1abb87a3";
  });

  describe("Sub-task #31 & #32: testConnection dispatcher", () => {
    test("successfully dispatches test to Service Layer mock", async () => {
      const result = await testConnection({
        type: "ServiceLayer",
        host: "localhost",
        port: 50000,
        database: "SBODemoIN",
        username: "manager",
        password: "Password123!"
      });

      expect(result.ok).toBe(true);
      expect(typeof result.message).toBe("string");
      expect(result.message.length).toBeGreaterThan(0);
    });

    test("successfully dispatches test to SAP HANA mock", async () => {
      const result = await testConnection({
        type: "HANA",
        host: "localhost",
        port: 39015,
        database: "HANA_TEST",
        username: "SYSTEM",
        password: "Password123!"
      });

      expect(result.ok).toBe(true);
      expect(result.message).toContain("HANA");
    });

    test("successfully dispatches test to SQL Server mock", async () => {
      const result = await testConnection({
        type: "SQLServer",
        host: "localhost",
        port: 1433,
        database: "SalesTest",
        username: "sa",
        password: "Password123!"
      });

      expect(result.ok).toBe(true);
    });

    test("blocks connections targeting production hosts per BR-02", async () => {
      const result = await testConnection({
        type: "SQLServer",
        host: "prod-database.internal",
        port: 1433,
        database: "CompanySales",
        username: "sa",
        password: "Password123!"
      });

      expect(result.ok).toBe(false);
      expect(result.message).toContain("safety rule BR-02");
    });

    test("blocks connections targeting production database names per BR-02", async () => {
      const result = await testConnection({
        type: "HANA",
        host: "10.0.0.5",
        port: 39015,
        database: "Production_ERP",
        username: "SYSTEM",
        password: "Password123!"
      });

      expect(result.ok).toBe(false);
      expect(result.message).toContain("safety rule BR-02");
    });

    test("returns clear error on unknown connection type", async () => {
      const result = await testConnection({
        type: "PostgreSQL",
        host: "localhost",
        port: 5432,
        database: "postgres",
        username: "postgres",
        password: "secret"
      });

      expect(result.ok).toBe(false);
      expect(result.message).toContain("Unknown connection type");
    });
  });
});
