/**
 * Validate waitlist email
 * Returns error message if invalid, null if valid
 */
export const validateWaitlistEmail = (email: string): string | null => {
  if (!email) {
    return 'Email is required';
  }

  if (typeof email !== 'string') {
    return 'Email must be a string';
  }

  if (email.trim().length === 0) {
    return 'Email cannot be empty';
  }

  const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
  if (!emailRegex.test(email)) {
    return 'Please provide a valid email address';
  }

  if (email.length > 254) {
    return 'Email is too long';
  }

  return null;
};
