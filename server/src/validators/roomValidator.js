const validateRoom = (data) => {
  const errors = [];
  const { roomNumber, capacity, floor, department, building } = data;

  if (!roomNumber || roomNumber.trim().length === 0) {
    errors.push('Room number is required');
  }

  if (!capacity || capacity < 1) {
    errors.push('Capacity must be at least 1');
  }

  if (floor === undefined || floor === null || floor < 0) {
    errors.push('Floor must be 0 or greater');
  }

  if (!department) {
    errors.push('Department is required');
  }

  const validDepartments = ['CSE', 'ECE', 'ME', 'EE', 'CE', 'MME', 'BT', 'IT', 'MCA', 'MBA', 'General'];
  if (department && !validDepartments.includes(department)) {
    errors.push(`Department must be one of: ${validDepartments.join(', ')}`);
  }

  if (!building || building.trim().length === 0) {
    errors.push('Building is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

const validateBulkRooms = (data) => {
  const errors = [];
  const { rooms } = data;

  if (!rooms || !Array.isArray(rooms) || rooms.length === 0) {
    errors.push('Rooms array is required and must not be empty');
    return {
      isValid: false,
      errors
    };
  }

  const roomErrors = [];
  rooms.forEach((room, index) => {
    const result = validateRoom(room);
    if (!result.isValid) {
      roomErrors.push({
        index: index,
        roomNumber: room.roomNumber || 'Unknown',
        errors: result.errors
      });
    }
  });

  if (roomErrors.length > 0) {
    errors.push(`Found ${roomErrors.length} invalid room(s)`);
    return {
      isValid: false,
      errors,
      roomErrors
    };
  }

  return {
    isValid: true,
    errors: []
  };
};

const validateRoomUpdate = (data) => {
  const errors = [];
  const { capacity, floor, department, building } = data;

  if (capacity && capacity < 1) {
    errors.push('Capacity must be at least 1');
  }

  if (floor !== undefined && floor !== null && floor < 0) {
    errors.push('Floor must be 0 or greater');
  }

  const validDepartments = ['CSE', 'ECE', 'ME', 'EE', 'CE', 'MME', 'BT', 'IT', 'MCA', 'MBA', 'General'];
  if (department && !validDepartments.includes(department)) {
    errors.push(`Department must be one of: ${validDepartments.join(', ')}`);
  }

  if (building && building.trim().length === 0) {
    errors.push('Building cannot be empty');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = {
  validateRoom,
  validateBulkRooms,
  validateRoomUpdate
};