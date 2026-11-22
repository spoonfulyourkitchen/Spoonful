
function isWikimedia(uri: string): boolean {
  return /upload\.wikimedia\.org\/([^/]+)\//.test(uri);
}

function wikimediaThumb(uri: string, width: number): string {
  const parts = uri.split('?')[0].split('/');
  const thumbAt = parts.indexOf('thumb');
  if (thumbAt >= 0 && parts.length >= thumbAt + 3) {
    const file = parts[parts.length - 2];
    parts[parts.length - 1] = `${width}px-${file}`;
    return parts.join('/');
  }
  const wikiAt = parts.indexOf('wikipedia');
  if (wikiAt < 0 || parts.length < wikiAt + 4) return uri;
  const projectAt = wikiAt + 1;
  const file = parts[parts.length - 1];
  const folders = parts.slice(projectAt + 1, parts.length - 1);
  const head = parts.slice(0, projectAt + 1).join('/');
  return `${head}/thumb/${folders.join('/')}/${file}/${width}px-${file}`;
}

function supabaseThumb(uri: string, width: number): string {
  if (!/\/storage\/v1\/object\/public\//.test(uri)) return uri;
  const [base, query] = uri.split('?');
  const converted = base.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
  const params = new URLSearchParams(query ?? '');
  params.set('width', String(width));
  params.set('quality', '72');
  params.set('resize', 'contain');
  return `${converted}?${params.toString()}`;
}

export function thumbUrl(uri?: string | null, width = 480): string | undefined {
  const value = String(uri ?? '').trim();
  if (!value || !value.startsWith('http')) return value || undefined;
  const want = Math.max(80, Math.min(1600, Math.round(width * 2)));
  try {
    if (isWikimedia(value)) return wikimediaThumb(value, want);
    if (value.includes('/storage/v1/object/public/')) return supabaseThumb(value, want);
  } catch {
  }
  return value;
}

export function isThumbUrl(uri?: string | null): boolean {
  const value = String(uri ?? '');
  return /\/thumb\/.+\/\d+px-/.test(value) || value.includes('/render/image/');
}

export const IMAGE_HEADERS: Record<string, string> = {
  'User-Agent': 'Spoonful/1.0 (Android; React Native recipe app)',
};

export function imageSource(
  uri?: string | null,
  thumbWidth?: number,
  forceOriginal = false,
): { uri: string; headers: Record<string, string> } | undefined {
  const value = String(uri ?? '').trim();
  if (!value) return undefined;
  const finalUri = forceOriginal || !thumbWidth ? value : thumbUrl(value, thumbWidth) ?? value;
  return { uri: finalUri, headers: IMAGE_HEADERS };
}
