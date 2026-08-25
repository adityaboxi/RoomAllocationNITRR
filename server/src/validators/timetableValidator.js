const validateTimetableEntry = (data) => {
  const errors = [];
  const { day, startTime, endTime, subject, professorId, roomId } = data;

  const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  if (!day || !validDays.includes(day)) {
    errors.push(`Day must be one of: ${validDays.join(', ')}`);
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

  if (!professorId) {
    errors.push('Professor ID is required');
  }

  if (!roomId) {
    errors.push('Room ID is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

const validateTimetable = (data) => {
  const errors = [];
  const { department, semester, section, entries } = data;

  const validDepartments = ['CSE', 'ECE', 'ME', 'EE', 'CE', 'MME', 'BT', 'IT', 'MCA', 'MBA'];
  if (!department || !validDepartments.includes(department)) {
    errors.push(`Department must be one of: ${validDepartments.join(', ')}`);
  }

  const validSemesters = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
  if (!semester || !validSemesters.includes(semester)) {
    errors.push(`Semester must be one of: ${validSemesters.join(', ')}`);
  }

  const validSections = ['A', 'B', 'C', 'D'];
  if (!section || !validSections.includes(section)) {
    errors.push(`Section must be one of: ${validSections.join(', ')}`);
  }

  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    errors.push('Entries array is required and must not be empty');
    return {
      isValid: false,
      errors
    };
  }

  const entryErrors = [];
  entries.forEach((entry, index) => {
    const result = validateTimetableEntry(entry);
    if (!result.isValid) {
      entryErrors.push({
        index: index,
        errors: result.errors
      });
    }
  });

  if (entryErrors.length > 0) {
    errors.push(`Found ${entryErrors.length} invalid timetable entry(s)`);
    return {
      isValid: false,
      errors,
      entryErrors
    };
  }

  return {
    isValid: true,
    errors: []
  };
};

module.exports = {
  validateTimetableEntry,
  validateTimetable
};
