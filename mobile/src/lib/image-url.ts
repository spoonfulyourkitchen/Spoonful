/**
 * 3.2.2: Bilder in der richtigen Größe anfordern.
 *
 * Warum das wichtig ist
 * ---------------------
 * Eine Bibliotheks-Liste zeigt bis zu 24 Kacheln. Wird jede Kachel mit dem
 * Originalfoto (oft 3000 x 2000 px, mehrere MB) geladen, muss das Handy jedes
 * Bild vollständig in den Speicher packen — auf Geräten mit wenig RAM der
 * häufigste Grund für Abstürze und für „die App ruckelt / zieht Akku".
 *
 * Diese Datei baut aus einer Bild-URL eine **kleine** Variante derselben Quelle:
 *  - Wikimedia/Commons: offizieller Thumbnail-Pfad bzw. geänderte Breite,
 *  - Supabase Storage: Bilddienst (`/render/image/...?width=`),
 *  - alles andere: unverändert (dann greift der Rückfall im Bild).
 *
 * Wichtig: Schlägt ein Thumbnail fehl, lädt der Aufrufer das Original nach
 * (siehe `CroppedImage`). Es kann also nichts „verschwinden".
 */

/** Ist das eine Wikimedia-Datei (upload.wikimedia.org)? */
function isWikimedia(uri: string): boolean {
  return /upload\.wikimedia\.org\/([^/]+)\//.test(uri);
}

/** Wikimedia: Pfad in der Form /wikipedia/commons/thumb/a/ab/Name/800px-Name. */
function wikimediaThumb(uri: string, width: number): string {
  const parts = uri.split('?')[0].split('/');
  const thumbAt = parts.indexOf('thumb');
  if (thumbAt >= 0 && parts.length >= thumbAt + 3) {
    // Schon ein Thumbnail: nur die Breite austauschen (1280px- -> 260px-).
    const file = parts[parts.length - 2];
    parts[parts.length - 1] = `${width}px-${file}`;
    return parts.join('/');
  }
  // Original: Thumbnail-Pfad einbauen:
  //   .../wikipedia/commons/a/ab/Name -> .../wikipedia/commons/thumb/a/ab/Name/480px-Name
  const wikiAt = parts.indexOf('wikipedia');
  if (wikiAt < 0 || parts.length < wikiAt + 4) return uri;
  const projectAt = wikiAt + 1; // "commons"
  const file = parts[parts.length - 1];
  const folders = parts.slice(projectAt + 1, parts.length - 1); // a/ab
  const head = parts.slice(0, projectAt + 1).join('/');
  return `${head}/thumb/${folders.join('/')}/${file}/${width}px-${file}`;
}

/** Supabase Storage: über den Bilddienst verkleinern. */
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

/**
 * Kleine Variante einer Bild-URL. `width` ist die gewünschte Anzeigebreite in
 * Pixeln (die App rechnet selbst mit 2x für scharfe Displays).
 */
export function thumbUrl(uri?: string | null, width = 480): string | undefined {
  const value = String(uri ?? '').trim();
  if (!value || !value.startsWith('http')) return value || undefined;
  const want = Math.max(80, Math.min(1600, Math.round(width * 2)));
  try {
    if (isWikimedia(value)) return wikimediaThumb(value, want);
    if (value.includes('/storage/v1/object/public/')) return supabaseThumb(value, want);
  } catch {
    /* im Zweifel das Original */
  }
  return value;
}

/** Ist die URL schon eine verkleinerte Variante? (für Tests/Debug) */
export function isThumbUrl(uri?: string | null): boolean {
  const value = String(uri ?? '');
  return /\/thumb\/.+\/\d+px-/.test(value) || value.includes('/render/image/');
}

/**
 * Wikimedia blockt generische HTTP-Clients (403) ohne eigenen User-Agent.
 * ACHTUNG: Kopfzeilen müssen reines ASCII bleiben (OkHttp lehnt Umlaute ab).
 */
export const IMAGE_HEADERS: Record<string, string> = {
  'User-Agent': 'Spoonful/1.0 (Android; React Native recipe app)',
};

/**
 * Bildquelle für `<Image />`: verkleinerte URL (wenn gewünscht) plus Kopfzeilen.
 * `forceOriginal` benutzt der Rückfall, wenn ein Thumbnail nicht lädt.
 */
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
