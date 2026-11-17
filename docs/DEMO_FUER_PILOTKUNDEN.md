# Abholstatus: Beschreibung der Demo für die Pilotkunden Ansprache

Dieses Dokument erklärt das Produkt und die Demo (Betriebs App und Kundenwebsite) so, dass daraus Anfragen an erste Pilotbetriebe vorbereitet werden können: Ansprachetexte, Gesprächsleitfäden, Antworten auf Einwände, Vorschläge für den Pilot. Es ist als Wissensdatei für ein Claude Projekt gedacht.

Stand der Demo: 17. November 2026 (Repo `juansp2424/abholdemo`). Wo etwas noch nicht existiert oder offen ist, steht das ausdrücklich dabei. Bitte nichts hinzuerfinden, was hier nicht steht. Besonders offen sind Preis und Rechtliches (siehe Abschnitt 9).

## 1. Worum es geht

**Das Problem:** Kunden von Werkstätten rufen an oder fragen am Tresen, ob ihr Fahrrad oder Auto schon fertig ist. Das unterbricht die Arbeit. Auf der anderen Seite stehen fertige Stücke lange im Regal oder auf dem Hof, weil Kunden nicht wissen, dass sie fertig sind. Heute läuft das in kleinen Betrieben oft mit Zetteln und Anhängern.

**Die Lösung:** Der Kunde sieht den Stand seines Auftrags selbst, über eine Auftragsnummer, ähnlich wie bei einer Paketverfolgung. Ohne Konto, ohne App. Meldet der Betrieb "Abholbereit", bekommt der Kunde auf Wunsch genau eine Nachricht und kann sich eine Abholzeit aussuchen. Die Abholzeiten richten sich zwingend nach den Öffnungszeiten des Betriebs.

**Wer zahlt:** Der Betrieb zahlt ein Abo, der Kunde zahlt nichts. Die Höhe des Abos ist noch nicht festgelegt.

**Zielgruppe der Demo:** Fahrradwerkstätten und Autowerkstätten (kleine, inhabergeführte Betriebe). Die Plattform ist bewusst allgemein gehalten: Jeder Betrieb legt seine eigenen Auftragsarten selbst an.

**Was es nicht ist:** Keine Kasse, keine Rechnungen, keine Zahlungen, kein Kundenkonto, kein Terminkalender für Reparaturen, kein Marktplatz, keine Buchungsplattform. Bezahlt wird weiter im Laden an der eigenen Kasse. Es ersetzt keine Werkstattsoftware, es ergänzt den Ablauf an der Annahme und bei der Abholung.

## 2. Die zwei Seiten im Überblick

| | Betriebs App | Kundenwebsite |
|---|---|---|
| Für wen | Inhaber und Mitarbeiter der Werkstatt | Kunden, ohne Anmeldung |
| Gerät | Tablet zuerst, auch am Handy, als Web App installierbar | Handy zuerst, schnell auch auf älteren Handys |
| Zweck | Aufträge verwalten, Bescheid sagen, Abholungen planen | Stand sehen, Bescheid bekommen, Abholzeit wählen |
| Adresse in der Demo | http://localhost:5173 | http://localhost:5174 (eine zentrale Adresse für alle Betriebe) |

Beide Seiten sprechen mit demselben Backend. Die Demo läuft vollständig lokal. Es wird nichts wirklich verschickt, es gibt kein echtes Hosting und keine echten Zahlungen.

## 3. Die Betriebs App (für Inhaber und Mitarbeiter)

**Anmeldung:** Zwei Demozugänge: Inhaber (`inhaber`) und Mitarbeiter (`mitarbeiter`), beide mit dem Passwort `demo1234`. Inhaber sehen zusätzlich Einstellungen und Mitarbeiterverwaltung.

**Aussehen:** Wie eine Apple App gestaltet (Seitenleiste auf dem Tablet, Tab Leiste auf dem Handy, Dunkelmodus). Das Menü: Aufträge, Neuer Auftrag, Kalender, Nachrichten, Aufsteller, Einstellungen (nur Inhaber), Mitarbeiter (nur Inhaber), Demo.

**Neuer Auftrag (in unter 20 Sekunden):**
* Pflichtangaben sind nur zwei: **Gegenstand** (Freitext) und **Telefonnummer** des Kunden.
* Darunter stehen die **Schnellauswahl Knöpfe** des Betriebs. Jeder Betrieb legt sie selbst an (zum Beispiel "Ölwechsel" oder "Schlauch wechseln"). In der Demo sind "Wartung Paket 1" und "Reifenwechsel (Sommer) mit Einlagerung" hinterlegt.
* Optional unter "Mehr Angaben": Foto, Kundenname, Mailadresse, geplantes Abholdatum, voraussichtliche Fertigstellung.
* Nach dem Speichern erscheint die **Auftragsnummer sehr groß**, damit sie auf den Anhänger geschrieben werden kann. Die Nummer hat sechs Zeichen, wird vom System zufällig vergeben, ist nicht fortlaufend und enthält keine verwechselbaren Zeichen (kein 0, O, 1, I, L).
* Der Kunde bekommt sofort den Statuslink: per Mail, wenn eine Mailadresse erfasst wurde, sonst per SMS an die Telefonnummer (in der Demo simuliert). Der Link führt direkt zu seinem Auftrag.
* Knopf **"Anhänger drucken"**: ein Anhänger mit QR Code und Nummer zum Ausschneiden. Der Kunde scannt und ist sofort bei seinem Auftrag, ohne etwas einzutippen.

**Aufträge (Liste):** Status, Alter in Tagen, Filter (Alle, Offen, Abholbereit, Überfällig, Heute abgeholt) und Suche nach Nummer oder Kundenname. Die Suche nach dem Namen ist der Rückfall, wenn ein Kunde seine Nummer verloren hat.

**Status eines Auftrags:** Angenommen, In Arbeit, Abholbereit, Abgeholt, Überfällig (Abholbereit länger als die Abholfrist) und Storniert. Jeder Statuswechsel wird mit Zeit und Mitarbeiter protokolliert und ist im Auftrag sichtbar.

**Im Auftrag:**
* Großer Knopf **"Abholbereit"**. Er setzt den Status, schaltet die Abholzeit Auswahl für den Kunden frei und löst die eine Nachricht aus, falls der Kunde sich dafür eingetragen hat.
* Weitere Statuswechsel mit einem Tipp: In Arbeit, Abgeholt, Storniert. "Abgeholt" gibt die gebuchte Abholzeit wieder frei.
* Foto, Kontaktdaten, Abholzeit, Statusprotokoll, Zustimmungsprotokoll des Kunden.
* **Mitteilung an den Kunden:** Wenn sich eine Reparatur verzögert, zum Beispiel weil ein Teil bestellt werden muss, schreibt der Mitarbeiter im Auftrag eine kurze Mitteilung. Sie geht per Mail, wenn bei der Annahme eine Mailadresse erfasst wurde, sonst per SMS an die Telefonnummer. Vorher steht dort, an wen und auf welchem Weg sie geht. Mehrfach möglich, bis 500 Zeichen.

**Kalender:** Tageskalender mit Zeitachse. Jede gebuchte Abholung ist ein Balken mit der Auftragsnummer. Mehrere Abholungen zur selben Zeit stehen nebeneinander, der Kalender wird dann breiter. Oben steht "Voraussichtlich fertig" mit den Aufträgen, deren Fertigstellung auf diesen Tag fällt. Ein Tipp auf den Balken zeigt Details und den Knopf "Abgeholt".

**Nachrichten:** Liste aller (simulierten) Nachrichten mit Zeit, Kanal, maskiertem Empfänger, Text, Link und Zustellstatus. Dazu die **Kosten je Nachricht** (Mail 0,00 €, WhatsApp 0,0456 €, SMS 0,075 €), die Monatssumme und die Zahl der Nachrichten pro Auftrag. So sieht der Betrieb, was der Nachrichtenversand kosten würde.

**Aufsteller:** Eine druckbare A5 Vorlage mit großem QR Code der zentralen Seite und drei Schritten ("Nummer vom Anhänger eingeben", "Status sehen", "Bescheid sagen lassen"). Der Aufsteller ist für alle Betriebe gleich, ohne Betriebsnamen, und kann deshalb in großer Stückzahl gedruckt werden (der Betriebsname lässt sich auf Wunsch einsetzen). Ausdrucken über die Druckansicht.

**Einstellungen (nur Inhaber):** Öffnungszeiten je Wochentag (bis zu zwei Zeitfenster pro Tag, zum Beispiel mit Mittagspause), Länge der Abholzeiten (15, 30, 45 oder 60 Minuten), Kapazität pro Abholzeit (1 bis 10), Abholfrist in Tagen, Standardkanal, Text der Abholbereit Nachricht mit Vorschau, Name und Logo des Betriebs, Schnellauswahl für neue Aufträge. Ändert der Inhaber Öffnungszeiten oder Länge der Abholzeiten, werden künftige Buchungen, die nicht mehr passen, freigegeben, und die Kunden wählen auf der Statusseite neu.

**Mitarbeiter (nur Inhaber):** Mitarbeiter anlegen und deaktivieren, einfache Rollen (Inhaber, Mitarbeiter).

**Demo Werkzeuge (nur für die Vorführung):** "Zeit vorspulen um X Tage", damit überfällige Aufträge und die Erinnerung ohne Warten sichtbar werden. "Demodaten zurücksetzen" stellt den Anfangszustand wieder her.

## 4. Die Kundenwebsite (für Kunden, ohne Anmeldung)

**Zentrale Startseite (eine Adresse für alle Betriebe):** Ein großes Eingabefeld für die Auftragsnummer und die letzten vier Ziffern der Telefonnummer, eine kurze Anleitung. Die Eingabe versteht Groß und Kleinschreibung und Leerzeichen. Danach öffnet sich die Seite des richtigen Betriebs mit Name und Logo. Hinweis für Kunden ohne Smartphone: Der Betrieb findet den Auftrag auch über den Namen. Schneller geht es über den Link aus der Statusnachricht oder den QR Code auf dem Anhänger, dann ist keine Eingabe nötig. Die Adresse `/b/<Webname>` gibt es zusätzlich für Betriebe mit eigenem Aufsteller.

**Statusseite `/a/<Nummer>`** (auch als Link aus Nachrichten): Status in einfacher Sprache, Abholzeit, voraussichtliche Fertigstellung (falls gesetzt), Hinweis auf die Abholfrist des Betriebs. Die Seite zeigt **nie** Name, Gegenstand, Foto oder Kontaktdaten des Kunden.

**"Sag mir Bescheid"** (solange der Auftrag nicht abholbereit ist): Der Kunde wählt Mail, SMS oder WhatsApp, trägt seinen Kontakt ein und stimmt der einen Nachricht ausdrücklich zu (Kontrollkästchen, nicht vorangekreuzt). Zeitpunkt und Wortlaut der Zustimmung werden gespeichert. Abbestellen geht per Link oder STOP und wird protokolliert.

**Abholzeit wählen:** Sobald der Auftrag abholbereit ist, sieht der Kunde die freien Abholzeiten der nächsten sieben Tage, erzeugt aus den Öffnungszeiten, der Länge der Abholzeiten und der Kapazität. Er bucht eine Zeit, kann sie ändern oder absagen und sieht seine Bestätigung. Es gibt nur eine Abholzeit pro Auftrag, Doppelbuchungen sind ausgeschlossen. Das geht auch ohne Eintrag bei "Sag mir Bescheid": Wer die Seite wieder öffnet, sieht die Auswahl.

**Weitere Eigenschaften:** Gute Kontraste, große Schrift und Tippflächen, Tastaturbedienung, verständliche Fehlermeldungen, ein Datenschutzhinweis als Platzhalter (klar als Demo gekennzeichnet). Keine Cookies, kein Tracking, keine Aufrufe an Fremddienste. Eine falsche oder unbekannte Nummer zeigt immer dieselbe neutrale Meldung. Nach zu vielen Fehlversuchen wird die Eingabe kurz gesperrt.

## 5. Die Nachrichten

* **Abholbereit Nachricht:** Genau eine pro Auftrag, nur an Kunden, die sich auf der Kundenwebsite eingetragen haben. Rein informativ, ohne Werbung, mit Link zur Abholzeit Auswahl.
* **Erinnerung:** Wird ein abholbereiter Auftrag nach Ablauf der Abholfrist nicht abgeholt, wird er "Überfällig" und der Kunde (wenn eingetragen) bekommt eine einzige Erinnerung. Die Abholfrist stellt der Betrieb ein, in der Demo 14 Tage.
* **Statuslink bei der Annahme:** Immer. Per Mail (kostenlos), wenn der Betrieb eine Mailadresse erfasst hat, sonst per SMS an die Telefonnummer (0,075 € je Auftrag).
* **Mitteilung bei Verzögerung:** Manuell vom Mitarbeiter, an den Kontakt der Annahme (Mail, sonst SMS). Siehe Abschnitt 3.
* Alle Nachrichten sind in der Demo **simuliert**. Es wird nichts versendet.

## 6. Der Demoablauf in drei Minuten

1. **Auftrag anlegen (20 Sekunden):** Betriebs App, als Inhaber anmelden, "Neuer Auftrag", Gegenstand eingeben (oder Schnellauswahl antippen), Telefonnummer eingeben, speichern. Die Nummer erscheint groß.
2. **Kunde fragt den Stand:** Zentrale Kundenwebsite, Nummer und die letzten vier Ziffern der Telefonnummer eingeben (oder den QR Code vom Anhänger scannen). Die Statusseite zeigt "Angenommen", aber keinen Namen und keinen Gegenstand.
3. **Kunde trägt sich ein:** "Sag mir Bescheid", Mail wählen, Adresse eingeben, Haken setzen, absenden.
4. **Betrieb setzt "Abholbereit":** Auftrag öffnen, großer Knopf.
5. **Nachricht erscheint:** Menü "Nachrichten": die simulierte Mail mit Link und Kosten von 0,00 €.
6. **Kunde bucht eine Abholzeit:** Statusseite neu laden, freie Zeiten erscheinen, eine wählen, Bestätigung.
7. **Betrieb sieht die Abholung im Kalender** und setzt "Abgeholt". Die Abholzeit wird wieder frei, der Balken wird grau.
8. **Verzögerung melden (30 Sekunden):** Auftrag öffnen, "Mitteilung an den Kunden", Text schreiben ("Das Ersatzteil ist bestellt, es dauert zwei Tage länger"), senden.
9. **Bonus:** Menü "Demo", "Zeit vorspulen" um 3 Tage: Ein abholbereiter Auftrag wird überfällig und die Erinnerung entsteht. "Aufsteller" zeigt den QR Code zum Ausdrucken.

Vorhandene Demoaufträge für die Kundenwebsite: `D3FY6W` (abholbereit, ohne Eintrag, hier die Abholzeit Auswahl zeigen), `7KP4QX` (abholbereit, Abholzeit gebucht), `RT8WMZ` (überfällig), `H7RT3K` (angenommen, hier "Sag mir Bescheid" zeigen).

## 7. Nutzen für den Betrieb (nur, was die Demo wirklich kann)

* **Weniger Unterbrechungen:** Kunden sehen den Stand selbst, ohne Anruf und ohne Frage am Tresen.
* **Weniger fertige Stücke, die stehen bleiben:** Der Kunde wird informiert, wählt eine Abholzeit, und nach Ablauf der Abholfrist gibt es eine Erinnerung.
* **Kunden sind vorbereitet:** Die Abholzeit passt zu den Öffnungszeiten, der Betrieb sieht im Kalender, wer wann kommt.
* **Verzögerungen sind einfach zu melden:** Eine kurze Mitteilung per Mail oder SMS direkt aus dem Auftrag.
* **Einfach in der Annahme:** Zwei Pflichtangaben, die Nummer kommt auf den Anhänger. Kein neues Kassensystem, keine Umstellung des restlichen Ablaufs.
* **Kosten sind sichtbar:** In der Nachrichtenübersicht steht, was Mail, SMS und WhatsApp kosten würden.
* **Für den Kunden kostenlos und ohne Konto.**

Zahlen zu eingesparter Zeit oder weniger Anrufen gibt es noch nicht. Sie sollten im Pilot gemessen werden und nicht vorab versprochen werden.

## 8. Was in der Demo simuliert ist

* Nachrichten (Mail, SMS, WhatsApp): nichts wird versendet, alles landet nur in der Nachrichtenübersicht.
* Kosten der Nachrichten: sind echte Beispielwerte, aber es entstehen keine.
* Zeit: Das Backend hat eine Demouhr, "Zeit vorspulen" verschiebt sie.
* Hosting: alles läuft lokal. Links und QR Code zeigen auf den eigenen Rechner (`localhost`).
* Daten: ein Demobetrieb ("Werkstatt Demo") mit erfundenen Namen und Kontakten.
* Datenschutzhinweis auf der Kundenseite: Platzhalter.
* STOP Antwort: per Demo Knopf simuliert.

## 9. Was für einen echten Pilot noch fehlt (ehrlich)

Die Demo zeigt das Konzept. Für einen Pilot mit echten Kunden fehlt noch:
* **Echter Versand** von Mail und SMS (Anbieter, Absender, Kosten, Abrechnung der Nachrichten).
* **Echtes Hosting** mit eigener Adresse pro Betrieb, Datensicherung, Betrieb und Support.
* **Rechtliches:** Datenschutzhinweis, Verzeichnis der Verarbeitungstätigkeiten, Auftragsverarbeitungsvertrag mit dem Betrieb, rechtliche Prüfung der Zustimmung und der Pflicht Telefonnummer, Impressum. Das ist in der Demo nicht abgebildet und sollte vor dem Pilot geklärt werden.
* **Preis und Vertrag:** Das Abo (Höhe, Laufzeit, Pilotkonditionen) ist noch nicht festgelegt.
* **Mehrere Betriebe:** Die Demo hat genau einen Betrieb. Für mehrere Pilotbetriebe muss das erweitert werden.
* **Keine Anbindung** an bestehende Werkstattsoftware, Kassen oder Kalender. Daten müssen im Pilot von Hand eingegeben werden.
* Nur Deutsch. WhatsApp ist nur als Wahl des Kunden bei "Sag mir Bescheid" vorgesehen, nicht für Mitteilungen des Betriebs.

Das Konzept wurde noch nicht mit echten Betrieben getestet. Die Rückmeldungen der ersten Pilotkunden sind genau dafür da.

## 10. Hilfe für die Vorbereitung der Pilotanfragen

**Wen ansprechen:** Inhabergeführte Fahrrad und Autowerkstätten, die Annahme und Abholung bisher mit Zetteln, Anhängern oder Anrufen lösen, und bei denen fertige Fahrzeuge oder Räder oft stehen bleiben. Ansprechpartner ist meist der Inhaber oder die Person an der Annahme.

**Der Kern der Ansprache in zwei Sätzen:** "Ihre Kunden fragen nicht mehr an, ob etwas fertig ist, sondern sehen es selbst und wählen ihre Abholzeit. Sie melden mit einem Tipp 'abholbereit', den Rest erledigt das System." Danach ein Angebot für eine kurze Vorführung von etwa drei Minuten.

**Fragen an einen Pilotbetrieb (für das Gespräch):**
* Wie nehmen Sie heute Aufträge an (Zettel, Software, Anhänger)?
* Wie oft fragen Kunden pro Tag oder Woche nach dem Stand? Wer geht ans Telefon?
* Wie lange stehen fertige Fahrzeuge im Schnitt, bis sie abgeholt werden?
* Haben Sie von Kunden meist eine Mailadresse oder nur die Telefonnummer?
* Wie viele Aufträge pro Woche? Wie viele Mitarbeiter an der Annahme?
* Welche Auftragsarten kommen am häufigsten vor (für die Schnellauswahl)?
* Würden Sie die Telefonnummer bei jeder Annahme erfassen?
* Was wäre für Sie ein fairer Preis pro Monat, und was wäre ein Grund, nicht zu starten?

**Typische Einwände und ehrliche Antworten:**
* "Das ist mir zu kompliziert." Beim Anlegen sind nur zwei Angaben nötig, die Nummer kommt auf den Anhänger. Der Rest bleibt wie bisher.
* "Meine Kunden nutzen das nicht." Der Kunde braucht kein Konto und keine App, nur die Nummer vom Anhänger oder den Link aus der Nachricht. Wer kein Smartphone hat, fragt weiter im Laden, der Betrieb findet den Auftrag über den Namen.
* "Datenschutz?" Die Statusseite zeigt keine personenbezogenen Daten, es gibt keine Cookies und kein Tracking, eine Nachricht gibt es nur mit Zustimmung. Der rechtliche Rahmen für den echten Betrieb ist noch zu klären und wird vor dem Pilot gemeinsam abgestimmt (siehe Abschnitt 9). Keine Rechtsberatung versprechen.
* "Was kostet das?" Der Preis steht noch nicht fest. Pilotbetriebe sollen mitbestimmen. Die Nachrichtenkosten sind in der App sichtbar (Mail kostenlos, SMS und WhatsApp mit kleinen Beträgen).
* "Ich habe schon eine Werkstattsoftware." Es ist keine Kasse und keine Auftragsverwaltung im vollen Umfang, sondern der Teil rund um Stand, Bescheid sagen und Abholzeit. Eine Anbindung gibt es noch nicht.
* "Funktioniert das wirklich?" Es ist eine Demo. Darum suchen wir Pilotbetriebe, die mit uns den echten Einsatz erproben.

**Was ein Pilot enthalten könnte (Vorschlag, noch nicht abgestimmt):** Ein bis zwei Betriebe, ein begrenzter Zeitraum (zum Beispiel acht Wochen), Einrichtung gemeinsam, wöchentliches kurzes Feedback, danach gemeinsame Auswertung. Messgrößen: Zahl der Anrufe und Nachfragen am Tresen, Standzeit fertiger Aufträge, Nutzung der Abholzeiten. Konditionen sind offen und müssen vor der Ansprache festgelegt werden.

**Hinweise für Texte, die Claude daraus schreibt:**
* Auf Deutsch, in einfacher, freundlicher Sprache, Sie Form.
* Keine Versprechen zu Einsparungen oder Preisen, die hier nicht stehen. Offene Punkte (Preis, Rechtliches, Pilotbedingungen) ehrlich als offen benennen oder als Platzhalter markieren.
* Die Demo nicht als fertiges Produkt darstellen, sondern als Konzept, das mit Pilotbetrieben echt gemacht wird.
* Der Nutzen für Betrieb und Kunde steht im Vordergrund, nicht die Technik.
* Keine Gedankenstriche in Texten, die Kunden sehen.
