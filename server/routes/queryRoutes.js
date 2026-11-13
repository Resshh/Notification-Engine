
const express = require("express");
const queryController = require("../controllers/queryController");
const queryService = require("../services/queryService");

const router = express.Router();

// Create a query
router.post("/", queryController.createQuery);

// Get all saved queries
router.get("/", queryController.getAllQueries);

// Preview a saved query
router.post("/:id/preview", async (req, res, next) => {
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
router.get("/:id", queryController.getQueryById);

// Update a query
router.put("/:id", queryController.updateQuery);

// Delete a query
router.delete("/:id", queryController.deleteQuery);

module.exports = router;
