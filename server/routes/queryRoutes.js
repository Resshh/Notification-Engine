
const express = require("express");
const queryController = require("../controllers/queryController");
const queryService = require("../services/queryService");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Reads: any logged-in user (job form and template dropdowns). Changes and previews: admins only.

// Create a query
router.post("/", requireAdmin, queryController.createQuery);

// Get all saved queries
router.get("/", requireAuth, queryController.getAllQueries);

// Preview a saved query
router.post("/:id/preview", requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const params = req.body?.params || {};

    const result = await queryService.testQuery(id, params);

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// Get a query by ID
router.get("/:id", requireAuth, queryController.getQueryById);

// Update a query
router.put("/:id", requireAdmin, queryController.updateQuery);

// Delete a query
router.delete("/:id", requireAdmin, queryController.deleteQuery);

module.exports = router;
