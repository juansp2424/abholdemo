# ChangeLog

Wichtige Änderungen an der Betriebs App (`apps/betrieb`) und der Kundenwebsite (`apps/kunde`) samt der Backend Änderungen, die man in den Websites sieht. Neueste Änderung oben. Änderungen an Farben und Schriften sind hier bewusst nicht aufgeführt.

Die Zahl hinter dem Datum ist der Commit im Repo, damit sich jede Änderung nachvollziehen lässt (`git show <Commit>`). Planung und Begründungen stehen in `docs/PLAN.md`, der Vertrag zwischen den Teilen in `docs/CONTRACT.md`, die Prüfberichte in `docs/REVIEW.md`.

## 2026-11-17: Telefonnummer ist Pflicht, Mitteilungen an den Kunden (`9941a88`)

**Betriebs App**
* Neuer Auftrag: Pflichtangaben sind jetzt Gegenstand und Telefonnummer. Die Telefonnummer steht direkt unter dem Gegenstand und nicht mehr unter "Mehr Angaben". Ohne sie lässt sich der Auftrag nicht speichern.
* Auftrag, Abschnitt "Benachrichtigung": neues Eingabefeld "Mitteilung an den Kunden", zum Beispiel wenn ein Teil noch bestellt werden muss und sich die Reparatur verzögert. Die Mitteilung geht per Mail, wenn bei der Annahme eine Mailadresse erfasst wurde, sonst per SMS an die Telefonnummer. Vor dem Senden steht, an wen und auf welchem Weg. Bis 500 Zeichen, mehrfach möglich. Bei abgeholten und stornierten Aufträgen fehlt das Feld.
* Nachrichten: Die Mitteilung erscheint mit der Art "Mitteilung", maskiertem Empfänger, Text und Kosten (Mail 0,00 Euro, SMS 0,075 Euro). Der Knopf "STOP Antwort simulieren" gibt es nur noch bei Nachrichten, die der Kunde bestellt hat (Abholbereit und Erinnerung).

**Kundenwebsite**
* Keine Änderung. Mitteilungen sind dort nicht sichtbar.

**Backend**
* Aufträge ohne gültige Telefonnummer werden abgelehnt (der Fehlertext spricht von "Telefonnummer" statt "Handynummer"). Alle Demo Aufträge haben jetzt eine Telefonnummer.
* Neuer Endpunkt `POST /api/betrieb/orders/:id/notify`. Die Mitteilung zählt nicht zur einen Abholbereit Nachricht und braucht keinen Eintrag des Kunden auf der Kundenseite.

## 2026-11-17: Abholzeiten folgen zwingend den Öffnungszeiten (`55626b1`)

**Betriebs App**
* Einstellungen: Ändert der Inhaber Öffnungszeiten oder Länge der Abholzeiten, werden künftige Buchungen, die nicht mehr zu einer erzeugten Abholzeit passen, freigegeben. Nach dem Speichern steht, wie viele das waren.
* Kalender: Die Mittagspause und die Zeiten außerhalb der Öffnung werden nicht mehr als schraffierte Fläche eingezeichnet. Die Zeitachse läuft durchgehend.

**Kundenwebsite**
* Betroffene Kunden sehen auf der Statusseite wieder die Auswahl mit passenden Abholzeiten. Sie bekommen keine Nachricht, weil es nur eine Nachricht pro Auftrag gibt.

**Backend**
* Beim Buchen war schon gewährleistet, dass nur aus den Öffnungszeiten erzeugte Zeiten angenommen werden (nicht in der Mittagspause, nicht vor Öffnung oder nach Schließung, nicht an geschlossenen Tagen, keine krummen Minuten). Dafür gibt es jetzt eigene Tests.
* Die Antwort beim Speichern der Einstellungen enthält zusätzlich `releasedBookings`.

## 2026-11-17: Kalender statt "Heute" (`70422f2`)

**Betriebs App**
* Der Menüpunkt "Heute" heißt jetzt "Kalender" (Adresse `#/kalender`). Er zeigt einen Tageskalender mit Zeitachse.
* Jede Abholung ist ein Balken mit der Auftragsnummer. Bei längeren Abholzeiten steht die Uhrzeit im Balken.
* Mehrere Abholungen zur selben Zeit stehen nebeneinander. Der Kalender wird dann breiter und lässt sich seitlich scrollen.
* Oben steht "Voraussichtlich fertig": die Aufträge, deren Fertigstellung auf diesen Tag fällt (nur ein Datum, deshalb als Liste und nicht als Balken). Stornierte fehlen.
* Balken sind nach Stand eingefärbt: Abholung erwartet, noch nicht erschienen, abgeholt. Am heutigen Tag zeigt eine Linie die Demo Uhrzeit.
* Balken antippen zeigt Details mit "Abgeholt" und "Zum Auftrag". "Abgeholt" gibt den Slot wieder frei.
* Tag vor und zurück, "Heute" und eine Datumsauswahl.

**Backend**
* `GET /api/betrieb/day-slots` liefert zusätzlich `completions` (Fertigstellungen des Tages) und `openingHours` (Öffnungszeiten des Wochentags für die Zeitachse).

## 2026-11-17: Generische Plattform für Fahrrad und Auto Werkstätten (`9b557ec`)

**Betriebs App**
* Die fest eingebaute Schnellauswahl für Schuhmacher ist entfernt. Jeder Betrieb legt seine eigene an: Einstellungen, Abschnitt "Schnellauswahl für neue Aufträge" (nur Inhaber). Sie ist am Anfang leer.
* Neuer Auftrag: Die eigenen Einträge erscheinen als Knöpfe unter dem Feld Gegenstand. Ohne Einträge steht ein Hinweis, für den Inhaber mit Link zu den Einstellungen.
* Das Beispiel im Feld Gegenstand ist jetzt "Auto, Ölwechsel".

**Kundenwebsite**
* Der Demo Betrieb heißt "Werkstatt Demo" mit der Adresse `/b/werkstatt-demo` (vorher "Schuhmacher Demo", `/b/schuster-demo`).

**Backend**
* Neue Einstellung `quickCategories`: höchstens 20 Einträge mit 1 bis 40 Zeichen, doppelte Einträge (ohne Beachtung der Groß und Kleinschreibung) werden abgelehnt. Sie steht auch in den Betriebsdaten, damit jeder Mitarbeiter die Knöpfe sieht.
* Neutrale Seed Daten: Betrieb "Werkstatt Demo", Mitarbeiter Tom Werner, zehn Aufträge aus Fahrrad und Auto ohne Kategorien. Ältere Datendateien werden beim Start ergänzt. Für die neuen Seed Daten einmal "Demodaten zurücksetzen".

## 2026-11-17: Bedienung und Barrierefreiheit (`1beee3e`)

**Betriebs App und Kundenwebsite**
* Knöpfe, Abholzeiten, Auswahlknöpfe und Menüpunkte reagieren sofort beim Drücken (leicht verkleinert).
* Eingabefelder haben einen deutlichen Fokusring.
* Einstellungen für weniger Bewegung, weniger Transparenz und mehr Kontrast werden beachtet.
* Betriebs App: Kopfleiste und Menü sind leicht durchscheinend, der Inhalt läuft darunter durch.
* Kundenwebsite: Inhalte blenden kurz ein (nur Deckkraft, schnell auf älteren Handys), zusätzlich gibt es einen Dunkelmodus.

## 2026-11-16: Erste Version und Korrekturrunden (`c17acb9`)

Gebaut nach dem Auftrag in `docs/ORIGINAL_PROMPT.md`: Backend, Betriebs App (PWA) und Kundenwebsite. Alle Anforderungen R1 bis R40 wurden von einem unabhängigen Prüfer als erfüllt bewertet (`docs/REVIEW.md`).

**Betriebs App**
* Anmeldung mit zwei Demozugängen. Inhaber sehen Einstellungen und Mitarbeiter, Mitarbeiter nicht.
* Aufträge: Liste mit Filtern (Alle, Offen, Abholbereit, Überfällig, Heute abgeholt) und Suche nach Nummer und Kundenname. Neuer Auftrag mit einer Pflichtangabe, die Auftragsnummer erscheint danach sehr groß.
* Auftragsdetail: Knopf "Abholbereit", weitere Statuswechsel mit einem Tipp, Foto, Statusprotokoll mit Zeit und Mitarbeiter, Zustimmungsprotokoll.
* Nachrichten: simulierte Nachrichten mit maskiertem Empfänger, Link, Kosten, Monatssumme und Zahl pro Auftrag. Eine STOP Antwort lässt sich per Demo Knopf simulieren.
* Aufsteller mit festem QR Code und druckbarer A5 Vorlage.
* Einstellungen: Öffnungszeiten, Länge und Kapazität der Abholzeiten, Abholfrist, Standardkanal, Nachrichtentext mit Vorschau, Name und Logo.
* Mitarbeiterverwaltung und Demo Werkzeuge (Zeit vorspulen, Demodaten zurücksetzen).

**Kundenwebsite**
* Startseite mit Eingabefeld für die Auftragsnummer (Groß und Kleinschreibung und Leerzeichen sind egal).
* Statusseite mit Status in einfacher Sprache, Abholzeit, voraussichtlicher Fertigstellung und Abholfrist. Sie zeigt keine personenbezogenen Daten.
* "Sag mir Bescheid" mit ausdrücklicher Zustimmung (nicht vorangekreuzt) und Widerruf per Link oder STOP.
* Abholzeit buchen, ändern und absagen, höchstens eine Abholzeit pro Auftrag.
* Datenschutzhinweis als Platzhalter, klar als Demo gekennzeichnet. Keine Cookies, kein Tracking.

**Korrekturen nach der Prüfung** (vor dem ersten Commit eingearbeitet)
* Betriebs App: Auf dem Tablet wurde die große Auftragsnummer abgeschnitten und einige Seiten liefen seitlich über (Neuer Auftrag, Aufsteller, Heute). Jetzt passt alles bis 320 Pixel Breite. Nach dem Abmelden öffnet sich beim nächsten Anmelden wieder die Auftragsliste.
* Kundenwebsite: Der Hinweis zur Abholfrist erscheint in jedem nicht abgeschlossenen Status. Bei Abgeholt und Storniert fehlen Benachrichtigungskasten und Abbestellen Knopf. Bei Abholbereit und Überfällig steht "Wir haben Ihnen Bescheid gesagt". Die Tageszeilen heißen immer Wochentag und Datum, ohne "Heute" und "Morgen". Die Texte widersprechen dem Zustimmungstext nicht mehr.
* Backend: Die Sperre nach zu vielen falschen Nummern ließ sich mit gefälschten Kopfzeilen umgehen und prüft jetzt die richtige Adresse. Die Seed Buchungen liegen immer innerhalb der Öffnungszeiten. Der Nachrichtentext muss `{link}` enthalten, damit die Abholzeit wählbar bleibt.
* Bekannte Grenze der Demo: Ein Programm auf demselben Rechner kann die Sperre über direkte Aufrufe an Port 4000 umgehen (siehe README).
