const express = require("express");
const queryController = require("../controllers/queryController");

// Express router for query management and preview endpoints.
// Ref: Story 5.1, Story 5.2.

const router = express.Router();

// Story 5.2 Test Query & Preview Routes (Ref: Sub-tasks 142, 143, FR-11)
router.post("/test", queryController.testQueryTransient);
router.post("/:id/test", queryController.testQuery);
router.post("/:id/preview", queryController.testQuery);

// Story 5.1 CRUD Routes
router.post("/", queryController.createQuery);
router.get("/", queryController.getAllQueries);
router.get("/:id", queryController.getQueryById);
router.put("/:id", queryController.updateQuery);
router.delete("/:id", queryController.deleteQuery);

module.exports = router;

