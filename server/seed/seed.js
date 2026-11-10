/**
 * Database Seed Script
 * Stories 5.6 & 7.5 | Sprint 2
 * Ref: FR-22, FR-23, US-10, Backlog sub-tasks #168–#175
 *
 * Seeds MongoDB with:
 *   1. Three canonical mock data source connections (SQL Server, SAP HANA, SAP Service Layer)
 *   2. Five sample saved queries powering the 3 email and 2 report workflows
 *
 * Usage:
 *   npm run seed
 *   or: node seed/seed.js
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const mongoose = require("mongoose");
const Connection = require("../models/Connection");
const Query = require("../models/Query");
const { encryptPassword } = require("../security/crypto");
const { SAMPLE_QUERIES } = require("../sampleQueries/sampleQueries");

// Dedicated default Admin ObjectId for seeded records
const DEFAULT_ADMIN_ID = new mongoose.Types.ObjectId("672000000000000000000001");

const MOCK_CONNECTIONS = [
  {
    name: "Mock SQL Server",
    type: "SQLServer",
    host: "localhost",
    port: 1433,
    database: "SalesTest",
    username: "sa",
    passwordRaw: "Password123!",
    createdBy: DEFAULT_ADMIN_ID,
    lastTestStatus: "SUCCESS",
    lastTestedAt: new Date("2026-11-01T09:00:00Z")
  },
  {
    name: "Mock SAP HANA",
    type: "HANA",
    host: "localhost",
    port: 39015,
    database: "HANA_TEST",
    username: "SYSTEM",
    passwordRaw: "Password123!",
    createdBy: DEFAULT_ADMIN_ID,
    lastTestStatus: "SUCCESS",
    lastTestedAt: new Date("2026-11-01T09:00:00Z")
  },
  {
    name: "Mock Service Layer",
    type: "ServiceLayer",
    host: "localhost",
    port: 50000,
    database: "SBODemoIN",
    username: "manager",
    passwordRaw: "Password123!",
    createdBy: DEFAULT_ADMIN_ID,
    lastTestStatus: "SUCCESS",
    lastTestedAt: new Date("2026-11-01T09:00:00Z")
  }
];

/**
 * Seeds connections and sample queries into MongoDB.
 * @returns {Promise<{ connections: number, queries: number }>}
 */
async function seedDatabase() {
  const encKey = process.env.ENCRYPTION_KEY || "597001adc930d4a1750761523a49cd1ebbb2cce786e481718e7c242e1abb87a3";
  if (!process.env.ENCRYPTION_KEY) {
    process.env.ENCRYPTION_KEY = encKey;
  }

  // ── Step 1: Upsert Mock Connections ─────────────────────────────────────────
  const savedConnections = {};

  for (const connData of MOCK_CONNECTIONS) {
    const encrypted = encryptPassword(connData.passwordRaw);

    const doc = await Connection.findOneAndUpdate(
      { name: connData.name },
      {
        name: connData.name,
        type: connData.type,
        host: connData.host,
        port: connData.port,
        database: connData.database,
        username: connData.username,
        passwordEncrypted: encrypted,
        createdBy: connData.createdBy,
        lastTestStatus: connData.lastTestStatus,
        lastTestedAt: connData.lastTestedAt
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    savedConnections[connData.type] = doc._id;
  }

  // ── Step 2: Upsert 5 Sample Saved Queries ───────────────────────────────────
  let queryCount = 0;

  for (const q of SAMPLE_QUERIES) {
    const connId = savedConnections[q.targetConnectionType];
    if (!connId) {
      console.warn(`[Seed] Warning: No connection found for type '${q.targetConnectionType}'`);
      continue;
    }

    await Query.findOneAndUpdate(
      { name: q.name },
      {
        name: q.name,
        connectionId: connId,
        kind: q.kind,
        queryText: q.queryText || "",
        entity: q.entity || "",
        filter: q.filter || "",
        select: q.select || "",
        params: q.params || [],
        columnMapping: q.columnMapping || [],
        rowLimit: q.rowLimit || 1000,
        createdBy: "admin"
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    queryCount++;
  }

  return {
    connections: Object.keys(savedConnections).length,
    queries: queryCount
  };
}

// Execute directly if run as CLI script
if (require.main === module) {
  const mongoUri =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/notification_engine";

  console.log("[Seed] Connecting to MongoDB...");
  mongoose
    .connect(mongoUri)
    .then(async () => {
      console.log("[Seed] Connected. Seeding 3 connections and 5 sample queries...");
      const result = await seedDatabase();
      console.log(`[Seed] Successfully seeded ${result.connections} connections and ${result.queries} sample queries.`);
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error("[Seed] Error seeding database:", err.message);
      process.exit(1);
    });
}

module.exports = {
  seedDatabase,
  MOCK_CONNECTIONS,
  DEFAULT_ADMIN_ID
};
