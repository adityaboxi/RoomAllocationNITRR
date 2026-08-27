/**
 * Strict Validator for NIT Raipur Faculty & HOD Portal (TESTING MODE)
 * Now only accepts @gmail.com for testing.
 */
export const validateFacultyAndHodEmail = (email, selectedRole = 'FACULTY') => {
  if (!email || typeof email !== 'string') {
    return { isValid: false, message: 'Please enter your email address.' };
  }

  const cleanEmail = email.trim().toLowerCase();

  // Basic syntax check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { isValid: false, message: 'Please enter a valid email address format.' };
  }

  const [localPart, domain] = cleanEmail.split('@');

  // ---- TESTING: only allow @gmail.com ----
  if (domain !== 'gmail.com') {
    return {
      isValid: false,
      message: 'Only @gmail.com email addresses are allowed for testing.',
    };
  }

  // ---- HOD detection based on prefix ----
  const isHodEmail = localPart.startsWith('hod.') || localPart.startsWith('head.') || localPart === 'hod';

  // If user selected HOD but email doesn't match HOD pattern
  if (selectedRole === 'HOD' && !isHodEmail) {
    return {
      isValid: false,
      message: 'HOD role requires email starting with "hod." (e.g., hod.cs@gmail.com).',
    };
  }

  // If user selected FACULTY but email matches HOD pattern
  if (selectedRole === 'FACULTY' && isHodEmail) {
    return {
      isValid: false,
      message: 'This is an HOD email. Please switch to the HOD role.',
    };
  }

  // Optionally, enforce a format for faculty (e.g., at least two parts with dot)
  // but we can keep it loose for testing.
  // You can add a pattern if desired, but not required.

  return { isValid: true, message: '' };
};