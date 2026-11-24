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
* **Kunde (am besten Handy Ansicht, im Browser F12, dann Handy Symbol):** http://localhost:5174

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
| Kundenwebsite | http://localhost:5174 |
| Backend | http://localhost:4000 |

Tests des Backends: `npm test`. Die Daten liegen in `packages/api/data/` und werden beim ersten Start aus den Seed Daten erzeugt.

## Demo Zugangsdaten (Betriebs App)

| Rolle | Benutzername | Passwort |
|---|---|---|
| Inhaber | `inhaber` | `demo1234` |
| Mitarbeiter | `mitarbeiter` | `demo1234` |

Vorhandene Demo Aufträge für die Kundenseite (Code und die letzten vier Ziffern der Telefonnummer, die für die zentrale Seite nötig sind): `D3FY6W` mit `0012` (abholbereit, ohne Eintrag), `7KP4QX` mit `0013` (abholbereit, Abholzeit gebucht), `RT8WMZ` mit `0034` (überfällig), `H7RT3K` mit `0019` (angenommen), `Q9XB2M` mit `0017` (in Arbeit). Die Telefonnummer steht im Auftrag in der Betriebs App. Oder direkt über den Link: `http://localhost:5174/a/D3FY6W` (ohne Ziffern).

## Kostenvoranschlag testen

Drei Beispiele sind in den Aufträgen vorhanden (nach "Demodaten zurücksetzen" im Menü "Demo" sind sie sicher da):

| Auftrag | Zustand | Kanal | Kundenseite (Ziffern) |
|---|---|---|---|
| `Q9XB2M` | wartet auf Freigabe | Mail | `http://localhost:5174/a/Q9XB2M`, Ziffern `0017` |
| `H7RT3K` | wartet auf Freigabe | WhatsApp | `http://localhost:5174/a/H7RT3K`, Ziffern `0019` |
| `C6VJ5T` | vom Kunden freigegeben | WhatsApp | `http://localhost:5174/a/C6VJ5T`, Ziffern `0016` |

**Sicht des Betriebs:** Betriebs App, Auftrag öffnen, Abschnitt "Kostenvoranschlag" (Betrag, Zustand, "Telefonisch freigegeben", "Neu senden", "Zurückziehen"). In der Auftragsliste zeigt ein Schild den Stand, der Filter "Wartet auf Freigabe" listet die offenen. Neuen Voranschlag senden: in einem Auftrag Betrag, Text, Gültigkeit und Kanal (Mail oder WhatsApp) eintragen. Die Nachricht steht unter "Nachrichten".

**Sicht des Kunden:** Link wie oben öffnen. Betrag und Text erscheinen erst nach den letzten vier Ziffern der Telefonnummer, dann "Freigeben" oder "Ablehnen" (mit Rückfrage). Die Nachricht selbst enthält nur den Link.

Mit "Zeit vorspulen" (Menü "Demo") kommt einen Tag vor Ende der Gültigkeit eine Erinnerung, danach läuft der Voranschlag ab.

## Abgabetermin und neues Fertigstellungsdatum testen

**Termin buchen (Kunde):** `http://localhost:5174/b/werkstatt-demo/termin` (oder auf `http://localhost:5174/b/werkstatt-demo` den Knopf "Termin zum Abgeben buchen"). Leistung, Gegenstand, Tag und Uhrzeit, Name und Handynummer eingeben. Danach erscheint die Seite des Termins mit "Termin ändern" und "Termin absagen". Die Bestätigung steht in der Betriebs App unter "Nachrichten".

**Termin in der Werkstatt:** Menü "Kalender", grüne Balken sind Abgaben (die Demo bringt drei für die nächsten Tage mit). Antippen, dann "Kunde ist da: Auftrag anlegen": der Auftrag ist vorausgefüllt, der Anhänger lässt sich gleich drucken. Außerdem "Nicht erschienen" und "Absagen" (mit Nachricht). Ein- und ausschalten und die Anzahl pro Zeitfenster unter "Einstellungen", Abschnitt "Abgabetermine".

**Neues Fertigstellungsdatum:** Auftrag öffnen, im Abschnitt "Kunde" auf "Fertigstellungsdatum ändern". Neues Datum, optional Grund, Haken "Kunden benachrichtigen". Die Kundenseite zeigt das Datum, bei einer Verschiebung mit "(verschoben)" und dem Grund. Beispiel: `Q9XB2M` wurde schon einmal verschoben.

## Demoablauf (drei Minuten)

**Schnellauswahl:** Die Demo bringt zwei Einträge mit ("Wartung Paket 1" und "Reifenwechsel (Sommer) mit Einlagerung"). Sie erscheinen als Knöpfe beim neuen Auftrag. Der Inhaber kann sie unter "Einstellungen", Abschnitt "Schnellauswahl für neue Aufträge", ändern, löschen oder ergänzen. Nach "Demodaten zurücksetzen" sind wieder die zwei Einträge da.

Zwei Fenster nebeneinander: links Betriebs App (Tablet), rechts Kundenwebsite (Handy Ansicht).

1. **Auftrag anlegen (20 s).** Betriebs App, als `inhaber` anmelden, "Neuer Auftrag". Gegenstand zum Beispiel "Auto, Ölwechsel" eintippen (oder einen Knopf der eigenen Schnellauswahl antippen, siehe unten), Enter. Dazu die Telefonnummer des Kunden (Pflicht, zum Beispiel `+49 151 00000012`). Die Nummer erscheint groß, sie kommt auf den Anhänger. Gleich daneben der Knopf **"Anhänger drucken"**: ein Anhänger mit QR Code und Nummer (Schritt 1b). Der Kunde bekommt sofort den Statuslink, per Mail oder, wenn nur eine Telefonnummer vorliegt, per SMS (siehe Nachrichten).
2. **Kunde fragt den Stand.** Kundenwebsite `http://localhost:5174` (die zentrale Seite für alle Betriebe): Nummer und die letzten vier Ziffern der Telefonnummer eingeben (klein und mit Leerzeichen geht auch). Es erscheint die Seite des richtigen Betriebs mit Name und Status "Angenommen", ohne Namen und Gegenstand des Kunden. Schneller geht der Link aus der Statusnachricht oder der QR Code vom Anhänger (Schritt 1b), dann ist keine Eingabe nötig.
3. **Kunde trägt sich ein.** "Sag mir Bescheid": Mail wählen, Adresse eingeben, Haken bei der Zustimmung setzen, abschicken.
4. **Betrieb setzt Abholbereit.** Auftrag in der Liste öffnen, großer Knopf "Abholbereit".
5. **Nachricht erscheint.** Menü "Nachrichten": die simulierte Mail mit Link, maskiertem Empfänger, Kosten 0,00 €. Monatssumme oben.
6. **Kunde bucht einen Slot.** Statusseite neu laden (oder Link aus der Nachricht öffnen): freie Abholzeiten erscheinen. Eine Zeit wählen, Bestätigung erscheint. Ändern und Absagen gehen hier auch.
7. **Betrieb sieht den Slot.** Menü "Kalender": Tageskalender mit Uhrzeiten. Jede Abholung ist ein Balken mit der Auftragsnummer. Gibt es mehrere Abholungen zur selben Zeit, stehen die Balken nebeneinander und der Kalender wird breiter. Liegt der Slot morgen, mit "Nächster Tag" blättern. Auf einen Balken tippen, dann "Abgeholt": Status wird gesetzt, der Slot wird frei, der Balken wird grau (Erschienen). Oben steht "Voraussichtlich fertig" mit den Aufträgen, deren Fertigstellung auf diesen Tag fällt.
8. **Verzögerung melden (30 s).** Auftrag öffnen, im Abschnitt "Benachrichtigung" bei "Mitteilung an den Kunden" einen Text schreiben, zum Beispiel "Das Ersatzteil ist bestellt. Die Reparatur dauert zwei Tage länger." und "Mitteilung senden". Mit Mailadresse geht sie per Mail, sonst per SMS an die Telefonnummer. Sie steht danach unter "Nachrichten".
9. **Bonus (30 s).** Menü "Demo": "Zeit vorspulen" um 3 Tage. `G8UE4R` wird überfällig und bekommt eine Erinnerung (Nachrichten). "Aufsteller" zeigt die allgemeine Vorlage mit dem QR Code der zentralen Seite: ein Aufsteller für alle Betriebe, ohne Betriebsname (Schalter oben, um den Betriebsnamen einzusetzen). "Demodaten zurücksetzen" stellt alles wieder her.

## Was simuliert ist

* **Nachrichten und Mitteilungen:** Es wird nichts versendet. Mail, SMS und WhatsApp landen nur in der Nachrichtenübersicht, mit den Kosten, die echt anfallen würden (Mail 0,00 €, WhatsApp 0,0456 €, SMS 0,075 €).
* **STOP Antwort** auf SMS oder WhatsApp: per Demo Knopf in der Nachrichtenübersicht.
* **Zeit:** Das Backend hat eine Demouhr. "Zeit vorspulen" verschiebt sie für Fristen, Überfällig und Slots.
* **Hosting:** alles läuft lokal. Links und QR Codes zeigen auf `localhost:5174`. Später gibt es eine zentrale Adresse für alle Betriebe, in den Links steht dann `adresse/a/<Nummer>`.
* **Datenschutzhinweis:** Platzhaltertext, als Demo gekennzeichnet.
* **Daten:** Ein Betrieb ("Werkstatt Demo"), erfundene Namen und Kontakte, Speicherung in einer JSON Datei.
* **Gerät für die Fehlversuchssperre:** die IP Adresse. Lokal teilen sich alle Fenster dieselbe. Bekannte Grenze der Demo: Ein Programm auf demselben Rechner kann die Sperre über direkte Aufrufe an Port 4000 mit gefälschtem `X-Forwarded-For` umgehen; über die Kundenwebsite geht das nicht.

Planung, Annahmen und Vertrag: `docs/PLAN.md`, `docs/CONTRACT.md`. Prüfbericht: `docs/REVIEW.md`. Alle Änderungen an den Websites: `ChangeLog.MD`.
