const express = require("express");
const router = express.Router();

const {
  createTemplate,
  getTemplate,
  updateTemplate,
  previewTemplate,
} = require("../controller/templateController");

// Create template
router.post("/", createTemplate);

// Get template
router.get("/:id", getTemplate);

// Update template
router.put("/:id", updateTemplate);

// Preview template
router.post("/:id/preview", previewTemplate);

module.exports = router;