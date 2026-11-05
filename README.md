# Notification Engine

ICTAK internship project - Batch 1 (Notification Engine) + Batch 2 (Data Connectors).
Stack: React + Vite, Node.js + Express, MongoDB.

## Run

```bash
# server  -> http://localhost:5000/api/health
cd server
npm install
npm run dev

# client  -> http://localhost:5173
cd client
npm install
npm run dev
```

Each person creates their own `server/.env` (never commit it).

## Folders

| Folder | Owner |
|---|---|
| `client/` | Both - one file per screen in `src/pages/` |
| `server/engine/` | Batch 1 - scheduler, rules, templates, email, logs |
| `server/connectors/` | Batch 2 - SQL Server, SAP HANA, Service Layer, reports |
| `server/controllers/`, `routes/`, `middleware/`, `utils/` | Both - one file per feature |
| `server/models/` | Both - one file per collection |
| `mock-data/` | Both - test data only |

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

