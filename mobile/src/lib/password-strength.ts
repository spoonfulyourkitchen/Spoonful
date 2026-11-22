

export const PASSWORD_MIN_LEVEL = 4;

export function passwordStrengthLevel(password: string): number {
  if (!password) return 0;

  const len = password.length;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;

  

  if (len < 8) return len >= 6 ? 2 : 1;

  let score = 2; 
  if (classes >= 2) score += 1; 
  if (classes >= 3) score += 1; 
  if (len >= 12 && classes >= 3) score += 1;

  
  if (/^(.)\1+$/.test(password)) score -= 2; 
  if (/^(?:\d+|[a-z]+|[A-Z]+)$/.test(password)) score -= 1; 
  if (/password|passwort|qwerty|asdf|12345|abc123|letmein|admin/i.test(password)) score -= 2;

  return Math.max(0, Math.min(5, score));
}

export function passwordStrengthColor(level: number): string {
  const palette = ['#b91c1c', '#ef4444', '#ca8a04', '#facc15', '#16a34a', '#22c55e'];
  return palette[Math.max(0, Math.min(5, level))];
}

export function passwordStrengthKey(level: number): string {
  if (level >= PASSWORD_MIN_LEVEL) return 'auth.pwStrong';
  if (level >= 2) return 'auth.pwMedium';
  return 'auth.pwWeak';
}
