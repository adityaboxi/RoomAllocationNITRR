const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Timetable = require('../models/Timetable');

// Get all timetable entries
router.get('/', protect, async (req, res) => {
  try {
    const entries = await Timetable.find({ isActive: true });
    res.json({ success: true, data: entries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create timetable entry (HOD only)
router.post('/', protect, async (req, res) => {
  try {
    if (req.user.role !== 'HOD') {
      return res.status(403).json({ success: false, message: 'Only HOD can manage timetable' });
    }
    const entry = await Timetable.create(req.body);
    res.status(201).json({ success: true, data: entry });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
