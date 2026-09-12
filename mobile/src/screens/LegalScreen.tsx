import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { colors, fonts, readableText } from '../theme';
import { goBack } from '../navigation/rootRef';
import { GlassCard } from '../components/ui';

export const LEGAL_PAGES = [
  { page: 'impressum', label: 'Impressum' },
  { page: 'datenschutz', label: 'Datenschutz' },
  { page: 'cookies', label: 'Cookies' },
  { page: 'agb', label: 'AGB' },
] as const;
export type LegalPageId = (typeof LEGAL_PAGES)[number]['page'];

const SECTIONS: Record<LegalPageId, { h: string; body: string }[]> = {
  impressum: [
    { h: 'Anbieter (Angaben gemäß § 5 DDG)', body: 'Spoonful wird betrieben von: Salem Ibrahim, Geiersberg 13, 35578 Wetzlar, Deutschland.' },
    { h: 'Kontakt', body: 'E-Mail: spoonfulsupport@gmail.com. Anfragen beantworten wir in der Regel innerhalb weniger Werktage. Eine Telefonhotline betreiben wir derzeit nicht.' },
    { h: 'Verantwortlich für den Inhalt (§ 18 Abs. 2 MStV)', body: 'Salem Ibrahim, Anschrift wie oben.' },
    { h: 'App, Version und Bezug', body: 'Gegenstand dieses Angebots ist die Koch- und Rezept-App Spoonful (Android, Version 2.0.0). Die App wird derzeit direkt als Installationsdatei (APK) bereitgestellt. Ein Bezug über App-Märkte bleibt vorbehalten; dort gelten zusätzlich die Bedingungen des jeweiligen Marktes.' },
    { h: 'Umsatzsteuer', body: 'Spoonful ist derzeit vollständig kostenlos. Eine Umsatzsteuer-Identifikationsnummer ist daher nicht angegeben; sie wird bei kostenpflichtigen Angeboten an dieser Stelle ergänzt.' },
    { h: 'EU-Streitbeilegung und Verbraucherschlichtung', body: 'Die von der EU-Kommission bereitgestellte Plattform zur Online-Streitbeilegung (OS-Plattform) wurde zum 20. Juli 2025 eingestellt; einen Link hierzu gibt es daher nicht mehr. Wir sind nicht verpflichtet und nicht bereit, an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.' },
    { h: 'Haftung für Inhalte und Links', body: 'Für eigene Inhalte sind wir nach den allgemeinen Gesetzen verantwortlich, nicht jedoch für übermittelte oder gespeicherte fremde Informationen (Nutzerinhalte). Für Inhalte extern verlinkter Seiten ist stets der jeweilige Anbieter verantwortlich; bei Bekanntwerden von Rechtsverstößen entfernen wir solche Links unverzüglich.' },
    { h: 'Urheberrecht', body: 'Design, Texte und Code der App sind urheberrechtlich geschützt. Von Nutzern hochgeladene Rezepte, Bilder und Kommentare bleiben Eigentum der jeweiligen Nutzer.' },
  ],
  datenschutz: [
    { h: '1. Überblick und Verantwortlicher', body: 'Diese Datenschutzerklärung informiert über die Verarbeitung personenbezogener Daten in der App Spoonful (Android, Version 2.0.0) gemäß DSGVO. Verantwortlicher: Salem Ibrahim, Geiersberg 13, 35578 Wetzlar, Deutschland, E-Mail: spoonfulsupport@gmail.com. Stand: September 2026.' },
    { h: '2. Konto, Registrierung und Anmeldung', body: 'Wir verarbeiten deine E-Mail-Adresse sowie dein Passwort (ausschließlich als Hash, niemals im Klartext lesbar), optional deinen Namen und deine Koch-Erfahrung. Zur Bestätigung der E-Mail-Adresse senden wir einen 8-stelligen Code, der eine Stunde gültig ist. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertrag bzw. Konto). Anmeldung ist per Passwort, per E-Mail-Code oder per Code zum Zurücksetzen des Passworts möglich.' },
    { h: '3. Eigene Inhalte', body: 'Eigene Rezepte, gespeicherte Rezepte, Sammlungen, Notizen, Mahlzeiten-Einträge und Einkaufslisten werden deinem Konto zugeordnet und sind für andere Nutzer nicht sichtbar, solange du sie nicht ausdrücklich teilst. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.' },
    { h: '4. Gesundheitsbezogene Daten im Tracker', body: 'Kalorien-Einträge, Gewichtsprotokoll und dein Ernährungsprofil (Zielwerte) können Gesundheitsdaten im Sinne von Art. 9 DSGVO sein. Sie werden ausschließlich für dich gespeichert und verarbeitet, damit dir die App Auswertungen und Wochenberichte zeigen kann. Rechtsgrundlage ist deine ausdrückliche Einwilligung nach Art. 9 Abs. 2 lit. a DSGVO, die du jederzeit widerrufen kannst, indem du die Einträge oder dein Konto löschst. Die Angaben sind keine medizinische oder Ernährungsberatung.' },
    { h: '5. Community-Funktionen (öffentliche Inhalte)', body: 'Wenn du ein Rezept teilst, veröffentlichst du Titel, Beschreibung, Zutaten, Zubereitungsschritte, Bild und den von dir gewählten Namen. Kommentare, Fotos, Likes, Bewertungen und Follower-Zahlen sind für andere Nutzer sichtbar und mit Name und Zeitpunkt verknüpft. Geteilte Fotos liegen in einem öffentlich erreichbaren Dateispeicher, das heißt: Wer die Bildadresse kennt, kann das Bild aufrufen. Lade daher nur Bilder hoch, an denen du die Rechte hast und die du veröffentlichen möchtest. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO. Du kannst gemeldete Inhalte über die Melde-Funktion anzeigen lassen; wir prüfen Meldungen und können Inhalte entfernen oder Konten sperren.' },
    { h: '6. KI-Funktionen (AI Chef und Nährwert-Schätzung)', body: 'Bei KI-Rezepten und Nährwert-Schätzungen werden deine Eingaben (verfügbare Zutaten, Freitext-Wünsche, Ernährungspräferenzen und der Rezepttext) an OpenRouter (openrouter.ai) übermittelt und dort mit dem Modell openai/gpt-4o-mini verarbeitet. Bitte gib dort keine sensiblen Daten ein. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO; für die Übermittlung in die USA stützen wir uns auf die EU-Standardvertragsklauseln (Art. 46 DSGVO). KI-Ergebnisse sind automatisch erzeugt, können Fehler enthalten und sind keine Ernährungs- oder medizinische Beratung.' },
    { h: '7. Rezept-Übersetzungen', body: 'Übersetzungen erstellt die App zuerst offline auf dem Gerät. Nur wenn das nicht ausreicht, werden die Rezeptinhalte (Titel, Zutaten, Schritte – keine Kontodaten) an Übersetzungsdienste gesendet: Google Translate (Google Ireland Ltd. bzw. Google LLC) und MyMemory (Translated SRL, EU). Exakt dieser Text wird zusätzlich im Übersetzungs-Cache gespeichert, damit die Übersetzung nicht erneut angefordert werden muss.' },
    { h: '8. E-Mails (Bestätigungs- und Reset-Codes)', body: 'Wir versenden Konto-E-Mails über Google Mail (Gmail-SMTP) vom Absender spoonfulsender@gmail.com. Google verarbeitet dabei deine E-Mail-Adresse und den Versandinhalt als Auftragsverarbeiter. Die Nachricht enthält nur einen 8-stelligen Code, den Zweck und die Gültigkeitsdauer – keine weiteren personenbezogenen Daten.' },
    { h: '9. Hosting und Speicherort', body: 'Datenbank, Anmeldung und Dateispeicher laufen über Supabase in der Region eu-west-1 (Irland, Europäische Union). Die Übertragung erfolgt verschlüsselt (TLS), der Zugriff ist über Zugriffsregeln je Datensatz (Row Level Security) abgesichert, sodass du nur deine eigenen Daten siehst bzw. bearbeitest. Supabase handelt als Auftragsverarbeiter nach Art. 28 DSGVO.' },
    { h: '10. Lokale Speicher auf deinem Gerät', body: 'Auf dem Gerät speichert die App technisch notwendige Angaben: Anmeldung (Session-Token), Design-Auswahl, Sprache, Status der E-Mail-Bestätigung, Erinnerungs-Einstellungen, Nährwert-Zielwerte, Offline-Zwischenspeicher (Rezepte, Tracker, Einkaufsliste, ausstehende Änderungen), Bibliotheksfilter und den KI-Verlauf. Diese Daten verlassen dein Gerät nur, wenn du die jeweilige Funktion nutzt.' },
    { h: '11. Benachrichtigungen', body: 'Erinnerungen plant die App lokal auf deinem Gerät. Es werden keine Werbe-Push-Nachrichten versendet; die Benachrichtigungs-Berechtigung kannst du in den Android-Einstellungen jederzeit entziehen.' },
    { h: '12. Kein Tracking, keine Werbung', body: 'Die App enthält keine Analyse-, Werbe- oder Tracking-SDKs, keine Cookies und kein Fingerprinting. Wir verkaufen keine Daten und übermitteln sie nicht zu Werbezwecken. Öffentlich sichtbare Zähler (z. B. Likes oder Bewertungsdurchschnitt) sind aggregiert und nicht auf dich zurückführbar.' },
    { h: '13. Empfänger und Drittlandübermittlung', body: 'Empfänger deiner Daten sind: Supabase (Hosting, EU), Google (E-Mail-Versand, Übersetzung; Datenübermittlung in die USA auf Grundlage der EU-Standardvertragsklauseln), OpenRouter (KI-Funktionen; USA, Standardvertragsklauseln) und Translated SRL/MyMemory (Übersetzung, EU). Weitere Empfänger gibt es nur, wenn du Inhalte selbst teilst oder eine gesetzliche Pflicht besteht.' },
    { h: '14. Speicherdauer', body: 'Kontodaten und Inhalte bleiben gespeichert, bis du sie löschst oder dein Konto löschst. E-Mail-Codes sind eine Stunde gültig. Nach einer Kontolöschung können einzelne Datensätze für kurze Zeit in verschlüsselten Sicherungskopien des Hosters verbleiben; sie werden im Rahmen der regulären Rotation überschrieben und nicht mehr aktiv genutzt.' },
    { h: '15. Deine Rechte und Kontolöschung in der App', body: 'Du hast das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20), Widerspruch (Art. 21) sowie Widerruf erteilter Einwilligungen (Art. 7 Abs. 3). In der App findest du unter Einstellungen die Funktionen "Export my data" (vollständige Ausgabe deiner Daten als Datei) und "Delete my account" (endgültige Löschung von Konto und Inhalten). Für eine Beschwerde ist die Hessische Beauftragte für Datenschutz und Informationsfreiheit zuständig; selbstverständlich kannst du dich auch an uns wenden: spoonfulsupport@gmail.com.' },
    { h: '16. Mindestalter', body: 'Spoonful richtet sich an Personen ab 16 Jahren. Wir wenden uns nicht an Kinder und erheben wissentlich keine Daten von Kindern.' },
    { h: '17. Sicherheit und Änderungen dieser Erklärung', body: 'Wir sichern die Daten durch verschlüsselte Übertragung, gehashte Passwörter, zeitlich begrenzte Codes und datenbankseitige Zugriffsregeln. Ein Restrisiko bleibt bei jeder Internetnutzung bestehen; verwende daher ein eigenes, starkes Passwort. Wir passen diese Erklärung an, wenn sich Funktionen oder Dienste ändern; das Datum am Ende der Seite zeigt den aktuellen Stand.' },
  ],
  cookies: [
    { h: 'Keine Cookies', body: 'Spoonful ist eine App und keine Webseite: Wir setzen keine Cookies, kein Cookie-Banner und keine Cookie-IDs ein. Was im Hintergrund läuft, ist ein lokaler App-Speicher auf deinem Gerät, der deine Anmeldung und die von dir genutzten Funktionen ermöglicht.' },
    { h: 'Was auf deinem Gerät gespeichert wird', body: 'Anmeldung und Sitzung (Session-Token, bis zum Ausloggen bzw. Ablauf) · Design-Auswahl (dauerhaft) · Sprache (dauerhaft) · Status der E-Mail-Bestätigung (bis zur Bestätigung) · Erinnerungs-Einstellungen und Nährwert-Zielwerte (änderbar) · Offline-Zwischenspeicher für Rezepte, Tracker und Einkaufsliste inklusive noch nicht übertragener Änderungen (bis zum nächsten Abgleich) · Bibliotheksfilter und KI-Verlauf (bis zur Löschung).' },
    { h: 'Zweck', body: 'Diese Speicher sind technisch erforderlich, damit die App dich angemeldet hält, offline funktioniert und deine Einstellungen behält. Eine Einwilligung nach § 25 Abs. 1 TDDDG ist deshalb nicht nötig.' },
    { h: 'Kein Tracking', body: 'Es gibt keine Tracking-, Analyse- oder Werbe-Cookies und keine Werbe-Netzwerke von Drittanbietern. Wir bilden keine Nutzerprofile.' },
    { h: 'Externe Verbindungen', body: 'Nur wenn die jeweilige Funktion genutzt wird, verbindet sich die App mit externen Diensten: Supabase (Daten und Anmeldung, EU), Google (E-Mail-Versand, Übersetzung), MyMemory/Translated SRL (Übersetzung, EU), OpenRouter (KI-Funktionen) sowie Bildserver beim Laden externer Rezeptbilder. Dabei wird technisch bedingt deine IP-Adresse an den jeweiligen Anbieter übermittelt.' },
    { h: 'Löschen und Verwalten', body: 'Du kannst die Daten in den Android-Einstellungen unter Apps → Spoonful → Speicher löschen oder dein Konto in den App-Einstellungen über "Delete my account" endgültig entfernen. Danach sind Anmeldung und Einstellungen auf dem Gerät verschwunden.' },
  ],
  agb: [
    { h: '1. Geltungsbereich und Anbieter', body: 'Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für die Nutzung der App Spoonful, betrieben von Salem Ibrahim, Geiersberg 13, 35578 Wetzlar, Deutschland (nachfolgend "wir"). Vertragspartner wird, wer ein Konto anlegt oder die App nutzt. Abweichende Bedingungen erkennen wir nur an, wenn wir ihnen ausdrücklich zustimmen.' },
    { h: '2. Leistungsumfang', body: 'Spoonful bietet: Rezeptbibliothek mit Suche und Sortierung, eigene und gespeicherte Rezepte mit Sammlungen, KI-Rezeptgenerierung und Nährwert-Schätzung, Rezept-Übersetzungen, Community-Bereich (Teilen, Kommentare, Fotos, Likes, Bewertungen, Follower), Melde-Funktion für Inhalte, Kochmodus mit Timern, Kalorien- und Gewichts-Tracker mit Wochenauswertung, Einkaufsliste mit Sortierung und Teilen, Erinnerungen sowie Datenexport und Kontolöschung. Die Nutzung ist derzeit kostenlos. Wir behalten uns vor, künftig kostenpflichtige Funktionen einzuführen; diese kündigen wir vorher an, die bisher kostenlosen Kernfunktionen bleiben nach Möglichkeit erhalten.' },
    { h: '3. Registrierung, Konto und Mindestalter', body: 'Für die Nutzung ist ein Konto ab 16 Jahren erforderlich. Du verpflichtest dich zu wahrheitsgemäßen Angaben, zur Geheimhaltung deiner Zugangsdaten und dazu, dein Konto nicht an Dritte zu überlassen. Die E-Mail-Adresse bestätigst du mit einem 8-stelligen Code. Du bist für Aktivitäten über dein Konto verantwortlich. Bei Missbrauch, Täuschung oder Verstößen gegen diese AGB dürfen wir Konten sperren oder löschen.' },
    { h: '4. Nutzerinhalte und Rechteeinräumung', body: 'Du bleibst Inhaber aller Rechte an deinen Inhalten (Rezepte, Bilder, Kommentare, Bewertungen). Damit wir sie speichern, sichern, anzeigen und – nur bei von dir geteilten Inhalten – anderen Nutzern zugänglich machen können, räumst du uns ein einfaches, unentgeltliches, nicht ausschließliches und auf die Dauer der Nutzung begrenztes Nutzungsrecht ein. Geteilte Rezepte dürfen zur Anzeige in andere Sprachen übersetzt werden; dabei wird nur der Rezepttext an den Übersetzungsdienst übermittelt. Du sicherst zu, dass du die erforderlichen Rechte besitzt und keine Rechte Dritter (z. B. fremde Fotos) verletzt.' },
    { h: '5. Community-Regeln, Meldungen und Moderation', body: 'Untersagt sind rechtswidrige, beleidigende, diskriminierende, gewaltverherrlichende, irreführende oder werbliche Inhalte sowie das Hochladen fremder Bilder. Nutzer können Inhalte über die Melde-Funktion anzeigen; wir prüfen Meldungen und können Inhalte entfernen, ausblenden oder Konten sperren. Bei schweren oder wiederholten Verstößen behalten wir uns die endgültige Löschung des Kontos vor.' },
    { h: '6. KI-Inhalte und Nährwertangaben', body: 'Rezepte des AI Chef und Nährwert-Schätzungen werden automatisiert erstellt und können fehlerhaft oder unvollständig sein. Sie stellen keine medizinische, allergologische oder Ernährungsberatung dar. Prüfe Zutaten, Allergene, Mengen und Garzeiten stets selbst und beachte die Hinweise auf Lebensmittelverpackungen. Angaben zu Kalorien und Nährwerten sind Schätzwerte ohne Gewähr.' },
    { h: '7. Verfügbarkeit, Updates und Änderungen der App', body: 'Wir bemühen uns um eine hohe Verfügbarkeit, können sie aber nicht garantieren (Wartung, Störungen, Mobilfunknetz, Dienste Dritter). Die App wird regelmäßig aktualisiert. Ältere Versionen können Funktionen verlieren; bitte halte die App aktuell. Funktionen können entfallen oder sich ändern, wenn dies technisch oder rechtlich erforderlich ist.' },
    { h: '8. Haftung', body: 'Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei Verletzung von Leben, Körper oder Gesundheit sowie bei übernommenen Garantien. Bei einfacher Fahrlässigkeit haften wir nur für die Verletzung wesentlicher Vertragspflichten und begrenzt auf den vorhersehbaren, vertragstypischen Schaden. Für Inhalte, die Nutzer eingestellt haben, haften wir als Diensteanbieter nicht; sobald wir von einem klaren Rechtsverstoß Kenntnis erhalten, entfernen wir den Inhalt unverzüglich.' },
    { h: '9. Laufzeit, Kündigung und Kontolöschung', body: 'Du kannst dein Konto jederzeit in der App unter Einstellungen → "Delete my account" löschen; damit endet die Nutzung. Wir können den Nutzungsvertrag bei Verstößen gegen diese AGB oder bei Missbrauch mit sofortiger Wirkung kündigen. Nach der Löschung ist eine Wiederherstellung deiner Daten nicht möglich – nutze vorher bei Bedarf "Export my data".' },
    { h: '10. Änderungen dieser AGB', body: 'Wir passen diese AGB an, wenn sich Funktionen, Dienste oder Rechtslage ändern. Änderungen kündigen wir in der App mit angemessener Frist an. Wenn du nicht zustimmst, kannst du die Nutzung beenden und dein Konto löschen; deine gesetzlichen Rechte bleiben unberührt.' },
    { h: '11. Schlussbestimmungen', body: 'Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts; zwingende Verbraucherschutzvorschriften deines Aufenthaltsstaats bleiben unberührt. Sollte eine Bestimmung unwirksam sein, bleibt der übrige Vertrag wirksam. Anbieter und Verbraucher sind nicht verpflichtet, an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen. Fragen zu diesen AGB: spoonfulsupport@gmail.com.' },
  ],
};

export function LegalScreen({ route }: any) {
  const initial: LegalPageId = route?.params?.page ?? 'impressum';
  const [active, setActive] = React.useState<LegalPageId>(initial);
  const sections = SECTIONS[active];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => goBack()} style={{ width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }}>
          <ArrowLeft size={19} color={colors.textPrimary} />
        </Pressable>
        <Text style={{ fontFamily: fonts.display, fontSize: 20, fontWeight: '700', color: colors.textPrimary, flex: 1 }}>Spoonful · Legal</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 10 }}>
        {LEGAL_PAGES.map((p) => (
          <Pressable key={p.page} onPress={() => setActive(p.page)} style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: active === p.page ? colors.darkButton : colors.card, borderWidth: 1, borderColor: colors.cardBorder }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: active === p.page ? readableText(colors.darkButton) : colors.textPrimary }}>{p.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        <GlassCard pad={20} radius={24}>
          <Text style={{ fontFamily: fonts.display, fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginBottom: 12 }}>
            {LEGAL_PAGES.find((p) => p.page === active)?.label}
          </Text>
          {sections.map((s, i) => (
            <View key={i} style={{ marginTop: 14 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: colors.textPrimary }}>{s.h}</Text>
              <Text style={{ fontSize: 14, lineHeight: 22, color: colors.textSecondary, marginTop: 4 }}>{s.body}</Text>
            </View>
          ))}
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 20 }}>
            Stand: September 2026 · gilt für App-Version 2.0.0
          </Text>
        </GlassCard>
      </ScrollView>
    </View>
  );
}
