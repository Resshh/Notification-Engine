const express = require("express");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  previewTemplate
} = require("../controllers/templateController");

const router = express.Router();

router.get("/", requireAuth, getTemplates);
router.post("/preview", requireAuth, previewTemplate);
router.post("/", requireAdmin, createTemplate);
router.put("/:id", requireAdmin, updateTemplate);
router.delete("/:id", requireAdmin, deleteTemplate);

module.exports = router;
