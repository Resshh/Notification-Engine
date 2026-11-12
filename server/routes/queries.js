// Batch 1 extra on Batch 2's saved queries (Batch 2's queryRoutes owns the CRUD).
// GET /api/queries/:id/sample -> columns + up to 5 rows: feeds the rule column dropdown and the template preview.
const router = require('express').Router();
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const { runQuery } = require('../core/runQuery');
const { toObjects } = require('../engine/rules');

router.get('/:id/sample', requireAuth, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid query ID' });
  try {
    const data = await runQuery(req.params.id);
    res.json({ columns: data.columns, rows: toObjects({ columns: data.columns, rows: data.rows.slice(0, 5) }) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
