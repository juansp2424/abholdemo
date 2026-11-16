# Prüfbericht (Prüfagent, Opus)

Datum: 16.11.2026. Geprüft gegen `docs/ORIGINAL_PROMPT.md` (R1 bis R40), dazu `docs/PLAN.md`, `docs/CONTRACT.md`, `packages/shared/src/index.ts`, `README.md`. Es wurde kein Code geändert.

## Zusammenfassung

Stand nach Runde 2 (Nachprüfung nach Korrekturrunde 1, Details im Abschnitt "Runde 2" am Ende):

| Ergebnis | Runde 1 | Runde 2 |
|---|---|---|
| erfüllt | 36 | 40 |
| teilweise | 4 (R1, R11, R14, R30) | 0 |
| offen | 0 | 0 |

Offene Mängel nach Runde 2: M5 (teilweise behoben, niedrig) und neu M9 (niedrig). M1 bis M4 und M6 bis M8 sind behoben.

Bewertung aus Runde 1: Das Backend ist solide und gut getestet, der README Demoablauf läuft in beiden Oberflächen vollständig durch. Die wichtigsten Mängel: Die Betriebs App läuft bei Tablet Hochformat (768 px) horizontal über, dabei wird die große Auftragsnummer nach dem Speichern abgeschnitten (M1, M2). Die Fehlversuchssperre lässt sich über einen gefälschten `X-Forwarded-For` Header durch den Proxy der Kundenwebsite umgehen (M3).

### Wie geprüft

* Umgebung: macOS (Darwin 25.5), Node v22.13.1, npm 10.9.2, Vite 5.4.21, Vitest 2.1.9. Lokale Zeit beim Test: Montag 16.11.2026 kurz nach 00:00 (UTC minus 3).
* `npm install`: ok (npm meldet 6 Schwachstellen in Dev Werkzeugen vitest/vite/esbuild/tinypool, nur Entwicklungsabhängigkeiten).
* `npm test`: 8 Testdateien, **63 Tests grün** (4,5 s).
* `npm run typecheck`: api, betrieb, kunde ohne Fehler.
* `npm run build`: betrieb 205 kB JS (67 kB gzip), kunde 155 kB JS (50 kB gzip), ohne Fehler.
* `npm run dev` genau wie im README: api (127.0.0.1:4000), betrieb (5173), kunde (5174) starten ohne Fehler, Log sauber.
* Browser (eingebauter Browser): Betriebs App mit 768x1024 (Tablet) und 375x812, Kundenwebsite mit 375x812 (Handy). Screenshots und DOM Messungen siehe Nachweise.
* curl gegen `http://localhost:4000` und über den Proxy `http://localhost:5174/api` (neutrale 404, Zeitmessung, Sperre, Cookies, PII).
* greps über `apps/*/src`, `apps/*/index.html`, `apps/*/public`, `packages/*/src`, Tests, Seed.

## Ergebnis je Anforderung

Die Tabelle zeigt den Stand von Runde 1. Änderungen in Runde 2: R1, R11, R14 und R30 sind jetzt **erfüllt**, siehe "Runde 2". Alle übrigen Zeilen wurden in Runde 2 erneut mitgeprüft und bleiben erfüllt.

| R | Ergebnis | Nachweis | Mangel |
|---|---|---|---|
| R1 | teilweise (Runde 2: erfüllt) | Zwei getrennte Apps (5173, 5174), ein Backend (4000). `manifest.webmanifest` gültig, `sw.js` syntaktisch ok (network first, nie `/api`). Handy (375 px): Betriebs App mit unterer Tab Leiste, kein Überlauf. Kundenwebsite mobil zuerst, ohne Login. | Tablet zuerst ist verletzt: bei 768 px laufen Neuer Auftrag, Heute und Aufsteller horizontal über (M1, M2). Service Worker Registrierung schlug im Prüfbrowser fehl ("unknown error fetching the script"), `sw.js` wird mit 200 und `text/javascript` ausgeliefert; vermutlich Einschränkung der Prüfumgebung, nicht als Mangel gewertet. |
| R2 | erfüllt | Alle gesehenen Texte deutsch und einfach. Code und Kommentare englisch. | Kleinigkeiten in M6. |
| R3 | erfüllt | Kunde: `/b/schuster-demo`, `/b/schuster-demo/a/{code}`. Links in Nachrichten und QR über `statusUrl`/`businessUrl` aus shared. Annahme 1 (Betriebs App getrennt, Betrieb über Login) ist vernünftig. | |
| R4 | erfüllt | Seed: "Schuhmacher Demo", `schuster-demo`, Öffnungszeiten Mo bis Fr zwei Fenster, Sa vormittags; `inhaber` (Inhaber), `mitarbeiter` (Mitarbeiter); 10 Aufträge in allen Status, `RT8WMZ` überfällig, `7KP4QX` mit Slot. Test `seed.test.ts`. | Seed Slot von `Z5MA9H` liegt außerhalb der Öffnungszeiten (M7). |
| R5 | erfüllt | grep `bezahl|zahlung|payment|kasse|rechnung|invoice|price|preis|pay|billing|checkout` in allen Quellen, Tests, Vertrag, README: 0 Treffer. Keine Kundenkonten, kein Kalender, kein Marktplatz. | |
| R6 | erfüllt | `OrderStatus` und `STATUS_LABELS` in shared; Überfällig nur durch `sweepOverdue`. Tests `status.test.ts`. | |
| R7 | erfüllt | Statusprotokoll im Auftrag sichtbar ("16.11.2026, 00:05 Angenommen → Abholbereit von Maria Leisten"), System Einträge bei Überfällig. Test "applies valid transitions and logs time and actor". | |
| R8 | erfüllt | `CODE_ALPHABET` ohne 0, 1, O, I, L; `crypto.randomInt`; Kollisionsprüfung. Tests in `code.test.ts` (Format, Stichprobe, nicht fortlaufend, erzwungene Kollision). Neuer Auftrag bekam `BCF94S`. | |
| R9 | erfüllt | Öffentliche Antwort hat nur die Felder `canSubscribe, code, estimatedCompletion, notifyActive, notifyChannel, pickupDeadline, pickupDeadlineDays, plannedPickupDate, slot, slotBookingOpen, status, statusLabel, statusText` (alle 10 Seed Codes per curl abgefragt, grep nach Namen, Mail, Telefon, Gegenstand: 0). Kundenseite zeigt weder Name noch Gegenstand. Test "never leaks seed names ...". | |
| R10 | erfüllt | Unbekannt, falsches Format (`abc`, `0OI1L0`, `foo-bar`), knapp daneben (`7KP4QY`) und fremder Betrieb: alle 404, md5 aller Bodies identisch. Zeit gefunden 0,303 bis 0,305 s, nicht gefunden 0,303 bis 0,307 s. | |
| R11 | teilweise (Runde 2: erfüllt) | 10 Fehlversuche je Gerät: 1 bis 10 = 404, 11. = 429, danach auch gültige Nummer 429; anderes Gerät weiter 200. Tests in `public.test.ts`. | Umgehbar über gefälschten `X-Forwarded-For` durch den Kunden Proxy (M3). |
| R12 | erfüllt | `document.cookie` leer, `localStorage`/`sessionStorage` leer, nur Ressourcen von `localhost:5174`. Keine `Set-Cookie` Header (Seite, Proxy, öffentliche API, auch Login). Kein Tracking Code. `fetch` mit `credentials: "omit"`. | |
| R13 | erfüllt | Login mit beiden Demozugängen im Browser. Mitarbeiter sieht im Menü weder Einstellungen noch Mitarbeiter, API gibt 403 "Nur für Inhaber.". | Kleinigkeit M8. |
| R14 | teilweise (Runde 2: erfüllt) | Ablauf "Stiefel" + Schnellauswahl "Sohle erneuern" + Enter: 6,4 s, eine Pflichteingabe, Optionales hinter "Mehr Angaben". Nummer erscheint groß. | Bei 768 px wird die große Nummer abgeschnitten (nur "BCF94" sichtbar), M1. |
| R15 | erfüllt | Liste mit Status und "x Tage alt"; Filter Alle, Offen, Abholbereit, Überfällig, Heute abgeholt (API Ergebnisse geprüft); Suche "beispiel" findet 3 Namen, "h7r t3" findet `H7RT3K`; Hinweis zum Namen sichtbar. | |
| R16 | erfüllt | Großer Knopf "Abholbereit" im Auftrag; setzt Status, Slots auf Kundenseite sofort sichtbar, Nachricht in Übersicht erzeugt. | |
| R17 | erfüllt | Ein Tipp für In Arbeit und Abgeholt (Storniert mit Rückfrage). Abgeholt gibt die Kapazität frei: nach Abgeholt hat 09:00 wieder `free: 1`. Test "ABGEHOLT releases the capacity". | Abgeholt erst ab Abholbereit möglich, siehe Abweichungen. |
| R18 | erfüllt | Foto optional, im Browser verkleinert, Datei in `packages/api/data/photos/`, nur in `OrderDetail`. grep "photo" in `routes/public.ts`, `messages.ts`, `apps/kunde/src`: kein Treffer außer Kommentar. Test "stores a photo as a file and returns it only in the staff detail". | |
| R19 | erfüllt | Menü "Heute": Uhrzeit, Nummer, Status, "Erwartet"/"Erschienen"/"Noch nicht erschienen", Tag vor und zurück. | Knopf "Abgeholt" bei 768 px auf 48 px gequetscht (M2). |
| R20 | erfüllt | Einstellungen: Öffnungszeiten je Tag (zwei Fenster), Slotlänge 15/30/45/60, Kapazität, Abholfrist, Standardkanal, Nachrichtentext mit Live Vorschau, Name, Logo. Per API Kapazität 1 und 30 Minuten gespeichert: Slots 09:00, 09:30, ... mit `free: 1`. | |
| R21 | erfüllt | Aufsteller: QR (Ziel `http://localhost:5174/b/schuster-demo`), Webname als Text, A5 Vorlage mit Name, großem QR, drei Schritten im genauen Wortlaut, Knopf "Drucken" (`window.print`, `@page { size: A5 }`, Menü ausgeblendet). Druckdialog selbst nicht ausgelöst. | Überlauf bei 768 px (M2). |
| R22 | erfüllt | Nachrichten: Zeit, Kanal, maskierter Empfänger (`k***@beispiel.de`, `+49 *** ****34`), Text, Link, "Zugestellt (simuliert)", Kosten je Nachricht (0,00 €, 0,0456 €, 0,075 €), Monatssumme (0,1206 €), Zahl pro Auftrag. Test "computes costs per channel and the month total". | |
| R23 | erfüllt | Seite "Demo Werkzeuge" mit gelbem Demo Banner. "Zeit vorspulen" 3 Tage: "Neu überfällig: G8UE4R (1), Erinnerungen erstellt: 1". "Demodaten zurücksetzen" setzt Uhr auf Versatz 0 und Seed zurück. | |
| R24 | erfüllt | Per API und UI Code: Mitarbeiter angelegt (201), Login ok, deaktiviert, Login 401. Rollen Inhaber/Mitarbeiter wählbar; letzter Inhaber geschützt. | |
| R25 | erfüllt | Abholbereit Nachricht nur bei aktivem Eintrag, höchstens einmal (`readyMessageSent`), Text ohne Werbung, mit Slot Link. Test "creates the ABHOLBEREIT message only with an active subscription, and only once". Annahme 2 (Erinnerung und Statuslink zusätzlich) ist vernünftig, weil R27 und R28 diese ausdrücklich verlangen. | |
| R26 | erfüllt | Mail vorausgewählt und "Empfohlen", sonst SMS oder WhatsApp nach Wahl. Kein Versandcode, keine Netzwerkaufrufe nach außen (grep URLs: nur localhost). Annahme 3 vertretbar. | |
| R27 | erfüllt | Seed `H7RT3K` hat STATUSLINK Mail, 0,00 €. Test "sends the STATUSLINK on intake with an email, free of charge". | |
| R28 | erfüllt | Vorspulen erzeugt genau eine Erinnerung (nur mit Eintrag) und Status Überfällig. Test "creates the reminder via demo advance, once". | |
| R29 | erfüllt | Startseite: Name, (Logo falls gesetzt), großes Feld, Anleitung in drei Schritten. Eingabe " bcf 94s " führte auf `/a/BCF94S`. | |
| R30 | teilweise (Runde 2: erfüllt) | Statusseite: Status in einfacher Sprache, Abholzeit, voraussichtlich fertig ("Dienstag, 17. November" bei `Q9XB2M`), direkt aufrufbar und aus Nachrichtenlink. | Hinweis auf die Abholfrist erscheint erst ab Abholbereit, nicht bei Angenommen/In Arbeit (M4). |
| R31 | erfüllt | Mail/SMS/WhatsApp, Kontaktfeld, Kontrollkästchen nicht vorangekreuzt; ohne Haken Fehlermeldung "Bitte setzen Sie den Haken ...". Zeitstempel und Wortlaut im Zustimmungsprotokoll der Betriebs App sichtbar. Widerruf über `?abmelden=1` im Browser geprüft ("Erledigt ..."), STOP per Demo Knopf, beides protokolliert. | |
| R32 | erfüllt | Freie Slots der nächsten 7 Tage aus Öffnungszeiten, Länge, Kapazität. Buchen, "Andere Zeit wählen", "Abholzeit absagen", Bestätigung sichtbar. Kapazität: 09:00 mit 2 Buchungen fehlt für `D3FY6W`, direkter PUT gibt 409 SLOT_FULL; ungültige Zeit 400 SLOT_INVALID. Tests `booking.test.ts`. | |
| R33 | erfüllt | `D3FY6W` (ohne Eintrag, abholbereit) zeigt beim Aufruf direkt die Slot Auswahl. | |
| R34 | erfüllt | Grundschrift 18 px, Status 40 px, Tippflächen mindestens 48 bis 56 px, sichtbarer Fokusrahmen, Formular mit Enter bedienbar, Fehlermeldungen als `role="alert"` in Klartext, Kontrast dunkelblau auf weiß. Kunden Bundle 50 kB gzip, keine Webfonts. | |
| R35 | erfüllt | Abschnitt "Datenschutz (Demo)" mit Platzhaltertext, als Demo gekennzeichnet. | |
| R36 | erfüllt | Hinweis "Kein Smartphone oder Nummer verloren? ... findet Ihren Auftrag auch über Ihren Namen." auf Start und Statusseite; Namenssuche in der Betriebs App. | |
| R37 | erfüllt | Tests vorhanden und grün: Zufallscode (`code.test.ts`), Statusübergänge (`status.test.ts`), Slots nach Öffnungszeiten und Kapazität (`slots.test.ts`), keine Doppelbuchung (`booking.test.ts`), Fehlversuche (`public.test.ts` rate limit), keine PII (`public.test.ts`). | |
| R38 | erfüllt | Alle drei Prozesse starten mit `npm run dev` ohne Fehler; Konsole der Kundenseite nur mit dem erwarteten 400 des absichtlich fehlerhaften Formulars. | |
| R39 | erfüllt | README Ablauf Schritt 1 bis 8 vollständig im Browser ausgeführt, siehe Abschnitt "Demoablauf". | Darstellung bei Tablet Breite (M1, M2). |
| R40 | erfüllt | grep "–" und "—" in Quellen: 0 (nur im Vertrag als Regel). " - " nur in Rechenausdrücken im Code, nie in sichtbaren Texten. "lorem", "ipsum", TODO: 0. Seed Test "contains no dashes in German texts". | |

## Demoablauf nach README (R39)

| Schritt | Ergebnis |
|---|---|
| 1 Auftrag anlegen | ok, `BCF94S`, 6,4 s. Abweichung: bei Tablet Hochformat ist die große Nummer abgeschnitten und die Seite scrollt seitlich (M1). |
| 2 Kunde fragt Stand | ok, Eingabe klein mit Leerzeichen, Status "Angenommen", kein Name, kein Gegenstand. |
| 3 Kunde trägt sich ein | ok, ohne Haken verständliche Fehlermeldung, mit Haken "Nachricht eingerichtet". |
| 4 Betrieb setzt Abholbereit | ok. |
| 5 Nachricht erscheint | ok, Mail mit Link, `k***@beispiel.de`, 0,00 €, Monatssumme oben. |
| 6 Kunde bucht Slot | ok, nach Neuladen freie Zeiten, 09:00 gebucht, Bestätigung, Ändern und Absagen vorhanden. |
| 7 Betrieb sieht Slot, Abgeholt | ok, Zeile zeigt danach "Erschienen". Abweichung: Knopf "Abgeholt" bei 768 px abgeschnitten (M2). |
| 8 Bonus | ok, `G8UE4R` überfällig plus Erinnerung, Aufsteller mit QR, Zurücksetzen funktioniert. |

## Mängel

**M1 (hoch, apps/betrieb = agent betrieb): Große Auftragsnummer bei Tablet Hochformat abgeschnitten.**
Ort: `apps/betrieb/src/styles.css`, Regel `.huge-code` (`font-size: clamp(64px, 18vw, 140px); letter-spacing: .14em`) zusammen mit `.shell { grid-template-columns: var(--nav-w) 1fr }`.
Reproduzieren: Fenster 768x1024, als `inhaber` anmelden, Neuer Auftrag, "Stiefel", Speichern. Gemessen: Nummernfeld 643 px breit, Dokument 917 px bei 768 px Viewport; sichtbar ist nur "BCF94", der letzte Buchstabe und der Knopf "Abmelden" liegen außerhalb.
Erwartet: Die ganze Nummer ist ohne seitliches Scrollen lesbar, bei 768 px und bei 1024 px. Schriftgröße an der verfügbaren Breite ausrichten (zum Beispiel `clamp(48px, 11vw, 140px)` oder Container Query), und die Grid Spalte auf `minmax(0, 1fr)` setzen (siehe M2).

**M2 (mittel, apps/betrieb = agent betrieb): Seitlicher Überlauf bei 768 px auf Heute und Aufsteller.**
Ort: `apps/betrieb/src/styles.css`: `.shell` (Spalte `1fr` ohne `minmax(0, …)`, dadurch wächst das Grid mit breitem Inhalt), `.slot-row { grid-template-columns: 150px auto auto 1fr auto }` (Mediaquery greift erst unter 640 px), `.poster { width: 148mm }`.
Reproduzieren: 768x1024, Menü "Heute": Dokument 796 px breit, Knopf "Abgeholt" nur 48 px breit, Text abgeschnitten ("bgeho"). Menü "Aufsteller": Dokument 799 px, Knopf "Drucken" angeschnitten.
Erwartet: Keine seitliche Scrollbar bei 768 px. `.shell` mit `grid-template-columns: var(--nav-w) minmax(0, 1fr)`, `.slot-row` bis etwa 900 px umbrechen lassen oder Knopf `min-width` geben, Vorlage auf dem Bildschirm mit `max-width: 100%` skalieren (Druckmaß 148 mm nur in `@media print`).

**M3 (mittel, packages/api = agent core): Fehlversuchssperre über gefälschten X-Forwarded-For umgehbar.**
Ort: `packages/api/src/routes/public.ts`, `clientKey()`: nimmt den ersten Eintrag von `X-Forwarded-For`. Der Vite Proxy (`apps/kunde/vite.config.ts`, `xfwd: true`) hängt die echte Adresse hinten an, ein vom Client gesendeter Header bleibt vorne.
Reproduzieren: `for i in $(seq 1 12); do curl -s -o /dev/null -w "%{http_code} " -H "X-Forwarded-For: 203.0.113.$i" http://localhost:5174/api/public/b/schuster-demo/orders/BAD$i; done` ergibt 12 mal 404, nie 429; ohne Header kommt nach 10 Fehlern 429.
Erwartet: Ein Client kann seinen Geräteschlüssel nicht selbst wählen. Den letzten (vom vertrauten Proxy angehängten) Eintrag verwenden, oder im Proxy den Header überschreiben statt anhängen. Test ergänzen: Anfrage mit gefälschtem ersten Eintrag zählt auf die echte Adresse. Vertrag Abschnitt 5 entsprechend anpassen (Orchestrator).

**M4 (niedrig, apps/kunde = agent kunde): Hinweis auf die Abholfrist fehlt vor Abholbereit.**
Ort: `apps/kunde/src/pages/StatusPage.tsx`, `showDeadline = order.slotBookingOpen || order.pickupDeadline !== null`.
Reproduzieren: `/b/schuster-demo/a/H7RT3K` (Angenommen): kein Satz zur Abholfrist.
Erwartet (R30): Die Statusseite nennt die Abholfrist des Betriebs immer, zum Beispiel "Nach Fertigstellung haben Sie 14 Tage Zeit zum Abholen." vor Abholbereit, mit Datum ab Abholbereit.

**M5 (niedrig, apps/kunde = agent kunde): "Nachricht eingerichtet" bei abgeschlossenen Aufträgen.**
Ort: `apps/kunde/src/pages/StatusPage.tsx`, Block `order.notifyActive && (...)`.
Reproduzieren: Auftrag mit Eintrag auf Abgeholt setzen (im Test `BCF94S`), Statusseite: "Abgeholt ... Nachricht eingerichtet. Wir sagen Ihnen Bescheid per Mail." mit Knopf "Benachrichtigung abbestellen". Auch nach Abholbereit klingt "Wir sagen Ihnen Bescheid" falsch, die Nachricht ist dann schon verschickt.
Erwartet: Bei Abgeholt und Storniert kein Benachrichtigungsblock; bei Abholbereit/Überfällig Text wie "Wir haben Ihnen per Mail Bescheid gesagt." (Abbestellen der Erinnerung darf bleiben).

**M6 (niedrig, apps/kunde = agent kunde): Text widerspricht Zustimmungstext; Tagesüberschriften folgen nicht der Demouhr.**
Ort: `apps/kunde/src/pages/SubscribeSection.tsx` ("Wir schreiben Ihnen einmal, wenn ..."), `apps/kunde/src/format.ts` `dayHeading()` (nutzt `new Date()` des Browsers).
Reproduzieren: Formular "Sag mir Bescheid": oben "einmal", im Zustimmungstext "höchstens eine Erinnerung". Nach "Zeit vorspulen" um 3 Tage steht über den Slots "Donnerstag, 19. November" statt "Heute".
Erwartet: Einleitung passend zum Zustimmungstext (zum Beispiel "Wir schreiben Ihnen, wenn Ihr Auftrag abholbereit ist."). "Heute/Morgen" relativ zum ersten gelieferten Tag oder zur Demouhr bestimmen.

**M7 (niedrig, packages/api = agent core): Seed Buchung von Z5MA9H außerhalb der Öffnungszeiten.**
Ort: `packages/api/src/seed.ts`, `pickedAt = Math.max(Mitternacht, now - 30 min)` und `za.booking` auf das 15 Minuten Raster davon.
Reproduzieren: Start kurz nach Mitternacht (im Test 00:02): Heute Liste zeigt "00:00 bis 00:15 Z5MA9H Erschienen". Ebenso abends (zum Beispiel 20:00 ergibt 19:30).
Erwartet: Die Seed Buchung liegt auf einem echten Slot des heutigen Tages innerhalb der Öffnungszeiten (zum Beispiel erster Slot des Tages, der vor `now` liegt, sonst Abholung ohne Buchung).

**M8 (niedrig, apps/betrieb = agent betrieb): Nach Abmelden bleibt die alte Route stehen; Codetricks gegen grep.**
Ort: `apps/betrieb/src/App.tsx` (Logout setzt den Hash nicht zurück), `apps/betrieb/src/format.ts` (`${"-"}` in `toDayString`, `m + -1` in `parseDay`).
Reproduzieren: Als Inhaber auf Einstellungen abmelden, als `mitarbeiter` anmelden: erste Seite ist "Diese Seite ist nur für Inhaber." statt der Auftragsliste.
Erwartet: Nach Login ohne Berechtigung auf `/auftraege` leiten (oder beim Logout Hash zurücksetzen). Im Code normale Schreibweise `"-"` und `m - 1` verwenden; R40 betrifft nur sichtbare Texte.

## Abweichungen vom Ursprungsprompt

1. **Tablet zuerst (R1, R14):** Die Betriebs App ist bei Tablet Hochformat nicht sauber nutzbar (M1, M2). Querformat und Handy sind in Ordnung.
2. **Fehlversuche pro Gerät (R11):** Gerät = IP (Annahme 4, vernünftig), aber durch Header fälschbar (M3).
3. **Abholfrist auf der Statusseite (R30):** nur ab Abholbereit (M4).
4. **Abgeholt mit einem Tipp (R17):** Abgeholt ist erst ab Abholbereit/Überfällig möglich (Annahme 7 und `MANUAL_TRANSITIONS`). Ein schneller Auftrag braucht zwei Tipps und löst dabei die Abholbereit Nachricht aus. Vertretbar, weil R16 den Ablauf über Abholbereit vorsieht; dokumentiert.
5. **Genau eine Nachricht (R25):** Zusätzlich gibt es Statuslink (R27) und eine Erinnerung (R28). Das ist im Prompt selbst so angelegt; Annahme 2 erklärt es, der Zustimmungstext nennt die Erinnerung. Vernünftig.
6. **Standardkanal (R26):** Der Kunde wählt immer selbst, Mail ist vorausgewählt; eine bei Annahme erfasste Mail zählt nicht als Eintrag (Annahme 3). Vernünftige Lesart, weil R25 nur Kunden mit Eintrag erlaubt.
7. **Weitere Annahmen geprüft:** Filter "Alle" zusätzlich (6), Slots auch bei Überfällig (10), Eintragen nur vor Abholbereit (12, entspricht R31 "solange nicht abholbereit"), Token im localStorage nur der Betriebs App (16), feste Seed Codes (21): alle vernünftig.
8. **Nicht verlangt, aber gebaut:** Demo Knopf "STOP Antwort simulieren" (nötig für R31 Widerruf per STOP in der Demo), Monatsauswahl in der Nachrichtenübersicht, Startseite `/` der Kundenwebsite mit Link zum Demobetrieb. Klein und begründet, keine verbotenen Funktionen.
9. **Hinweis (kein Mangel):** `npm audit` meldet Schwachstellen in Dev Abhängigkeiten (vitest, vite, esbuild, tinypool). Für eine lokale Demo ohne Hosting unkritisch.

## Konsistenz zwischen den Oberflächen

* **Vertrag:** Beide Apps importieren Typen und Konstanten aus `@abholdemo/shared` (`STATUS_LABELS`, `CHANNEL_LABELS`, `CONSENT_TEXT`, `businessUrl`, `normalizeCode`). Keine eigenen Kopien der Statusnamen gefunden.
* **Statusnamen:** Kundenseite zeigt `statusLabel` vom Server (= `STATUS_LABELS`), Betriebs App nutzt `STATUS_LABELS` direkt: "Angenommen", "In Arbeit", "Abholbereit", "Überfällig", "Abgeholt", "Storniert" identisch. Für `BCF94S` zeigten beide nacheinander Angenommen, Abholbereit, Abgeholt.
* **Slots:** Auf der Kundenseite 09:00 gebucht ("Montag, 16. November, 09:00 bis 09:15 Uhr"), in der Betriebs App Heute "09:00 bis 09:15 BCF94S", im Auftrag "Mo., 16.11., 09:00 bis 09:15". Kapazität 2 eingehalten (dritte Buchung 409, Slot für andere ausgeblendet), nach Abgeholt wieder 1 frei.
* **Webname, Links, QR:** überall `schuster-demo`; Nachrichtenlinks `http://localhost:5174/b/schuster-demo/a/{code}`, Abbestelllink mit `?abmelden=1` funktioniert, QR Ziel `http://localhost:5174/b/schuster-demo`, Statuslink im Auftrag identisch.
* **Zeit:** Betriebs App zeigt die Demouhr, die Kundenseite nutzt bei "Heute/Morgen" die Browseruhr (M6).
* **Trennung:** Kundenwebsite hat nur Nummer eingeben, Status, Bescheid sagen (mit Abbestellen) und Slot wählen; kein Login, keine Verwaltungsfunktion, kein Zugriff auf `/api/betrieb`. Betriebs App hat keine Kundenfunktionen (kein Eintragen, kein Slot Buchen); Slots sieht sie nur lesend. Nichts aus der Verbotsliste von R5 gebaut.

## Runde 2 (Nachprüfung nach Korrekturrunde 1)

Datum: 16.11.2026, ab 00:15 Ortszeit. Geändert waren laut Dateistand: `apps/betrieb/src/App.tsx`, `styles.css`, `format.ts`; `apps/kunde/src/format.ts`, `pages/StatusPage.tsx`, `pages/SubscribeSection.tsx`; `packages/api/src/routes/public.ts`, `seed.ts`, `slots.ts`, Tests `public.test.ts`, `seed.test.ts`; `docs/CONTRACT.md` Abschnitt 5, `docs/PLAN.md`.

### Läufe

* `npm test`: 8 Dateien, **65 Tests grün** (neu unter anderem "uses the last X-Forwarded-For entry: rotating fake first entries do not dodge the limit").
* `npm run typecheck`: Exit 0. `npm run build`: beide Apps ohne Fehler (betrieb 67 kB gzip, kunde 50 kB gzip).
* `npm run dev` mit frisch gelöschtem `packages/api/data`: alle drei Prozesse ohne Fehler.
* Regressionsgreps: "–"/"—" 0 Treffer, Bezahlwörter und "lorem" 0 Treffer. Neutrale 404 weiterhin gleich lang (136 Byte) und 0,30 s, gefunden 0,30 s.

### Status der Mängel

| Mangel | Status | Nachweis |
|---|---|---|
| M1 | behoben | Neuer Auftrag `PYVVHQ` bei 768x1024: Nummer vollständig sichtbar, `.huge-code` 486 px breit, scrollWidth gleich clientWidth, Dokument 768/768. Bei 375 px (305 px, Schrift 47 px) und 1024 px (742 px, Schrift 112 px) ebenso ohne Überlauf. |
| M2 | behoben | Schleife über alle Bildschirme (Aufträge, Neu, zwei Auftragsdetails, Heute mit zwei Zeilen, Nachrichten, Aufsteller, Einstellungen, Mitarbeiter, Demo): Dokumentbreite 768/768 und bei 375 px 375/375, kein Element ragt über den Rand. Heute: Knopf "Abgeholt" 115 px breit, vollständig lesbar. Aufsteller: Vorlage 526 px breit, Inhalt endet bei 679 von 747 px (nichts abgeschnitten). Druck: `@page { size: a5; margin: 0 }`, in `@media print` Vorlage 148 mm x 210 mm, Seitenkopf und Hinweis `no-print`; Druckdialog selbst nicht ausgelöst, Größen über CSSOM geprüft. |
| M3 | behoben (für den Weg über die Kundenwebsite) | Über den Proxy `http://localhost:5174/api/...` mit wechselndem gefälschtem `X-Forwarded-For` (203.0.113.1 bis 12): 10 mal 404, dann 429; danach auch gültige Nummer 429. Direkt gegen 4000 ohne Header: nach 10 Fehlern 429; mit zwei Einträgen (gefälscht, fest): nach 10 Fehlern 429. Rest siehe M9. |
| M4 | behoben | `PYVVHQ` im Status Angenommen: "Nach der Fertigstellung haben Sie 14 Tage Zeit zum Abholen." Ab Abholbereit: "... innerhalb von 14 Tagen ab, bis Montag, 30. November." |
| M5 | teilweise | Bei Abgeholt erscheint kein Benachrichtigungsblock mehr (geprüft mit `PYVVHQ`). Bei Abholbereit steht aber weiterhin "Nachricht eingerichtet. Wir sagen Ihnen Bescheid per Mail.", obwohl die Nachricht schon verschickt ist (`apps/kunde/src/pages/StatusPage.tsx`, Block `order.notifyActive && !isFinal`). Erwartet: bei Abholbereit/Überfällig zum Beispiel "Wir haben Ihnen per Mail Bescheid gesagt.", Abbestellen der Erinnerung darf bleiben. Schwere weiter niedrig. |
| M6 | behoben | Einleitung jetzt "Wir sagen Ihnen Bescheid, wenn Ihr Auftrag abholbereit ist." (passt zum Zustimmungstext). Nach Vorspulen um 3 Tage zeigen die Slot Überschriften Datumsangaben ("Donnerstag, 19. November | Freitag, 20. November ..."), kein falsches "Heute" mehr. |
| M7 | behoben | Seed bei Start 00:15: Buchung von `Z5MA9H` liegt auf Samstag 12:45 bis 13:00 (innerhalb der Öffnungszeit Sa 09:00 bis 13:00). Die Heute Liste zeigt keine Zeile um 00:00 mehr. Hinweis ohne Mangel: Wird vor dem ersten Slot des Tages geseedet, liegt die Buchung an einem früheren Tag, abgeholt ist der Auftrag aber heute. Für die Demo unerheblich. |
| M8 | behoben | Abmelden auf Einstellungen setzt die Route auf `#/auftraege`; Login als `mitarbeiter` landet auf "Aufträge", Menü ohne Einstellungen und Mitarbeiter. `format.ts` nutzt jetzt normale Schreibweise (`m - 1`, `"-"`). |

### Demoablauf (R39) erneut

Schritt 1 bis 8 nach README vollständig ausgeführt, ohne Abweichung: Auftrag "Stiefel, Sohle erneuern" in 7,3 s (`PYVVHQ`, Nummer vollständig groß), Kundenseite mit " pyv vhq ", Eintrag per Mail, Abholbereit, Mail in der Nachrichtenübersicht (`k***@beispiel.de`, 0,00 €), Slot 09:15 heute gebucht, in Heute als "09:15 bis 09:30 PYVVHQ" sichtbar, Abgeholt gibt "Erschienen", Kundenseite zeigt danach nur "Abgeholt" ohne Benachrichtigungsblock. Vorspulen um 3 Tage: `G8UE4R` neu überfällig, 1 Erinnerung.

### Konsistenz (Runde 2)

Gleiche Statusnamen in beiden Oberflächen, gleiche Slotzeit (Kunde "Montag, 16. November, 09:15 bis 09:30 Uhr", Betrieb Heute "09:15 bis 09:30"), Kapazität 2 bei 09:00 und 09:15 eingehalten, Links und QR unverändert auf `http://localhost:5174/b/schuster-demo`.

### Neue Mängel

**M9 (niedrig, packages/api = agent core): Direkte Anfragen an Port 4000 können den Geräteschlüssel weiter selbst wählen.**
Ort: `packages/api/src/routes/public.ts`, `clientKey()`. Bei Loopback Socket wird jetzt der letzte `X-Forwarded-For` Eintrag genommen. Wer die API direkt auf 127.0.0.1:4000 aufruft (ohne Proxy), setzt diesen letzten Eintrag selbst.
Reproduzieren: `for i in $(seq 1 12); do curl -s -o /dev/null -w "%{http_code} " -H "X-Forwarded-For: 198.18.0.$i" http://localhost:4000/api/public/b/schuster-demo/orders/BAD$i; done` ergibt 12 mal 404, nie 429.
Einordnung: Die API lauscht nur auf 127.0.0.1, der Weg für Kunden (über die Kundenwebsite) ist geschützt. Das Verhalten entspricht dem geänderten Vertrag Abschnitt 5 ("loopback = unser Proxy"). Betroffen sind nur Programme auf demselben Rechner, daher niedrig und ohne Einfluss auf R11.
Erwartet: Der Header wird nur vom eigenen Proxy akzeptiert, zum Beispiel indem der Proxy der Kundenwebsite (`apps/kunde/vite.config.ts`, `configure`) einen eigenen Header mit der echten Adresse setzt (und einen vom Client gesendeten gleichnamigen Header entfernt) und die API nur diesen auswertet. Andernfalls im Vertrag und in `docs/PLAN.md` als bekannte Grenze der lokalen Demo dokumentieren (Orchestrator).

### Ergebnis Runde 2

40 erfüllt, 0 teilweise, 0 offen. Offen bleiben M5 (teilweise behoben, niedrig, apps/kunde) und M9 (neu, niedrig, packages/api). Neue Regressionen gibt es keine.

## Runde 3 (Abschluss)

Datum: 16.11.2026. `npm test`: 8 Dateien, 65 Tests grün. `npm run typecheck`: Exit 0. `npm run build`: Exit 0. `npm run dev` mit frischen Seed Daten: api, betrieb und kunde starten ohne Fehler.

| Mangel | Endstatus | Nachweis |
|---|---|---|
| M5 | behoben | Kundenseite bei 375 px: `7KP4QX` (Abholbereit) zeigt "Wir haben Ihnen per Mail Bescheid gesagt.", `RT8WMZ` (Überfällig) zeigt "Wir haben Ihnen per SMS Bescheid gesagt.", beide weiter mit Knopf "Benachrichtigung abbestellen". `Q9XB2M` (In Arbeit) behält "Wir sagen Ihnen Bescheid per Mail.". Kein seitlicher Überlauf (375/375). Code: `apps/kunde/src/pages/StatusPage.tsx`, Unterscheidung über `order.slotBookingOpen`. |
| M9 | akzeptiert als dokumentierte Grenze | Kein Code geändert. Dokumentiert in `docs/PLAN.md` Abschnitt 7 ("Entscheidung M9") und im README unter "Was simuliert ist". Bewertung: vertretbar. Die API lauscht nur auf 127.0.0.1, der Kundenweg über die Kundenwebsite ist geschützt (in Runde 2 nachgewiesen), die Demo hat kein echtes Hosting. Für einen echten Betrieb bleibt der Hinweis, dass nur der eigene Reverse Proxy die Client Adresse setzen darf; das steht so in `docs/PLAN.md`. |

**Endergebnis: 40 erfüllt, 0 teilweise, 0 offen.** Kein Mangel ist mehr offen. M1 bis M8 sind behoben. M9 ist als bekannte Grenze der lokalen Demo angenommen.
