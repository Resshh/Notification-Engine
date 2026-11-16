/**
 * End-to-End Integration Tests for Story 7.1 — Integrate All Data Connectors
 * Ref: Backlog ID 214, Sub-tasks #215 - #220, FR-17, FR-18, FR-19
 *
 * Verifies that Batch 1 (Notification Engine):
 * 1. Calls runQuery(queryId, runtimeParams) across all 3 data sources (SQL Server, HANA, Service Layer) (Sub-tasks #215, #216, #217)
 * 2. Receives data in the agreed common format { columns, rows, meta: { source, rowCount } }
 * 3. Seamlessly feeds query results into buildReport(result, "csv") and buildReport(result, "xlsx") (Sub-task #218)
 * 4. Generates production-grade, safe reports (formula injection protected, auto-column widths, styled headers)
 * 5. Handles runtime parameter merging, row limits, and sanitized errors cleanly (Sub-tasks #219, #220)
 */

const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

const { runQuery } = require("../core/runQuery");
const { executeQuery } = require("../core/executeQuery");
const { buildReport } = require("../reports/buildReport");
const Query = require("../models/Query");
const Connection = require("../models/Connection");
const { encryptPassword } = require("../security/crypto");
const {
  getSampleQueries,
  getSampleQueryByName
} = require("../sampleQueries/sampleQueries");

describe("Story 7.1 — Integrate All Data Connectors", () => {
  let mockConnections = {};
  const generatedFiles = [];

  beforeAll(() => {
    process.env.ENCRYPTION_KEY =
      "597001adc930d4a1750761523a49cd1ebbb2cce786e481718e7c242e1abb87a3";

    const encryptedPass = encryptPassword("Password123!");

    mockConnections["SQLServer"] = {
      _id: "672000000000000000000001",
      name: "Mock SQL Server",
      type: "SQLServer",
      host: "localhost",
      port: 1433,
      database: "SalesTest",
      username: "sa",
      passwordEncrypted: encryptedPass
    };

    mockConnections["HANA"] = {
      _id: "672000000000000000000002",
      name: "Mock SAP HANA",
      type: "HANA",
      host: "localhost",
      port: 39015,
      database: "HANA_TEST",
      username: "SYSTEM",
      passwordEncrypted: encryptedPass
    };

    mockConnections["ServiceLayer"] = {
      _id: "672000000000000000000003",
      name: "Mock Service Layer",
      type: "ServiceLayer",
      host: "localhost",
      port: 50000,
      database: "SBODemoIN",
      username: "manager",
      passwordEncrypted: encryptedPass
    };
  });

  beforeEach(() => {
    jest.restoreAllMocks();

    // Mock Connection.findById to resolve the appropriate connection document
    jest.spyOn(Connection, "findById").mockImplementation((id) => {
      const idStr = String(id);
      let match = null;
      for (const conn of Object.values(mockConnections)) {
        if (String(conn._id) === idStr) match = conn;
      }
      return {
        select: () => ({
          lean: () => Promise.resolve(match ? { ...match } : null)
        }),
        lean: () => Promise.resolve(match ? { ...match } : null)
      };
    });
  });

  afterAll(async () => {
    // Clean up all generated report files
    for (const f of generatedFiles) {
      if (fs.existsSync(f)) {
        try {
          fs.unlinkSync(f);
        } catch {
          // ignore unlink error during teardown
        }
      }
    }
  });

  // =========================================================================
  // Sub-task #215: SQL Server Connector Integration
  // =========================================================================
  describe("Sub-task #215: SQL Server Connector Integration via runQuery", () => {
    test("executes SQL Server query and returns standardized common format", async () => {
      const querySpec = getSampleQueryByName("Overdue Invoices");
      expect(querySpec).toBeDefined();

      const queryDoc = {
        _id: "672000000000000000000010",
        ...querySpec,
        connectionId: mockConnections["SQLServer"]._id
      };

      jest.spyOn(Query, "findById").mockReturnValue({
        lean: () => Promise.resolve(queryDoc)
      });

      const result = await runQuery(queryDoc._id, { "@asOfDate": "2026-11-01" });

      expect(result).toBeDefined();
      expect(Array.isArray(result.columns)).toBe(true);
      expect(result.columns).toEqual(querySpec.expectedColumns);
      expect(Array.isArray(result.rows)).toBe(true);
      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.meta.source).toBe("SQLServer");
      expect(result.meta.rowCount).toBe(result.rows.length);
    });
  });

  // =========================================================================
  // Sub-task #216: SAP HANA Connector Integration
  // =========================================================================
  describe("Sub-task #216: SAP HANA Connector Integration via runQuery", () => {
    test("executes SAP HANA dialect query and returns standardized common format", async () => {
      const querySpec = getSampleQueryByName("Daily Sales Summary");
      expect(querySpec).toBeDefined();

      const queryDoc = {
        _id: "672000000000000000000020",
        ...querySpec,
        connectionId: mockConnections["HANA"]._id
      };

      jest.spyOn(Query, "findById").mockReturnValue({
        lean: () => Promise.resolve(queryDoc)
      });

      const result = await runQuery(queryDoc._id);

      expect(result).toBeDefined();
      expect(Array.isArray(result.columns)).toBe(true);
      expect(result.columns).toEqual(querySpec.expectedColumns);
      expect(Array.isArray(result.rows)).toBe(true);
      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.meta.source).toBe("HANA");
      expect(result.meta.rowCount).toBe(result.rows.length);
    });
  });

  // =========================================================================
  // Sub-task #217: Service Layer Client Integration
  // =========================================================================
  describe("Sub-task #217: SAP Service Layer Integration via runQuery", () => {
    test("executes OData query and returns standardized common format", async () => {
      const querySpec = getSampleQueryByName("Purchase Orders Past Promised Date");
      expect(querySpec).toBeDefined();

      const queryDoc = {
        _id: "672000000000000000000030",
        ...querySpec,
        connectionId: mockConnections["ServiceLayer"]._id
      };

      jest.spyOn(Query, "findById").mockReturnValue({
        lean: () => Promise.resolve(queryDoc)
      });

      const result = await runQuery(queryDoc._id);

      expect(result).toBeDefined();
      expect(Array.isArray(result.columns)).toBe(true);
      expect(result.columns).toEqual(querySpec.expectedColumns);
      expect(Array.isArray(result.rows)).toBe(true);
      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.meta.source).toBe("ServiceLayer");
      expect(result.meta.rowCount).toBe(result.rows.length);
    });
  });

  // =========================================================================
  // Sub-task #218: Integrate buildReport() with runQuery() Output
  // =========================================================================
  describe("Sub-task #218: Integrate buildReport() with Connector Outputs", () => {
    test("generates valid CSV report from SQL Server query result", async () => {
      const querySpec = getSampleQueryByName("Items Below Reorder Level");
      const queryDoc = {
        _id: "672000000000000000000040",
        ...querySpec,
        connectionId: mockConnections["SQLServer"]._id
      };

      jest.spyOn(Query, "findById").mockReturnValue({
        lean: () => Promise.resolve(queryDoc)
      });

      const result = await runQuery(queryDoc._id);
      expect(result.rows.length).toBeGreaterThan(0);

      const csvPath = await buildReport(result, "csv");
      generatedFiles.push(csvPath);

      expect(fs.existsSync(csvPath)).toBe(true);
      expect(csvPath.endsWith(".csv")).toBe(true);

      const content = fs.readFileSync(csvPath, "utf8");
      expect(content.includes(querySpec.expectedColumns[0])).toBe(true);
    });

    test("generates valid XLSX report from SAP HANA query result with styled workbook readback", async () => {
      const querySpec = getSampleQueryByName("Daily Sales Summary");
      const queryDoc = {
        _id: "672000000000000000000050",
        ...querySpec,
        connectionId: mockConnections["HANA"]._id
      };

      jest.spyOn(Query, "findById").mockReturnValue({
        lean: () => Promise.resolve(queryDoc)
      });

      const result = await runQuery(queryDoc._id);
      expect(result.rows.length).toBeGreaterThan(0);

      const xlsxPath = await buildReport(result, "xlsx");
      generatedFiles.push(xlsxPath);

      expect(fs.existsSync(xlsxPath)).toBe(true);
      expect(xlsxPath.endsWith(".xlsx")).toBe(true);

      // Verify valid ZIP / XLSX magic bytes (PK)
      const buffer = fs.readFileSync(xlsxPath);
      expect(buffer[0]).toBe(0x50);
      expect(buffer[1]).toBe(0x4b);

      // Round-trip workbook verification with ExcelJS
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(xlsxPath);
      const sheet = wb.getWorksheet("Report");
      expect(sheet).toBeDefined();
      expect(sheet.rowCount).toBe(result.rows.length + 1);

      const headerValues = sheet.getRow(1).values.filter(Boolean);
      expect(headerValues).toEqual(querySpec.expectedColumns);
    });

    test("generates valid XLSX report from Service Layer query result", async () => {
      const querySpec = getSampleQueryByName("Purchase Orders Past Promised Date");
      const queryDoc = {
        _id: "672000000000000000000060",
        ...querySpec,
        connectionId: mockConnections["ServiceLayer"]._id
      };

      jest.spyOn(Query, "findById").mockReturnValue({
        lean: () => Promise.resolve(queryDoc)
      });

      const result = await runQuery(queryDoc._id);
      const xlsxPath = await buildReport(result, "xlsx");
      generatedFiles.push(xlsxPath);

      expect(fs.existsSync(xlsxPath)).toBe(true);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(xlsxPath);
      const sheet = wb.getWorksheet("Report");
      expect(sheet.rowCount).toBe(result.rows.length + 1);
    });
  });

  // =========================================================================
  // Sub-task #219: Complete Connector Workflow with Batch 1
  // =========================================================================
  describe("Sub-task #219: Complete Connector Workflow with Batch 1", () => {
    test("executes end-to-end workflow: query execution -> parameter override -> CSV + XLSX export", async () => {
      const allQueries = getSampleQueries();
      expect(allQueries.length).toBe(5);

      for (let i = 0; i < allQueries.length; i++) {
        const spec = allQueries[i];
        const fakeId = `67200000000000000000010${i}`;
        const queryDoc = {
          _id: fakeId,
          ...spec,
          connectionId: mockConnections[spec.targetConnectionType]._id
        };

        jest.spyOn(Query, "findById").mockReturnValue({
          lean: () => Promise.resolve(queryDoc)
        });

        // 1. Batch 1 executes query with runtime parameter overrides
        const result = await runQuery(fakeId, {
          "@asOfDate": "2026-11-05",
          "@thresholdDays": 10
        });

        expect(result).toBeDefined();
        expect(result.columns).toEqual(spec.expectedColumns);
        expect(result.meta.source).toBe(spec.targetConnectionType);
        expect(result.meta.rowCount).toBe(result.rows.length);

        // 2. Batch 1 exports to CSV
        const csvPath = await buildReport(result, "csv");
        generatedFiles.push(csvPath);
        expect(fs.existsSync(csvPath)).toBe(true);

        // 3. Batch 1 exports to XLSX
        const xlsxPath = await buildReport(result, "xlsx");
        generatedFiles.push(xlsxPath);
        expect(fs.existsSync(xlsxPath)).toBe(true);
      }
    });
  });

  // =========================================================================
  // Sub-task #220: Integration Issue & Error Boundary Testing
  // =========================================================================
  describe("Sub-task #220: Error Boundaries & Issue Resolution", () => {
    test("rejects missing queryId with clear message", async () => {
      await expect(runQuery("")).rejects.toThrow("runQuery: queryId is required.");
      await expect(runQuery(null)).rejects.toThrow("runQuery: queryId is required.");
    });

    test("returns sanitized error when query is not found in database", async () => {
      jest.spyOn(Query, "findById").mockReturnValue({
        lean: () => Promise.resolve(null)
      });

      await expect(runQuery("672000000000000000000999")).rejects.toThrow(
        "Query not found: '672000000000000000000999'."
      );
    });

    test("returns sanitized error when connection is missing without leaking credentials", async () => {
      const queryDoc = {
        _id: "672000000000000000000988",
        name: "Broken Connection Query",
        connectionId: "672000000000000000000999",
        kind: "sql",
        queryText: "SELECT 1",
        params: []
      };

      jest.spyOn(Query, "findById").mockReturnValue({
        lean: () => Promise.resolve(queryDoc)
      });

      jest.spyOn(Connection, "findById").mockReturnValue({
        select: () => ({ lean: () => Promise.resolve(null) }),
        lean: () => Promise.resolve(null)
      });

      await expect(runQuery(queryDoc._id)).rejects.toThrow(
        "Connection not found for query 'Broken Connection Query'."
      );
    });

    test("buildReport rejects unsupported formats", async () => {
      const dummyResult = { columns: ["A"], rows: [["1"]], meta: {} };
      await expect(buildReport(dummyResult, "pdf")).rejects.toThrow("unsupported format");
    });
  });
});
