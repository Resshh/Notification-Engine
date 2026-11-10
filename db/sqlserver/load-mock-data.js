const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
// Reuse the packages already installed in server/
const req = createRequire(path.join(__dirname, '../../server/package.json'));
const sql = req('mssql');
req('dotenv').config({ path: path.join(__dirname, '.env') });

const set = process.argv[2] || 'demo';                       // demo or large
const dir = process.argv[3] || path.join(__dirname, '../../mock-data', set);
const TABLES = ['Invoices', 'PurchaseOrders', 'Items', 'SalesSummary'];

function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.length > 1 || r[0] !== '');
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i]])));
}

function readTable(name) {
  const file = fs.readdirSync(dir).find((f) => f.toLowerCase().startsWith(name.toLowerCase() + '.'));
  if (!file) throw new Error(`No file for ${name} in ${dir}`);
  const text = fs.readFileSync(path.join(dir, file), 'utf8').replace(/^\uFEFF/, '');
  if (file.endsWith('.json')) {
    const d = JSON.parse(text);
    return Array.isArray(d) ? d : d.rows || d.value;
  }
  if (file.endsWith('.csv')) return parseCsv(text);
  throw new Error(`Unsupported file type: ${file}`);
}

(async () => {
  const pool = await new sql.ConnectionPool({
    server: 'localhost', port: 1433, user: 'sa',
    password: process.env.MSSQL_SA_PASSWORD, database: 'NotificationsTest',
    options: { encrypt: true, trustServerCertificate: true },   // local test DB only
  }).connect();

  for (const t of TABLES) {
    const rows = readTable(t);
    const cols = Object.keys(rows[0]);
    if (!cols.every((c) => /^\w+$/.test(c))) throw new Error(`Bad column name in ${t}`);
    await pool.request().query(`DELETE FROM dbo.${t}`);
    const stmt = `INSERT INTO dbo.${t} (${cols.map((c) => `[${c}]`).join(',')}) VALUES (${cols.map((_, i) => `@p${i}`).join(',')})`;
    for (const r of rows) {
      const rq = pool.request();
      cols.forEach((c, i) => rq.input(`p${i}`, r[c] === '' ? null : r[c]));
      await rq.query(stmt);
    }
    console.log(`${t}: loaded ${rows.length} rows`);
  }
  await pool.close();
})().catch((e) => { console.error(e.message); process.exit(1); });