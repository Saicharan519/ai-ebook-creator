const express = require("express");
const router = express.Router();
const {exportAsPDF,exportAsDocuments } = require("../controllers/exportcontroller");
const { protect } = require("../middleware/authMiddleware");


router.get("/:id/pdf", protect, exportAsPDF);
router.get("/:id/docx", protect, exportAsDocuments);
module.exports = router;