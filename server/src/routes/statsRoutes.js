const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getDepartmentStats } = require('../controllers/statsController');

// All stats routes require authentication
router.use(protect);

// Department Metrics Endpoint
router.get('/department/:department', getDepartmentStats);

module.exports = router;