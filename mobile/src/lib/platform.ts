export const IS_WEB = typeof document !== 'undefined' && typeof window !== 'undefined';

function hostname(): string {
  try {
    return typeof window !== 'undefined' ? window.location.hostname : '';
  } catch {
    return '';
  }
}

export const IS_LOCAL_WEB = IS_WEB && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(hostname());
