es gibt diese probleme ⚠️ 1. Das Impressum
Fehlende Telefonnummer: Für Online-Händler und Anbieter von Apps ist die Angabe einer Telefonnummer gesetzlich vorgeschrieben, damit eine "schnelle elektronische Kontaktaufnahme und unmittelbare Kommunikation" möglich ist. Deine E-Mail-Adresse allein reicht dafür nicht aus.

Umsatzsteuer-ID: Du schreibst, die App sei kostenlos. Sobald du aber Geld verdienen willst (auch wenn es später ist), musst du eine Umsatzsteuer-Identifikationsnummer (USt-ID) angeben, sobald dir eine zugeteilt wurde. Ein einfacher Hinweis, dass du Kleinunternehmer bist, reicht im Impressum nicht aus.

EU-Streitbeilegung: Der Hinweis auf die EU-Plattform zur Online-Streitbeilegung (OS-Plattform) ist seit dem 20. Juli 2025 nicht mehr verpflichtend, da die Plattform eingestellt wurde. Ein noch vorhandener Link ins Leere wäre sogar irreführend und könnte abgemahnt werden.

⚠️ 2. Die Datenschutzerklärung
Gesundheitsbezogene Daten (Art. 9 DSGVO): Du verarbeitest Kalorien, Gewicht und Ernährungsziele. Das sind besonders sensible Gesundheitsdaten. Dafür brauchst du eine ausdrückliche Einwilligung der Nutzer. Deine aktuelle Formulierung "Rechtsgrundlage ist deine ausdrückliche Einwilligung" ist zwar ein Anfang, aber die Einwilligung muss vor der Datenerhebung aktiv eingeholt werden (z. B. durch eine Checkbox) und nicht nur in den AGB erwähnt werden.

KI-Funktionen und Drittanbieter: Du schreibst, dass Daten an OpenRouter (KI) und Google (Übersetzung) in die USA übermittelt werden. Das ist ein Drittlandtransfer und muss datenschutzkonform abgesichert sein (z. B. durch EU-Standardvertragsklauseln). Deine Erklärung erwähnt das zwar, aber die Rechtsgrundlage dafür muss korrekt sein. Bei der Nutzung von KI-Funktionen ist die Einwilligung des Nutzers erforderlich.

Löschkonzept: Du schreibst, dass Daten nach der Kontolöschung "für kurze Zeit in verschlüsselten Sicherungskopien des Hosters verbleiben". Das ist eine sehr vage Formulierung. Ein nachvollziehbares und konkretes Löschkonzept ist zwingend erforderlich. Nutzer müssen genau wissen, was mit ihren Daten passiert.

Mindestalter: Die DSGVO schreibt vor, dass Kinder und Jugendliche erst ab 16 Jahren wirksam in die Verarbeitung ihrer Daten einwilligen können. Deine AGB sagen zwar, die App sei ab 16, aber du solltest in der Datenschutzerklärung klarstellen, dass du wissentlich keine Daten von Kindern unter 16 Jahren erhebst.

⚠️ 3. Die AGB
Haftungsausschluss: Deine Klausel zur Haftung ist so nicht wirksam. Du schreibst: "Bei einfacher Fahrlässigkeit haften wir nur für die Verletzung wesentlicher Vertragspflichten". Das ist zwar im Ansatz richtig, aber die Klausel ist insgesamt unwirksam, wenn sie nicht klar und verständlich formuliert ist. Gerichte haben solche pauschalen Haftungsbeschränkungen in App-AGB schon oft für unwirksam erklärt.

Änderungen der AGB: Deine Klausel, dass du die AGB jederzeit ändern kannst, ist unwirksam. Der Bundesgerichtshof hat entschieden, dass ein uneingeschränktes Änderungsrecht den Vertragspartner unangemessen benachteiligt. Du musst genau definieren, wann und warum du Änderungen vornehmen darfst.

⚠️ 4. Das Mindestalter und die Verantwortlichkeit
Nutzung ab 16: Deine AGB sagen, die App sei für Personen ab 16 Jahren. Das ist grundsätzlich in Ordnung. Aber: Du selbst bist 15. Das bedeutet, dass du die App nicht selbst betreiben darfst. Wenn deine Schwester die App veröffentlicht, ist sie die rechtlich Verantwortliche. Sie muss sicherstellen, dass die App und alle Rechtstexte den gesetzlichen Anforderungen entsprechen. Sie trägt das volle Risiko für Abmahnungen und Klagen. die app ist ab 13 und meinen nummer ist +49 179 439 46 42 und für die checkboxes die sind einfach bei der regerstrirung als letzter slide bevor das onboarding desing bleibt jede theme sein eigenes das mit geld kannst du weglassen die app ist gerade komplett kostenlos

---

## Umgesetzt in 3.4.1 (App-Rechtstexte in `mobile/src/screens/LegalScreen.tsx`)

- **Impressum / Kontakt:** Telefon **+49 179 439 46 42** ergänzt (schnelle elektronische Kontaktaufnahme).
- **Mindestalter auf 13 geändert** (Datenschutz Ziff. 16 und AGB Ziff. 3). Bei unter 16 Jahren wird auf die Zustimmung der Erziehungsberechtigten hingewiesen; unter 13 erheben wir wissentlich keine Daten.
- **Einwilligungen als Checkboxen bei der Registrierung** (letzter Schritt vor dem Anlegen): Alter ab 13, Datenschutz/AGB akzeptiert, ausdrückliche Einwilligung in Gesundheitsdaten. Ohne alle drei kein Konto. Zeitstempel werden im Nutzerprofil gespeichert.
- **Gesundheitsdaten (Art. 9 DSGVO):** Einwilligung wird jetzt vor der Erhebung eingeholt (Checkbox) und in Ziff. 4 der Datenschutzerklärung benannt.
- **KI-Drittlandübermittlung:** Ziff. 6 klarstellt, dass die Nutzung freiwillig ist und mit dem Absenden eingewilligt wird (EU-Standardvertragsklauseln bleiben genannt).
- **Löschkonzept konkretisiert (Ziff. 14):** was sofort gelöscht wird und dass verschlüsselte Backups spätestens nach 30 Tagen überschrieben werden; keine Wiederherstellung möglich.
- **AGB-Änderungsklausel (Ziff. 10) neu gefasst:** nur bei sachlichem Grund, Ankündigung mit mindestens sechs Wochen Frist inkl. Grund, Widerspruchs-/Kündigungsrecht.
- **EU-Streitbeilegung:** kein Link mehr (Plattform seit 20.07.2025 eingestellt) - bereits so umgesetzt.
- **Umsatzsteuer:** bewusst keine USt-ID, da die App vollständig kostenlos ist.

Hinweis: Das ist keine Rechtsberatung. Da der Betreiber noch minderjährig sein kann, sollte die Veröffentlichung durch die erziehungsberechtigte Person erfolgen.