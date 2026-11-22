# Spoonful Web

Die Spoonful-App als Web-App. Es ist **derselbe Code**: alle Screens,
Komponenten, Texte, Themes und die komplette Supabase-Logik kommen direkt aus
`../mobile` und laufen über `react-native-web` im Browser. Es gibt keine zweite
Implementierung, die auseinanderlaufen könnte.

```bash
cd webapp
npm install
npm run dev      # http://127.0.0.1:5178
npm run build    # dist/
npm run preview  # gebauten Stand lokal ansehen
```

## Was im Browser ersetzt wird

Die App spricht direkt mit demselben Supabase-Projekt wie die Android-App
(`mobile/src/config-secrets.ts`), daher sind Konten, Rezepte, Community,
Einkaufsliste, Tracker und Haushalt identisch.

| Native Modul | Web-Ersatz |
| --- | --- |
| `react-native` | `react-native-web` plus `Alert`, `Linking`, `Share` aus `src/shims/react-native.tsx` |
| `@react-native-async-storage/async-storage` | `localStorage` (`src/shims/async-storage.ts`) |
| `react-native-image-picker` | verstecktes `<input type="file">`, Canvas-Resize, Base64 (`src/shims/image-picker.ts`) |
| `react-native-webview` | `<iframe>` mit `postMessage`-Brücke, Android-Asset-Pfade auf `/vendor/` umgeschrieben (`src/shims/webview.tsx`) |
| `react-native-svg` | echte SVG-Elemente im DOM (`src/shims/svg.tsx`) |
| `react-native-safe-area-context` | `env(safe-area-inset-*)` (`src/shims/safe-area.tsx`) |
| `@notifee/react-native` | Web Notifications; Erinnerungen laufen als Timer, solange der Tab offen ist (`src/shims/notifee.ts`) |
| `lucide-react-native` | `lucide-react` (gleiche Icons, gleiche Props) |

Barcode-Scanner und QR-Code nutzen weiterhin ZXing: `public/vendor/zxing.min.js`
ist die UMD-Version aus `@zxing/library`, die die eingebetteten HTML-Seiten der
App laden. Die Kamera kommt über `getUserMedia` (nur `https` oder `localhost`).

`src/web/glue.ts` passt drei Dinge an den Browser an: Supabase-Redirect-URLs,
den Connectivity-Probe gegen die CORS-freundliche Health-URL und das Aufräumen
der Auth-Tokens aus der Adresszeile.

## Supabase-Einstellungen für den Browser

Damit Bestätigungs-, Magic-Link-, Passwort-Reset- und Google-Mails zurück in die
Web-App führen, muss die Web-Adresse in Supabase unter
*Authentication → URL Configuration → Redirect URLs* stehen, z. B.

```
http://127.0.0.1:5178/
https://deine-domain.tld/
```

Ohne diesen Eintrag nutzt Supabase die *Site URL*; Anmeldung mit E-Mail und
Passwort funktioniert trotzdem. Abweichende Adressen lassen sich über
`VITE_AUTH_REDIRECT_URL` und `VITE_RESET_REDIRECT_URL` setzen.

## Deployment

`npm run build` erzeugt statische Dateien in `dist/`, die überall gehostet
werden können (die App braucht keinen eigenen Server, nur die Supabase-API).
