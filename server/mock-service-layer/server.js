/**
 * Mock SAP Business One Service Layer (Batch 2 guide, section 8).
 * A small Express app that behaves like the real Service Layer, so the client can be built and
 * tested offline and switched to the real SAP test system by changing only the connection settings.
 *
 *   POST /b1s/v1/Login    { CompanyDB, UserName, Password } -> { SessionId, SessionTimeout } + B1SESSION cookie
 *   POST /b1s/v1/Logout
 *   GET  /b1s/v1/Invoices | PurchaseOrders | Items   ?$filter=&$select=&$top=&$skip=
 *        -> { value: [...], "odata.nextLink": "Invoices?$skip=20..." } (nextLink only when more data exists)
 *
 * Sessions expire after SESSION_TIMEOUT_MS of no use; the client must log in again.
 * Data comes from mock-data/demo/. Read only: no POST/PATCH/DELETE on entities.
 *
 * Run on its own:  npm run mock:sl   (port MOCK_SL_PORT, default 50000)
 * The main server also starts it unless START_MOCK_SERVICE_LAYER=false.
 */

const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.resolve(__dirname, "../../mock-data/demo");
const ENTITIES = { Invoices: "invoices.json", PurchaseOrders: "purchaseOrders.json", Items: "items.json" };

// Service Layer style error body
const slError = (res, status, code, message) => res.status(status).json({ error: { code, message: { lang: "en-us", value: message } } });

// ── $filter: "Field op value [and Field op value ...]", op = eq ne gt ge lt le ─────────────────
const CONDITION = /^\s*([A-Za-z_]\w*)\s+(eq|ne|gt|ge|lt|le)\s+('(?:[^']|'')*'|-?\d+(?:\.\d+)?|true|false|null)\s*$/i;

function parseValue(token) {
  if (token.startsWith("'")) return token.slice(1, -1).replace(/''/g, "'");
  if (token === "true" || token === "false") return token === "true";
  if (token === "null") return null;
  return Number(token);
}

// Returns a row predicate, or throws an Error with a user-facing message.
function parseFilter(filter, knownFields) {
  if (!filter || !filter.trim()) return () => true;
  // Split on "and" outside quotes.
  const parts = filter.split(/\s+and\s+(?=(?:[^']*'[^']*')*[^']*$)/i);
  const conditions = parts.map((part) => {
    const m = part.match(CONDITION);
    if (!m) throw new Error(`Unsupported $filter expression: '${part.trim()}'. Use: Field eq|ne|gt|ge|lt|le value, joined with 'and'.`);
    const [, field, op, raw] = m;
    if (!knownFields.has(field)) throw new Error(`Property '${field}' is invalid.`);
    return { field, op: op.toLowerCase(), value: parseValue(raw) };
  });
  return (row) => conditions.every(({ field, op, value }) => {
    const a = row[field];
    switch (op) {
      case "eq": return a === value;
      case "ne": return a !== value;
      case "gt": return a > value;
      case "ge": return a >= value;
      case "lt": return a < value;
      default: return a <= value; // le
    }
  });
}

function createApp({
  sessionTimeoutMs = Number(process.env.MOCK_SL_SESSION_TIMEOUT_MS) || 30 * 60 * 1000,
  pageSize = 20, // the real Service Layer's default page size
  companyDB = process.env.MOCK_SL_COMPANY || "SBODemoIN",
  userName = process.env.MOCK_SL_USER || "manager",
  password = process.env.MOCK_SL_PASSWORD || "Password123!",
} = {}) {
  const app = express();
  const sessions = new Map(); // id -> last used (ms)
  app.use(express.json());

  app.post("/b1s/v1/Login", (req, res) => {
    const { CompanyDB, UserName, Password } = req.body || {};
    if (CompanyDB !== companyDB || UserName !== userName || Password !== password) {
      return slError(res, 401, -304, "Fail to get DB Credentials from SLD. Check the user name, password and company.");
    }
    const id = crypto.randomUUID();
    sessions.set(id, Date.now());
    res.cookie("B1SESSION", id, { httpOnly: true, path: "/b1s/v1" });
    res.json({ SessionId: id, Version: "mock", SessionTimeout: Math.ceil(sessionTimeoutMs / 60000) });
  });

  // Every other route needs a live session.
  app.use("/b1s/v1", (req, res, next) => {
    const id = /(?:^|;\s*)B1SESSION=([^;]+)/.exec(req.headers.cookie || "")?.[1];
    const lastUsed = id && sessions.get(id);
    if (!lastUsed || Date.now() - lastUsed > sessionTimeoutMs) {
      if (id) sessions.delete(id);
      return slError(res, 401, 301, "Invalid session or session already timeout.");
    }
    sessions.set(id, Date.now());
    req.sessionId = id;
    next();
  });

  app.post("/b1s/v1/Logout", (req, res) => {
    sessions.delete(req.sessionId);
    res.status(204).end();
  });

  app.get("/b1s/v1/:entity", (req, res) => {
    const file = ENTITIES[req.params.entity];
    if (!file) return slError(res, 404, -1, `Resource '${req.params.entity}' not found.`);
    const records = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8"));
    const knownFields = new Set(Object.keys(records[0] || {}));

    let keep;
    try {
      keep = parseFilter(req.query.$filter, knownFields);
    } catch (err) {
      return slError(res, 400, -1, err.message);
    }
    const select = String(req.query.$select || "").split(",").map((s) => s.trim()).filter(Boolean);
    const unknown = select.find((f) => !knownFields.has(f));
    if (unknown) return slError(res, 400, -1, `Property '${unknown}' is invalid.`);

    const matched = records.filter(keep);
    const skip = Math.max(0, parseInt(req.query.$skip, 10) || 0);
    const top = parseInt(req.query.$top, 10);
    const end = Number.isInteger(top) && top >= 0 ? Math.min(skip + top, matched.length) : matched.length;
    const take = Math.min(pageSize, end - skip);
    const page = matched.slice(skip, skip + Math.max(0, take))
      .map((r) => (select.length ? Object.fromEntries(select.map((f) => [f, r[f]])) : r));

    const body = { "odata.metadata": `$metadata#${req.params.entity}`, value: page };
    if (skip + page.length < end) {
      const next = new URLSearchParams();
      if (req.query.$filter) next.set("$filter", req.query.$filter);
      if (select.length) next.set("$select", select.join(","));
      if (Number.isInteger(top)) next.set("$top", String(end - skip - page.length));
      next.set("$skip", String(skip + page.length));
      body["odata.nextLink"] = `${req.params.entity}?${next.toString()}`;
    }
    res.json(body);
  });

  // Read only: anything else (POST/PATCH/DELETE on entities) is refused.
  app.use("/b1s/v1", (req, res) => slError(res, 405, -1, "This mock Service Layer is read only."));
  return app;
}

// Start listening; resolves with the http.Server. Used by server.js, npm run mock:sl and the tests.
function start(port = Number(process.env.MOCK_SL_PORT) || 50000, options) {
  return new Promise((resolve, reject) => {
    const srv = createApp(options).listen(port, () => resolve(srv));
    srv.on("error", reject);
  });
}

if (require.main === module) {
  require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
  start().then((srv) => console.log(`Mock Service Layer on http://localhost:${srv.address().port}/b1s/v1`));
}

module.exports = { createApp, start, parseFilter };
