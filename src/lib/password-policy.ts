export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export function signupPasswordError(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (password.length > PASSWORD_MAX_LENGTH) return `Use ${PASSWORD_MAX_LENGTH} characters or fewer.`;
  if (!/\p{L}/u.test(password)) return "Include at least one letter.";
  if (!/\p{N}/u.test(password)) return "Include at least one number.";
  return null;
}
