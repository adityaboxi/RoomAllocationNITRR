const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getDepartmentStats } = require('../controllers/statsController');

router.get('/department/:department', protect, getDepartmentStats);

module.exports = router;