# Notification Engine

ICTAK internship project, FY 2026–27: Batch 1 (Notification Engine) + Batch 2 (Data Connectors).
Stack: React + Vite, Node.js + Express, MongoDB, node-cron, nodemailer, ExcelJS.

The app reads business data (invoices, purchase orders, stock, sales), checks a rule, and sends
emails or reports on a schedule, without sending duplicates, and logs every run and every email.

## How a job runs

1. An admin sets up a job once: saved query, rule, schedule, recipients, template.
2. The scheduler starts it at the set time (or an admin clicks **Run now**).
3. `runQuery(queryId)` fetches the data from the saved query's connection (Batch 2).
4. The rule keeps only matching rows, e.g. `DaysOverdue > 7`.
5. Recipients come from a data column (e.g. `Email`) or a named list (e.g. Finance Team), plus CC/BCC.
6. The template's `{{placeholders}}` are filled with the row's values.
7. Duplicate check: a key like `payment-reminder:INV-101:2026-11-16` can only be sent once.
8. The email is sent, and retried up to 3 times if it fails.
9. The run and each email are saved to `job_runs` and `delivery_logs`, shown in **Run History**.

## Setup

Requires Node.js 20+ and a MongoDB database (local or Atlas). No real SQL Server, SAP HANA or
SAP Service Layer is needed: SQL Server and HANA fall back to the mock data in `mock-data/`, and a
mock Service Layer server starts with the API (see [Mock SAP Service Layer](#mock-sap-service-layer)).

### 1. Install

```bash
cd server && npm install
cd ../client && npm install
```

### 2. Create `server/.env`

Copy `server/.env.example` to `server/.env` and fill it in. Never commit `.env`.

| Setting | What it is |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Any long random text, used to sign logins |
| `ENCRYPTION_KEY` | 64 hex characters, encrypts saved connection passwords. **The whole team must use the same key** (the database is shared), or saved connections fail with "Unable to decrypt password". `npm run seed` refuses to run without it. Generate one: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `SEED_PASSWORD` | Password for the demo logins (default `Test@123`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Email account. Leave `SMTP_USER` empty to build emails without sending them |
| `TEST_MODE`, `TEST_EMAIL` | See [Test mode](#test-mode) |
| `QUERY_TIMEOUT_MS`, `MAX_ROW_LIMIT_CAP` | Query time limit and row cap (defaults 30000 and 1000) |
| `START_MOCK_SERVICE_LAYER` | `false` stops the API from starting the mock Service Layer (use when testing against the real SAP test system) |

### 3. Load the demo data (run in this order)

```bash
cd server
npm run seed          # Batch 2: 3 mock connections + 5 saved queries
npm run seed:batch1   # Batch 1: 2 logins, 4 recipient lists, 5 templates, 5 jobs
```

Both are safe to run again: they update by name instead of duplicating.

### 4. Run

```bash
cd server && npm run dev    # API on http://localhost:5000 (check /api/health)
cd client && npm run dev    # App on http://localhost:5173
```

### Logins

| Email | Password | Role |
|---|---|---|
| `admin@test.com` | `SEED_PASSWORD` (default `Test@123`) | Admin: can change everything |
| `user@test.com` | same | User: read-only |

### Mock SAP Service Layer

`server/mock-service-layer/server.js` is a small Express app that behaves like SAP Business One
Service Layer. `npm run dev` starts it on port 50000; to run it alone: `cd server && npm run mock:sl`.

| Request | What it does |
|---|---|
| `POST /b1s/v1/Login` `{ CompanyDB, UserName, Password }` | Returns a session (`B1SESSION` cookie). Wrong details give 401 |
| `GET /b1s/v1/Invoices`, `/PurchaseOrders`, `/Items` | Data from `mock-data/demo/`. Supports `$filter` (`eq ne gt ge lt le`, joined with `and`), `$select`, `$top`, `$skip` |
| Paging | 20 records per page; `odata.nextLink` points to the next page |
| Session timeout | 30 minutes of no use (`MOCK_SL_SESSION_TIMEOUT_MS`); then 401 |
| Anything else | Refused: the mock is read only |

Mock login (matches the seeded "Mock Service Layer" connection): company `SBODemoIN`, user `manager`,
password `Password123!` (override with `MOCK_SL_COMPANY`, `MOCK_SL_USER`, `MOCK_SL_PASSWORD`).

The client (`server/connectors/serviceLayerClient.js`) logs in, follows `odata.nextLink` until the
row limit, and when the session expires logs in again and retries once. **Switching to the real SAP
test system needs only the connection settings**: host, port, company database, username and
password, plus `START_MOCK_SERVICE_LAYER=false`. Every host except `localhost` uses HTTPS with
certificate checks on; for a self-signed test certificate set `NODE_EXTRA_CA_CERTS` to the
certificate file from your mentor (never switch the checks off).

## Test mode

While developing and in the demo, test mode stays **on** (ICTAK rule: never send to real addresses).

- `TEST_MODE=true` (or missing): **every email goes only to `TEST_EMAIL`**, and CC/BCC are dropped.
  The email content is unchanged, so you can check it is correct.
- `TEST_MODE=false`: emails go to the real addresses in the data.
- It is only changed in `server/.env` (restart the server after changing). There is no on/off
  button on purpose, so nobody can switch it off by accident.
- The header shows **TEST MODE: ON/OFF** using the same check as the mailer.
- All sending goes through `server/engine/mailer.js`, so no job or screen can bypass it.
- Scheduling is not affected: jobs still run at their set time, only the recipient changes.

## Demo workflows

| Job | Type | Query (source) | Rule | Recipients | Schedule |
|---|---|---|---|---|---|
| Payment Reminder | One email per invoice | Overdue Invoices | `DaysOverdue > 7` | `Email` column | Daily 10:00 |
| PO Follow-up | One email per PO | Purchase Orders Past Promised Date | `Status != Closed` | `Email` column, CC Purchase | Daily 10:30 |
| Low Stock Alert | One email per item | Items Below Reorder Level | — | Store Managers list | Daily 08:00 |
| Daily Sales Report | One email with CSV + PDF attached (built by buildReport) | Daily Sales Summary | — | Sales Management list | Daily 19:00 |
| Weekly Receivables Report | One email with CSV + PDF attached (built by buildReport) | Open Receivables Summary | — | Finance Team list | Mondays 09:00 |

All times are Asia/Kolkata. The scheduler runs inside the server, so a job runs only while the
server is running. To demo quickly, use **Run now** or set a job to every 1 minute.

## Who can do what

| Screen | Admin | User |
|---|---|---|
| Job Dashboard | Create, edit, enable/disable, Run now | View only |
| Job setup, Test run & preview email | Yes | Blocked |
| Recipient Lists, Templates | Create, edit, delete | View (and preview templates) |
| Run History | View | View |
| Connections, Queries | Yes | Hidden and blocked |

The server enforces all of this; the screens only hide what the server would refuse.

## Tests

```bash
cd server
npm test       # all tests: Batch 2 (Jest) and then Batch 1 (node:test)
npm run lint   # code checks (unused variables, duplicate imports, etc.)

cd ../client
npm run lint   # code checks for the React app
```

They use mocks, so no database or email account is needed. All test cases from both guides are automated:

### Batch 1 Guide Test Cases

| Guide test case | Test file |
|---|---|
| Job with matching rows: emails sent, log shows success | `test/runJob.test.js` |
| Job with no matching rows: no emails, log shows 0 sent | `test/runJob.test.js` |
| Same job run twice: second run sends nothing | `test/runJob.test.js` |
| Email server down: retried, failure logged | `test/runJob.test.js`, `test/runner.test.js` |
| Test mode on: email goes only to the test address | `test/runner.test.js` |
| Normal user opens an admin page: blocked | `test/auth.test.js`, `tests/query.test.js` |
| Missing placeholder value: empty value, no crash | `test/template.test.js` |
| Disabled job: scheduler does not run it | `test/scheduler.test.js` |

### Batch 2 Guide Test Cases

| Guide test case | Test file |
|---|---|
| Test connection with correct details: success message | `tests/testConnection.test.js`, `tests/connectionTest.test.js` |
| Test connection with wrong password: clear error, no crash | `tests/batch2Functional.test.js` |
| Run a saved SQL Server query: rows in common format | `tests/sampleQueries.test.js`, `tests/connectorsEndToEnd.test.js` |
| Run a saved HANA query: rows in common format | `tests/hana.test.js`, `tests/sampleQueries.test.js` |
| Run a Service Layer query with $filter: filtered rows in common format | `tests/batch2Functional.test.js`, `tests/integrateAllConnectors.test.js` |
| Service Layer returns many records: paging collects pages up to limit | `tests/batch2Functional.test.js`, `tests/limits.test.js` |
| Session expires on Service Layer: client logs in again and continues | `tests/batch2Functional.test.js` |
| Query contains DELETE or DROP: blocked with clear message | `tests/validator.test.js`, `tests/sqlServer.test.js` |
| Query takes too long: stops at timeout, error returned | `tests/limits.test.js` |
| Result has more rows than the limit: only limit is returned | `tests/limits.test.js`, `tests/batch2Functional.test.js` |
| Build a report from a result: CSV and Excel files open correctly | `tests/buildReport.test.js`, `tests/batch2Functional.test.js` |
| Normal user opens Connection settings: access blocked | `tests/adminOnly.test.js`, `tests/connectionController.test.js` |

## Folders

| Folder | What | Owner |
|---|---|---|
| `client/src/pages/` | One file per screen | Both |
| `server/engine/` | Scheduler, rules, templates, email, run logic | Batch 1 |
| `server/connectors/`, `core/`, `reports/` | SQL Server, SAP HANA, Service Layer, `runQuery`, CSV/Excel reports | Batch 2 |
| `server/models/` | Database collections (`index.js` is the shared contract) | Both |
| `server/routes/`, `controllers/`, `services/`, `middleware/`, `security/` | API, login/role checks, encryption, query safety | Both |
| `server/test/` (Batch 1), `server/tests/` (Batch 2) | Automated tests | Both |
| `mock-data/` | Test data only (no real customers) | Both |
| `db/sqlserver/` | Optional local SQL Server in Docker | Batch 2 |

`server/engine/fakeConnector.js` is the stand-in Batch 1 built before integration; the engine now uses
Batch 2's real `runQuery`.

## Database collections

| Collection | Stores | Owner |
|---|---|---|
| `users` | Logins and roles | Batch 1 |
| `jobs` | Query ID, rule, schedule, recipients, template, mode, enabled | Batch 1 |
| `templates` | Subject and body with placeholders | Batch 1 |
| `recipient_lists` | Named lists with To, CC, BCC | Batch 1 |
| `job_runs` | One record per run: rows fetched/matched, emails sent, status | Batch 1 |
| `delivery_logs` | One record per email: recipient, status, retries, error | Batch 1 |
| `sent_history` | Dedupe keys, so the same reminder is never sent twice | Batch 1 |
| `connections` | Data source details, password encrypted | Batch 2 |
| `queries` | Approved queries with field mapping | Batch 2 |

## The contract between batches

Batch 2 provides it, Batch 1 calls it. Do not change without telling the other batch.

```js
runQuery(queryId, params) // returns:
{
  "columns": ["InvoiceNo", "CustomerName", "Email", "DaysOverdue", "Amount"],
  "rows": [["INV-101", "ABC Traders", "abc@test.com", 10, 25000]],
  "meta": { "source": "SQLServer", "rowCount": 1 }
}
```

## Branches

```
main      <- stable, demo-ready (merge via Pull Request only)
batch1    <- Batch 1 lead merges team work here
batch2    <- Batch 2 lead merges team work here
batch1/*  <- Batch 1 feature branches -> PR into batch1
batch2/*  <- Batch 2 feature branches -> PR into batch2
```

Never push directly to `main` - open a Pull Request.
