const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getDepartmentStats,
  getReportDbStatus,
  triggerReportDbSync,
} = require('../controllers/statsController');

// All stats routes require authentication
router.use(protect);

// Department Metrics Endpoint
router.get('/department/:department', getDepartmentStats);

// Dedicated Report Database Endpoints
router.get('/report-db-status', getReportDbStatus);
router.post('/sync-report-db', triggerReportDbSync);

module.exports = router;