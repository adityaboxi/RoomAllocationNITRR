const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Room = require('../models/Room');

// Get all rooms
router.get('/', protect, async (req, res) => {
  try {
    const rooms = await Room.find({ isActive: true });
    res.json({ success: true, data: rooms });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create room (HOD only)
router.post('/', protect, async (req, res) => {
  try {
    if (req.user.role !== 'HOD') {
      return res.status(403).json({ success: false, message: 'Only HOD can create rooms' });
    }
    const room = await Room.create(req.body);
    res.status(201).json({ success: true, data: room });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
