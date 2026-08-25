const validateBooking = (data) => {
  const errors = [];
  const { roomId, date, startTime, endTime, subject } = data;

  if (!roomId) {
    errors.push('Room ID is required');
  }

  if (!date) {
    errors.push('Date is required');
  } else {
    const bookingDate = new Date(date);
    if (isNaN(bookingDate.getTime())) {
      errors.push('Invalid date format');
    }
    // Check if date is not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (bookingDate < today) {
      errors.push('Cannot book in the past');
    }
  }

  if (!startTime) {
    errors.push('Start time is required');
  } else if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(startTime)) {
    errors.push('Invalid start time format (HH:MM)');
  }

  if (!endTime) {
    errors.push('End time is required');
  } else if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(endTime)) {
    errors.push('Invalid end time format (HH:MM)');
  }

  if (startTime && endTime && startTime >= endTime) {
    errors.push('End time must be after start time');
  }

  if (!subject || subject.trim().length === 0) {
    errors.push('Subject is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

const validateLock = (data) => {
  const errors = [];
  const { roomId, date, startTime, endTime } = data;

  if (!roomId) {
    errors.push('Room ID is required');
  }

  if (!date) {
    errors.push('Date is required');
  }

  if (!startTime) {
    errors.push('Start time is required');
  }

  if (!endTime) {
    errors.push('End time is required');
  }

  if (startTime && endTime && startTime >= endTime) {
    errors.push('End time must be after start time');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

const validateTimeSlot = (data) => {
  const errors = [];
  const { date, startTime, endTime, roomId } = data;

  if (!date) {
    errors.push('Date is required');
  }

  if (!startTime) {
    errors.push('Start time is required');
  }

  if (!endTime) {
    errors.push('End time is required');
  }

  if (!roomId) {
    errors.push('Room ID is required');
  }

  if (startTime && endTime && startTime >= endTime) {
    errors.push('End time must be after start time');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = {
  validateBooking,
  validateLock,
  validateTimeSlot
};
