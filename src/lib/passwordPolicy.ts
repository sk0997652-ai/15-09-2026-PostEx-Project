// ==============================================================================
// Staff Password Policy Enforcement [HARD RULE]
// Policy: Minimum 10 characters, must include at least one number and one letter.
// ==============================================================================

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  rules: {
    minLength: boolean;
    hasLetter: boolean;
    hasNumber: boolean;
  };
}

export function validateStaffPassword(password: string): PasswordValidationResult {
  const minLength = (password || '').length >= 10;
  const hasLetter = /[a-zA-Z]/.test(password || '');
  const hasNumber = /[0-9]/.test(password || '');

  const errors: string[] = [];
  if (!minLength) {
    errors.push('Password must be at least 10 characters long.');
  }
  if (!hasLetter) {
    errors.push('Password must include at least one letter.');
  }
  if (!hasNumber) {
    errors.push('Password must include at least one number.');
  }

  return {
    isValid: minLength && hasLetter && hasNumber,
    errors,
    rules: {
      minLength,
      hasLetter,
      hasNumber,
    },
  };
}
