# Plan: Demo "Abholstatus und Abholslot"

## 1. Architektur

| Teil | Technik | Begründung |
|---|---|---|
| Monorepo | npm workspaces (`packages/*`, `apps/*`), TypeScript überall | Vorgabe; keine zusätzlichen Tools wie pnpm oder turbo nötig |
| `packages/shared` | reine Typen und Konstanten (`@abholdemo/shared`) | "gemeinsame Typen" des Vertrags; Statusnamen, Labels, Kosten, Zustimmungstext nur an einer Stelle |
| `packages/api` | Node 22, Fastify, `tsx` zum Starten, Vitest | Fastify hat `inject()` für Tests ohne Zusatzpaket, Body Limit für Fotos einstellbar |
| Datenhaltung | eine JSON Datei `packages/api/data/db.json`, Fotos als Dateien in `packages/api/data/photos/` | Vorgabe "SQLite oder Datei". Eine Datei braucht keine native Kompilierung (better-sqlite3) und kein experimentelles `node:sqlite`. Für eine Demo mit ca. 10 Aufträgen ausreichend. Schreiben atomar (tmp Datei + rename). |
| `apps/betrieb` | Vite + React + TypeScript, eigenes Manifest + kleiner Service Worker | PWA ohne Zusatzplugin; Tablet zuerst |
| `apps/kunde` | Vite + React + TypeScript, keine Cookies, kein localStorage | gleiche Werkzeuge wie Betriebs App; kleines Bundle, nur 2 Seiten |
| Routing | kein Router Paket, eigene kleine History Lösung | wenige Seiten, keine neue Abhängigkeit |
| QR Code | npm Paket `qrcode` (nur in `apps/betrieb`) | QR Erzeugung offline; begründete Abhängigkeit |
| Start | `concurrently` im Root | `npm run dev` startet alle drei Prozesse zusammen |

Ports: API 4000, Betriebs App 5173, Kundenwebsite 5174. Beide Vite Server leiten `/api` an 4000 weiter. Kein Netzwerkzugriff nach außen, keine Fonts oder Skripte von CDNs.

## 2. Vertrag

Siehe `docs/CONTRACT.md` und `packages/shared/src/index.ts`. Nur der Orchestrator ändert den Vertrag.

## 3. Bildschirme

### Betriebs App (`apps/betrieb`, Login nötig)

1. Login (zwei Demozugänge als Hinweis sichtbar)
2. Auftragsliste: Filter Alle, Offen, Abholbereit, Überfällig, Heute abgeholt; Suche nach Nummer oder Name; Status, Alter in Tagen; großer Knopf "Neuer Auftrag"
3. Neuer Auftrag: Gegenstand (Freitext + Schnellauswahl), aufklappbar "Mehr Angaben" (Foto, Name, Mail, Handy, geplantes Abholdatum, voraussichtliche Fertigstellung); Speichern
4. Auftrag gespeichert: Auftragsnummer sehr groß, Knopf "Nächster Auftrag"
5. Auftragsdetail: Status, großer Knopf "Abholbereit", weitere Knöpfe In Arbeit, Abgeholt, Storniert, Foto, Kontakt, Benachrichtigung und Zustimmungsprotokoll, Slot, Statusprotokoll
6. Kalender: Tageskalender mit Zeitachse (reicht von der ersten Öffnung bis zur letzten Schließung, Pausen werden nicht eingezeichnet). Abholungen als Balken mit Auftragsnummer, parallele Abholungen im selben Slot nebeneinander (Kalender wird breiter, seitlich scrollbar). Oben "Voraussichtlich fertig" für Aufträge mit Fertigstellung an diesem Tag. Tag vor und zurück, Datum wählen, Balken antippen zeigt Details mit "Abgeholt" und "Zum Auftrag". Rote Linie für die Demo Uhrzeit.
7. Nachrichten: Liste der simulierten Nachrichten, Monatssumme, Zahl pro Auftrag, Demo Knopf "STOP Antwort simulieren"
8. Aufsteller: QR Code, Webname, A5 Druckvorlage, Knopf "Drucken"
9. Einstellungen (nur Inhaber)
10. Mitarbeiter (nur Inhaber)
11. Demo Werkzeuge (deutlich markiert): Zeit vorspulen um X Tage, Demodaten zurücksetzen, aktuelle Demozeit

### Kundenwebsite (`apps/kunde`, ohne Login)

1. `/` : kurzer Hinweis mit Link auf `/b/schuster-demo` (es gibt nur diesen Demobetrieb)
2. `/b/{webname}` : Name, Logo, großes Eingabefeld, Anleitung, Hinweis "Ohne Smartphone? Der Betrieb findet Ihren Auftrag auch über Ihren Namen."
3. `/b/{webname}/a/{code}` : Status, Abholzeit, voraussichtliche Fertigstellung, Abholfrist, "Sag mir Bescheid" oder Slot Auswahl mit Bestätigung, Ändern, Stornieren, Abbestellen, Datenschutzhinweis (Demo), Rückfall Hinweis
4. `/b/{webname}/a/{code}?abmelden=1` : wie 3, zusätzlich Bestätigungsfeld "Benachrichtigung abbestellen"
5. Unbekannter Betrieb: neutrale Meldung

## 4. Aufgabenteilung

| Agent | Model | Verzeichnis | Aufgabe |
|---|---|---|---|
| Orchestrator | Opus | `docs/`, `packages/shared`, Root Dateien | Plan, Vertrag, Verteilung, README |
| core | Sonnet | `packages/api` | Backend, Seed, Tests (Phase 2) |
| betrieb | Sonnet | `apps/betrieb` | Betriebs App (Phase 3) |
| kunde | Sonnet | `apps/kunde` | Kundenwebsite (Phase 3) |
| pruefer | Opus | nur lesen und starten, schreibt `docs/REVIEW.md` | Prüfung (Phase 4 und nach jeder Korrekturrunde) |

## 5. Annahmen und Entscheidungen

1. **R3 Webname:** Die Kundenadressen laufen über `/b/{webname}` auf der Kundenwebsite (Port 5174). Die Betriebs App liegt getrennt auf Port 5173; nach dem Login ist der Betrieb über den Benutzer bestimmt. Die Betriebsseite für Kunden ist `/b/schuster-demo`.
2. **R25 und R28 "genau eine Nachricht":** Es gibt genau eine Nachricht "Abholbereit" pro Auftrag. R28 verlangt zusätzlich eine Erinnerung nach Fristablauf; diese wird höchstens einmal pro Auftrag erzeugt. Der Statuslink bei Annahme (R27) ist keine Benachrichtigung im Sinne von R25, er geht nur an eine vom Betrieb erfasste Mail. Der Zustimmungstext nennt die mögliche Erinnerung ausdrücklich.
3. **R26 Kanal:** Der Kunde wählt den Kanal im Formular "Sag mir Bescheid". Mail ist vorausgewählt und als kostenlos empfohlen (Einstellung "Standardkanal" bestimmt die Vorauswahl). Die Nachricht geht immer an den Kanal, den der Kunde gewählt hat. Eine bei der Annahme erfasste Mail ist keine Anmeldung zur Abholbereit Nachricht (R25: nur Kunden mit Eintrag).
4. **R11 Gerät:** Gerät = IP Adresse des Clients. Kein Cookie und kein Fingerprinting (R12). In der lokalen Demo teilen sich alle Browser auf demselben Rechner eine IP.
5. **R10 Antwortzeit:** Jede öffentliche Abfrage einer Auftragsnummer dauert mindestens 300 ms, gefunden oder nicht. Falsche, unbekannte und falsch formatierte Nummern liefern denselben Text.
6. **R15 Filter:** "Offen" = Angenommen und In Arbeit. Zusätzlich gibt es "Alle" als Startfilter.
7. **R17 Statuswechsel:** Übergänge siehe Vertrag. Abgeholt und Storniert sind endgültig. Ein Rückschritt von Abholbereit nach In Arbeit ist nicht vorgesehen (sonst würde die eine Nachricht falsch). Überfällig setzt nur das System.
8. **R17 Slot freigeben:** Bei Abgeholt wird die Buchung als freigegeben markiert. Die Kapazität ist wieder frei, die Buchung bleibt in der Tagesliste mit "Erschienen" sichtbar (R19).
9. **R19 Erschienen:** Erschienen = Auftrag abgeholt. Ist das Slotende vorbei und der Auftrag nicht abgeholt, steht "Noch nicht erschienen".
10. **R32 Slots:** 7 Kalendertage ab heute (Demozeit), nur Slots in der Zukunft. Ein Slot pro Auftrag; Ändern ersetzt die Buchung. Kapazität zählt nur aktive Buchungen. Slots gibt es auch bei Überfällig.
11. **R31 Widerruf:** per Link (`?abmelden=1` in der Mail, Knopf auf der Statusseite) oder STOP Antwort. Die STOP Antwort wird in der Nachrichtenübersicht über einen Demo Knopf simuliert. Beides wird im Zustimmungsprotokoll des Auftrags festgehalten.
12. **R31 Eintragen:** nur in Angenommen oder In Arbeit. Bei Abholbereit sieht der Kunde direkt die Slot Auswahl (R33).
13. **R20 Öffnungszeiten:** bis zu zwei Zeitfenster je Wochentag (Mittagspause), leer = geschlossen. Slotlänge 15, 30, 45 oder 60 Minuten. Kapazität 1 bis 10. Logo als Bild Datei, im Browser verkleinert, als Data URL gespeichert.
14. **R18 Foto:** Im Browser auf höchstens 1024 px verkleinert, im Backend als Datei unter `packages/api/data/photos/` gespeichert, nur über die Betriebs API abrufbar.
15. **R23 Zeit vorspulen:** Das Backend hat eine Demouhr (Versatz in Tagen). Alle Regeln nutzen diese Uhr. Zurücksetzen stellt Seed und Versatz 0 wieder her.
16. **R13 Login:** Benutzername und Passwort, Token im `localStorage` der Betriebs App (nicht auf der Kundenseite). Passwörter mit `scrypt` gehasht.
17. **Zeitzone:** Server und Browser laufen auf demselben Rechner; Slots werden in der lokalen Zeitzone des Servers erzeugt, die Oberflächen zeigen lokale Zeit mit `Intl` und `de-DE`.
18. **R40 Gedankenstriche:** keine Zeichen "–" oder "—" und kein " - " als Gedankenstrich in sichtbaren Texten. Zeitspannen als "10:00 bis 10:15".
19. **R5:** Kein Code, kein Text und keine Datenstruktur zu Bezahlung, Preisen für Kunden, Kasse oder Rechnungen. Die Nachrichtenkosten (R22) sind Kosten des Betriebs für den Versand und werden als "Kosten" bezeichnet.
20. **PWA:** Manifest mit SVG Icon, Service Worker nur für die App Hülle (network first), nie für `/api`.
21. **Seed:** feste Codes, damit README und Prüfung reproduzierbar sind. Neue Aufträge bekommen Zufallscodes.

## 6. Prüfmatrix

| R | Kurz | Agent | Nachweis |
|---|---|---|---|
| R1 | zwei Oberflächen, PWA, ein Backend | betrieb, kunde | Start beider Apps, Manifest + Service Worker prüfen, Screenshots Tablet und Handy |
| R2 | Deutsch, einfache Sprache; Code Englisch | alle | manuelle Durchsicht, grep |
| R3 | Adressen über `/b/{webname}` | kunde, core | Aufruf `/b/schuster-demo`, Links in Nachrichten |
| R4 | Seed | core | Test + Auftragsliste |
| R5 | keine Zahlung | alle | grep nach bezahl, zahlung, payment, kasse, rechnung, price |
| R6 | Statusmodell | core | Test |
| R7 | Protokoll | core, betrieb | Test + Screenshot Auftragsdetail |
| R8 | Zufallscode | core | Test |
| R9 | keine PII öffentlich | core, kunde | Test + Screenshot Statusseite |
| R10 | neutrale Meldung, gleiche Zeit | core, kunde | Test + Ablauf |
| R11 | Fehlversuche | core, kunde | Test + Ablauf (11 Fehlversuche) |
| R12 | keine Cookies, kein Tracking | kunde | DevTools / `document.cookie`, Netzwerkliste |
| R13 | Login, Rollen | core, betrieb | Test + Ablauf mit beiden Zugängen |
| R14 | Auftrag in unter 20 s | betrieb | Ablauf mit Stoppuhr, Screenshot große Nummer |
| R15 | Liste, Filter, Suche | core, betrieb | Test + Screenshot |
| R16 | Knopf Abholbereit | core, betrieb | Ablauf + Nachricht in Übersicht |
| R17 | Statuswechsel ein Tipp, Slot frei | core, betrieb | Test + Ablauf |
| R18 | Foto nur Betrieb | core, betrieb | Test (öffentliche Antwort ohne Foto) + Screenshot |
| R19 | Tagesliste | core, betrieb | Screenshot |
| R20 | Einstellungen | core, betrieb | Ablauf + Vorschau |
| R21 | Aufsteller A5 | betrieb | Screenshot Druckansicht |
| R22 | Nachrichtenübersicht mit Kosten | core, betrieb | Test Kosten + Screenshot |
| R23 | Demo Werkzeuge | core, betrieb | Ablauf vorspulen + zurücksetzen |
| R24 | Mitarbeiterverwaltung | core, betrieb | Ablauf anlegen, deaktivieren, Login schlägt fehl |
| R25 | eine Nachricht Abholbereit | core | Test |
| R26 | Kanal, nichts versendet | core | Test + Codeprüfung (kein Versand) |
| R27 | Statuslink bei Mail | core | Test |
| R28 | Erinnerung + Überfällig | core, betrieb | Test + Ablauf vorspulen |
| R29 | Startseite | kunde | Screenshot + Eingabe " h7rt 3k " |
| R30 | Statusseite | kunde | Screenshot |
| R31 | Sag mir Bescheid, Zustimmung, Widerruf | core, kunde | Test + Ablauf |
| R32 | Slots buchen, ändern, stornieren | core, kunde | Test + Ablauf |
| R33 | Slots ohne Eintrag | kunde | Ablauf mit D3FY6W |
| R34 | Barrierearm | kunde | Tastaturablauf, Kontrast, Größe, Bundlegröße |
| R35 | Datenschutzhinweis Demo | kunde | Screenshot |
| R36 | Rückfall Name | kunde, betrieb | Screenshot + Suche nach Name |
| R37 | Backend Tests | core | `npm test` |
| R38 | Start ohne Fehler | alle | `npm run dev`, Konsole ohne Fehler |
| R39 | Demoablauf | alle | kompletter Ablauf nach README |
| R40 | keine Gedankenstriche, kein Lorem | alle | grep nach "–", "—", " - ", "lorem" in sichtbaren Texten |

## 7. Verlauf

* Phase 1: Plan, Vertrag, gemeinsame Typen geschrieben.
* Phase 2: Agent core (Sonnet) hat `packages/api` gebaut, 63 Tests grün, Typecheck sauber (vom Orchestrator nachgeprüft).
* Vertragsänderung nach Rückmeldung von core: `ErrorCode` um `INTERNAL` (500) ergänzt; `PublicSlot.free` darf beim eigenen gebuchten Slot 0 sein.
* Entscheidung: Nachrichtenvorlage muss `{link}` enthalten (Validierung in den Einstellungen), sonst fehlt der Slot Link (R25).
* Phase 3: Agents betrieb und kunde (Sonnet) haben die Oberflächen gebaut; Build und Typecheck grün.
* Phase 4: Prüfagent (Opus) Runde 1: 36 erfüllt, 4 teilweise (R1, R11, R14, R30), 0 offen. Mängel M1 bis M8 in `docs/REVIEW.md`.
* Vertragsänderung nach M3: Geräteschlüssel nimmt den letzten `X-Forwarded-For` Eintrag (vom eigenen Proxy angehängt), nicht den ersten (vom Client fälschbar).
* Korrekturrunde 1: M3, M7 an core; M1, M2, M8 an betrieb; M4, M5, M6 an kunde.
* Korrekturrunde 1 erledigt (core: 65 Tests grün; betrieb, kunde: Build grün). Prüfagent Runde 2 gestartet.
* Prüfagent Runde 2: 40 erfüllt, 0 teilweise, 0 offen. Offen: M5 (Text bei Abholbereit, niedrig), M9 (niedrig).
* Entscheidung M9: Ein Programm auf demselben Rechner kann die Fehlversuchssperre umgehen, indem es direkt an 127.0.0.1:4000 einen wechselnden `X-Forwarded-For` Kopf schickt. Die API lauscht nur auf 127.0.0.1; von außen ist das nicht erreichbar. Für die lokale Demo als bekannte Grenze dokumentiert (README), kein Code geändert. In einem echten Betrieb würde nur der eigene Reverse Proxy die Client Adresse setzen.
* Korrekturrunde 2: M5 an kunde.
* Prüfagent Runde 3 (Abschluss): 40 erfüllt, 0 teilweise, 0 offen; M5 behoben, M9 als dokumentierte Grenze akzeptiert.

## 8. Änderung: Generische Plattform für Fahrrad und Auto Werkstätten (2026-11-17)

Neue Vorgabe des Auftraggebers, ersetzt den Schuhmacher Bezug aus dem Ursprungsprompt (R4 Seed, R14 Schnellauswahl):

* **Schnellauswahl pro Betrieb:** Die fest eingebauten Schuhmacher Kategorien sind entfernt. Der Betrieb legt seine Schnellauswahl selbst an (Einstellungen, nur Inhaber), am Anfang ist sie leer. Neue Aufträge zeigen sie als Knöpfe; ohne Einträge steht ein Hinweis. Der Vertrag hat dafür `BusinessSettings.quickCategories` und `BusinessInfo.quickCategories`.
* **Seed neutral:** Betrieb "Werkstatt Demo" (Webname `werkstatt-demo`), Seed Aufträge als Mischung aus Fahrrad und Auto, ohne Kategorien. Mitarbeiter heißt Tom Werner. Alte Daten bleiben beim Start erhalten (die Schnellauswahl wird als leer ergänzt); für den neuen Seed einmal "Demodaten zurücksetzen".
* **Design:** Blau und Weiß statt Grün, Schrift: ursprüngliche Systemschrift. Nur der Betriebsname (Kopfleiste, Kundenseiten, Aufsteller) ist in Futura (Ausweichschriften Century Gothic, Avenir Next, Trebuchet MS, weil Futura nicht auf jedem Gerät vorhanden ist). Cambria wurde ausprobiert und wieder entfernt. Akzent: typisches Tech Blau (#2563eb). Statusfarben bleiben nach Bedeutung (Abholbereit grün, Überfällig orange).
* **Unverändert:** Der Text "Nummer vom Anhänger eingeben" auf dem Aufsteller (R21) bleibt, weil er im Ursprungsprompt so steht.

## 9. Änderung: Seite "Heute" wird "Kalender" (2026-11-17)

* Menüpunkt und Route heißen jetzt Kalender (`#/kalender`). Der Endpunkt `GET /api/betrieb/day-slots` liefert zusätzlich `completions` (Aufträge mit voraussichtlicher Fertigstellung an diesem Datum, ohne Stornierte, nach Nummer sortiert) und `openingHours` (Öffnungszeiten des Wochentags für die Zeitachse).
* Fertigstellung ist nur ein Datum ohne Uhrzeit und steht deshalb als Liste oberhalb der Zeitachse, nicht als Balken.
* Die Zeitachse zeigt die Öffnungszeiten, bei Abholungen außerhalb davon wird sie erweitert.

## 10. Abholzeiten richten sich zwingend nach den Öffnungszeiten (2026-11-17)

* Beim Buchen war das schon gewährleistet: nur vom Backend aus Öffnungszeiten und Slotlänge erzeugte Zeiten werden angenommen (alles andere ist `SLOT_INVALID`, auch Mittagspause, vor Öffnung, nach Schließung, Sonntag, krumme Minuten).
* Lücke geschlossen: Ändert der Inhaber Öffnungszeiten oder Slotlänge, werden zukünftige aktive Buchungen, die nicht mehr genau einem erzeugten Slot entsprechen, entfernt. Die Einstellungen melden die Zahl (`releasedBookings`) und zeigen sie dem Inhaber. Die betroffenen Kunden bekommen keine Nachricht (R25: nur eine Nachricht pro Auftrag), sie sehen beim nächsten Aufruf der Statusseite wieder die Slot Auswahl.
* Nicht geändert: Verringert der Inhaber nur die Kapazität pro Slot, bleiben bestehende Buchungen bestehen.

## 11. Telefonnummer ist Pflicht, Mitteilungen an den Kunden (2026-11-17)

Neue Vorgabe des Auftraggebers: Werkstätten müssen Reparaturen verschieben können, weil Teile bestellt werden müssen, und dem Kunden dann Bescheid sagen.

* **R14 geändert:** Pflichtteil beim neuen Auftrag sind jetzt zwei Angaben: Gegenstand und Telefonnummer. Alles andere bleibt optional ("Mehr Angaben"). Das Backend lehnt Aufträge ohne gültige Telefonnummer ab. Alle Seed Aufträge haben eine Nummer.
* **Mitteilung:** Im Auftrag (Abschnitt Benachrichtigung) gibt es ein Eingabefeld "Ihre Mitteilung". Die Mitteilung geht an den Kontakt der Annahme: per Mail, wenn eine Mailadresse erfasst wurde, sonst per SMS an die Telefonnummer. Die Oberfläche zeigt vorher Kanal und Empfänger. Nachrichtenart `MITTEILUNG`, erscheint in der Nachrichtenübersicht mit Kosten (Mail 0,00 Euro, SMS 0,075 Euro). Es wird nichts wirklich gesendet.
* **Verhältnis zu R25 (genau eine Nachricht pro Auftrag):** R25 gilt für die automatische Nachricht "Abholbereit" an Kunden, die sich auf der Kundenseite eingetragen haben. Die Mitteilung ist eine ausdrückliche, manuelle Handlung des Betriebs an den Kontakt, den der Kunde bei der Abgabe selbst genannt hat. Sie braucht keinen Eintrag auf der Kundenseite, zählt nicht zur einen Abholbereit Nachricht und kann mehrfach gesendet werden.
* **Grenzen:** keine Mitteilung bei Abgeholt und Storniert. Die Länge ist auf 500 Zeichen begrenzt. Kein WhatsApp Weg (nur Mail und SMS nach der Regel oben). Das Datum der voraussichtlichen Fertigstellung ändert sich nicht automatisch, der Betrieb kann es im Text nennen.
* **Datenschutz Hinweis für später:** Die Telefonnummer als Pflichtfeld und der Versand ohne Eintrag des Kunden brauchen in einem echten Betrieb einen passenden Hinweis bei der Annahme. In der Demo ist das nicht abgebildet.
