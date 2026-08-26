/**
 * Strict Validator for NIT Raipur Faculty & HOD Portal
 */
export const validateFacultyAndHodEmail = (email, selectedRole = 'FACULTY') => {
  if (!email || typeof email !== 'string') {
    return { isValid: false, message: 'Please enter your institutional email address.' };
  }

  const cleanEmail = email.trim().toLowerCase();

  // Basic syntax check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { isValid: false, message: 'Please enter a valid email address format.' };
  }

  const [localPart, domain] = cleanEmail.split('@');

  // 1. REJECT PUBLIC EMAIL PROVIDERS
  const publicDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'];
  if (publicDomains.includes(domain)) {
    return {
      isValid: false,
      message: 'Personal email addresses are prohibited. Please use your official @nitrr.ac.in ID.',
    };
  }

  // 2. CHECK NIT RAIPUR ROOT OR SUBDOMAIN
  const isNitrrDomain = domain === 'nitrr.ac.in' || domain.endsWith('.nitrr.ac.in');
  if (!isNitrrDomain) {
    return {
      isValid: false,
      message: 'Access Denied: Only official NIT Raipur email addresses are permitted.',
    };
  }

  // 3. EXPLICIT STUDENT PATTERN DETECTION FIRST
  const hasRollNumber = /\d{6,9}/.test(localPart);
  const hasStudentBatchTag = /\.(btech|mtech|mca|barch|phd)\d{2,4}/i.test(localPart);
  const isStudentSubdomain = domain.includes('student');

  if (hasRollNumber || hasStudentBatchTag || isStudentSubdomain) {
    return {
      isValid: false,
      message: 'Access Denied: Student accounts are not authorized to access the Faculty Room Booking portal.',
    };
  }

  // 4. HOD ROLE STRICT ENFORCEMENT
  const isHodEmail = localPart.startsWith('hod.') || localPart.startsWith('head.') || localPart === 'hod';
  
  if (selectedRole === 'HOD') {
    if (!isHodEmail) {
      return {
        isValid: false,
        message: 'Access Denied: Only official Head of Department accounts (e.g. hod.cs@nitrr.ac.in) can access the HOD portal. Please switch to the Faculty role.',
      };
    }
  }

  // 5. FACULTY ROLE RESTRICTION (Blocks accidental HOD login in Faculty tab or invalid format)
  if (selectedRole === 'FACULTY') {
    if (isHodEmail) {
      return {
        isValid: false,
        message: 'This is an official HOD email address. Please switch to the HOD authorization role above.',
      };
    }

    const facultyPattern = /^[a-z]+(\.[a-z]+)+$/;
    if (!facultyPattern.test(localPart)) {
      return {
        isValid: false,
        message: 'Invalid Faculty ID format. Please use: initials.dept@nitrr.ac.in (e.g., dssisodia.cs@nitrr.ac.in).',
      };
    }
  }

  return { isValid: true, message: '' };
};