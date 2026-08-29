const express = require('express');
const router = express.Router();
const holidayController = require('../controllers/holidayController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', holidayController.getHolidays);
router.post('/', authorize('HOD', 'SUPER_ADMIN'), holidayController.createHoliday);
router.put('/:id', authorize('HOD', 'SUPER_ADMIN'), holidayController.updateHoliday);
router.delete('/:id', authorize('HOD', 'SUPER_ADMIN'), holidayController.deleteHoliday);

module.exports = router;