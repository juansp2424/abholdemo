# Abholdemo: Abholstatus und Abholslot

## Schnellstart für Mitgründer (5 Minuten)

Einmalig vorbereiten:

1. **Node.js installieren** (Version 20 oder neuer): https://nodejs.org, den Knopf "LTS" wählen. Danach das Terminal neu öffnen.
2. **Projekt holen:** im Terminal `git clone https://github.com/juansp2424/abholdemo.git abholdemo` und `cd abholdemo` (oder auf GitHub "Code", dann "Download ZIP", entpacken und den Ordner im Terminal öffnen).

Dann jedes Mal:

```bash
npm install
npm run dev
```

Warten, bis im Terminal drei Zeilen laufen (api, betrieb, kunde). Dann im Browser öffnen:

* **Betrieb (Tablet Ansicht):** http://localhost:5173, Anmeldung `inhaber` und `demo1234`
* **Kunde (am besten Handy Ansicht, im Browser F12, dann Handy Symbol):** http://localhost:5174/b/werkstatt-demo

Beenden mit `Strg+C` im Terminal. Alles läuft nur auf Ihrem Rechner, es wird nichts versendet. Den Ablauf für die Vorführung finden Sie weiter unten unter "Demoablauf". Zurücksetzen der Daten: in der Betriebs App im Menü "Demo", Knopf "Demodaten zurücksetzen".

Probleme: Port belegt? Andere Programme auf 4000, 5173 oder 5174 beenden. Fehler `EACCES` bei `npm install`? Dann `npm install --cache ./.npm-cache` versuchen.

Demo für Werkstätten (Fahrrad und Auto). Die Plattform ist allgemein gehalten, jeder Betrieb legt seine eigene Schnellauswahl an. Kunden sehen den Stand ihres Auftrags über eine Auftragsnummer, ohne Konto. Ist der Auftrag abholbereit, bekommen sie auf Wunsch eine Nachricht und wählen eine Abholzeit.

## Start

```bash
npm install
npm run dev
```

| Teil | Adresse |
|---|---|
| Betriebs App | http://localhost:5173 |
| Kundenwebsite | http://localhost:5174/b/werkstatt-demo |
| Backend | http://localhost:4000 |

Tests des Backends: `npm test`. Die Daten liegen in `packages/api/data/` und werden beim ersten Start aus den Seed Daten erzeugt.

## Demo Zugangsdaten (Betriebs App)

| Rolle | Benutzername | Passwort |
|---|---|---|
| Inhaber | `inhaber` | `demo1234` |
| Mitarbeiter | `mitarbeiter` | `demo1234` |

Vorhandene Demo Aufträge für die Kundenseite: `D3FY6W` (abholbereit, ohne Eintrag), `7KP4QX` (abholbereit, Slot gebucht), `RT8WMZ` (überfällig), `H7RT3K` (angenommen).

## Demoablauf (drei Minuten)

**Einmal vorher (30 s):** Menü "Einstellungen", Abschnitt "Schnellauswahl für neue Aufträge": ein paar Einträge anlegen, zum Beispiel Ölwechsel, Reifenwechsel, Bremsen wechseln (Auto) oder Schlauch wechseln, Kette wechseln (Fahrrad), dann "Speichern". Ab dann erscheinen sie als Knöpfe beim neuen Auftrag. Die Demo gibt nichts vor, die Schnellauswahl ist am Anfang leer.

Zwei Fenster nebeneinander: links Betriebs App (Tablet), rechts Kundenwebsite (Handy Ansicht).

1. **Auftrag anlegen (20 s).** Betriebs App, als `inhaber` anmelden, "Neuer Auftrag". Gegenstand zum Beispiel "Auto, Ölwechsel" eintippen (oder einen Knopf der eigenen Schnellauswahl antippen, siehe unten), Enter. Die Nummer erscheint groß, sie kommt auf den Anhänger.
2. **Kunde fragt den Stand.** Kundenwebsite `/b/werkstatt-demo`, Nummer eingeben (klein und mit Leerzeichen geht auch). Statusseite zeigt "Angenommen". Kein Name, kein Gegenstand.
3. **Kunde trägt sich ein.** "Sag mir Bescheid": Mail wählen, Adresse eingeben, Haken bei der Zustimmung setzen, abschicken.
4. **Betrieb setzt Abholbereit.** Auftrag in der Liste öffnen, großer Knopf "Abholbereit".
5. **Nachricht erscheint.** Menü "Nachrichten": die simulierte Mail mit Link, maskiertem Empfänger, Kosten 0,00 €. Monatssumme oben.
6. **Kunde bucht einen Slot.** Statusseite neu laden (oder Link aus der Nachricht öffnen): freie Abholzeiten erscheinen. Eine Zeit wählen, Bestätigung erscheint. Ändern und Absagen gehen hier auch.
7. **Betrieb sieht den Slot.** Menü "Kalender": Tageskalender mit Uhrzeiten. Jede Abholung ist ein Balken mit der Auftragsnummer. Gibt es mehrere Abholungen zur selben Zeit, stehen die Balken nebeneinander und der Kalender wird breiter. Liegt der Slot morgen, mit "Nächster Tag" blättern. Auf einen Balken tippen, dann "Abgeholt": Status wird gesetzt, der Slot wird frei, der Balken wird grau (Erschienen). Oben steht "Voraussichtlich fertig" mit den Aufträgen, deren Fertigstellung auf diesen Tag fällt.
8. **Bonus (30 s).** Menü "Demo": "Zeit vorspulen" um 3 Tage. `G8UE4R` wird überfällig und bekommt eine Erinnerung (Nachrichten). "Aufsteller" zeigt den QR Code zum Ausdrucken. "Demodaten zurücksetzen" stellt alles wieder her.

## Was simuliert ist

* **Nachrichten:** Es wird nichts versendet. Mail, SMS und WhatsApp landen nur in der Nachrichtenübersicht, mit den Kosten, die echt anfallen würden (Mail 0,00 €, WhatsApp 0,0456 €, SMS 0,075 €).
* **STOP Antwort** auf SMS oder WhatsApp: per Demo Knopf in der Nachrichtenübersicht.
* **Zeit:** Das Backend hat eine Demouhr. "Zeit vorspulen" verschiebt sie für Fristen, Überfällig und Slots.
* **Hosting:** alles läuft lokal. Links und QR Code zeigen auf `localhost:5174`.
* **Datenschutzhinweis:** Platzhaltertext, als Demo gekennzeichnet.
* **Daten:** Ein Betrieb ("Werkstatt Demo"), erfundene Namen und Kontakte, Speicherung in einer JSON Datei.
* **Gerät für die Fehlversuchssperre:** die IP Adresse. Lokal teilen sich alle Fenster dieselbe. Bekannte Grenze der Demo: Ein Programm auf demselben Rechner kann die Sperre über direkte Aufrufe an Port 4000 mit gefälschtem `X-Forwarded-For` umgehen; über die Kundenwebsite geht das nicht.

Planung, Annahmen und Vertrag: `docs/PLAN.md`, `docs/CONTRACT.md`. Prüfbericht: `docs/REVIEW.md`.
