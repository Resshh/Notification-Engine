const express = require("express");
const { requireAuth } = require("../middleware/auth");
const {
  getRunHistory,
  getRunDeliveries
} = require("../controllers/runHistoryController");

const router = express.Router();

router.use(requireAuth);
router.get("/", getRunHistory);
router.get("/:id/deliveries", getRunDeliveries);

module.exports = router;
