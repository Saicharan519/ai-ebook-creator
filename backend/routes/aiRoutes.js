const express = require('express');
const router = express.Router();
const{
    generateOutline,
    generateChapterContent,
} = require("../controllers/aicontroller");
const { protect } = require("../middleware/authMiddleware");
//apply protect middleware to all routes
router.use(protect);

router.post("/generate-outline", generateOutline);
router.post("/generate-chapter-content", generateChapterContent);
module.exports = router;

