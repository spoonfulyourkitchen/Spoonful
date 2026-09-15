/**
 * Live-Prüfskript für „Video-Link -> Rezept".
 *
 * Aufruf:  node tools/video-check.mjs "https://www.youtube.com/watch?v=..."
 *
 * Es zeigt genau das, was die App braucht:
 *  - kommt die Seite überhaupt an?
 *  - wie lang ist die Beschreibung (dort steht bei Kochvideos das Rezept)?
 *  - gibt es Untertitel-Spuren und liefert die Untertitel-Adresse Text?
 *
 * Hinweis: Große Videodienste drosseln Server-Netze. Eine leere Untertitel-
 * Antwort hier bedeutet nicht, dass es am Handy auch so ist.
 */
const UA =
  'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36';

const link = process.argv[2] ?? 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const id = /(?:v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{6,})/.exec(link)?.[1];

if (!id) {
  console.log('Kein YouTube-Link erkannt:', link);
  process.exit(1);
}

const html = await fetch(`https://www.youtube.com/watch?v=${id}&hl=de`, { headers: { 'User-Agent': UA } }).then((r) => r.text());
console.log(`Seite: ${html.length} Zeichen`);

const title = /"videoDetails":\{"videoId":"[^"]*","title":"((?:[^"\\]|\\.)*)"/.exec(html)?.[1] ?? '(unbekannt)';
const description = /"shortDescription":"((?:[^"\\]|\\.)*)"/.exec(html)?.[1] ?? '';
const plainDescription = description.replace(/\\n/g, '\n').replace(/\\"/g, '"');
console.log(`Titel: ${JSON.parse(`"${title}"`)}`);
console.log(`Beschreibung: ${plainDescription.length} Zeichen`);
console.log(`  Hinweis auf Rezept: ${/zutaten|ingredients|zubereitung|method|rezept/i.test(plainDescription) ? 'ja' : 'nein'}`);

const tracks = [...html.matchAll(/"baseUrl":"([^"]+)"/g)].map((m) => m[1]);
console.log(`Untertitel-Spuren: ${tracks.length}`);
if (tracks.length) {
  let url = tracks[0].replace(/\\u0026/g, '&').replace(/\\\//g, '/');
  if (url.startsWith('/')) url = `https://www.youtube.com${url}`;
  const body = await fetch(`${url}${url.includes('?') ? '&' : '?'}fmt=json3`, { headers: { 'User-Agent': UA } }).then((r) => r.text());
  console.log(`  Untertitel-Antwort: ${body.length} Zeichen${body.length ? '' : ' (leer - Netz/Sperre)'}`);
}

console.log(
  '\nWas die App macht: Beschreibung + Untertitel -> lokale Erkennung -> falls nötig einmal die KI.',
);
console.log(plainDescription.slice(0, 400));
