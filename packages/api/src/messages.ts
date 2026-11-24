import { CHANNEL_COST_EUR, orderUrl, type BusinessSettings, type Channel, type MessageType } from "@abholdemo/shared";

/** p***@beispiel.de, +49 *** ****12 */
export function maskContact(channel: Channel, contact: string): string {
  if (channel === "MAIL") {
    const at = contact.indexOf("@");
    return at <= 0 ? "***" : `${contact[0]}***${contact.slice(at)}`;
  }
  const trimmed = contact.trim();
  const last2 = trimmed.replace(/\D/g, "").slice(-2);
  const prefix = /^\+\d{2}/.test(trimmed) ? `${trimmed.slice(0, 3)} ` : "";
  return `${prefix}*** ****${last2}`;
}

export function renderTemplate(template: string, vars: { betrieb: string; nummer: string; link: string }): string {
  return template
    .replace(/\{betrieb\}/g, () => vars.betrieb)
    .replace(/\{nummer\}/g, () => vars.nummer)
    .replace(/\{link\}/g, () => vars.link);
}

export function unsubscribeSuffix(channel: Channel, link: string): string {
  return channel === "MAIL"
    ? ` Keine Nachricht mehr? Abbestellen: ${link}?abmelden=1`
    : " Antworten Sie STOP, dann bekommen Sie keine Nachricht mehr.";
}

/** Builds the simulated message text. Never contains item, name or photo. */
export function buildMessageText(
  type: MessageType,
  code: string,
  channel: Channel,
  settings: Pick<BusinessSettings, "name" | "webname" | "messageTemplate">,
  freeText = "",
): string {
  const link = orderUrl(code);
  const vars = { betrieb: settings.name, nummer: code, link };
  switch (type) {
    case "STATUSLINK":
      return `Guten Tag, Ihr Auftrag ${code} bei ${settings.name} ist angenommen. Den Stand sehen Sie hier: ${link}`;
    case "ABHOLBEREIT":
      return renderTemplate(settings.messageTemplate, vars) + unsubscribeSuffix(channel, link);
    case "MITTEILUNG":
      return `Mitteilung zu Ihrem Auftrag ${code} von ${settings.name}: ${freeText} Den Stand sehen Sie hier: ${link}`;
    // Cost estimate messages never contain the amount or the description; freeText is a date or a word.
    case "KOSTENVORANSCHLAG":
      return `Guten Tag, zu Ihrem Auftrag ${code} bei ${settings.name} liegt ein Kostenvoranschlag vor. Bitte prüfen und freigeben oder ablehnen bis ${freeText}: ${link}`;
    case "KV_ERINNERUNG":
      return `Guten Tag, zu Ihrem Auftrag ${code} bei ${settings.name} wartet ein Kostenvoranschlag auf Ihre Antwort. Er gilt bis ${freeText}: ${link}`;
    case "KV_ENTSCHEIDUNG":
      return `Guten Tag, wir haben Ihre Entscheidung zu Auftrag ${code} bei ${settings.name} erhalten: Kostenvoranschlag ${freeText}. Den Stand sehen Sie hier: ${link}`;
    case "NEUES_DATUM": {
      // freeText: "TT.MM.JJJJ" plus optional "\n" and the reason
      const [date, note] = freeText.split("\n");
      return `Guten Tag, Ihr Auftrag ${code} bei ${settings.name} wird voraussichtlich am ${date} fertig.${note ? ` ${note}` : ""} Den Stand sehen Sie hier: ${link}`;
    }
    case "ERINNERUNG":
      return (
        `Guten Tag, Ihr Auftrag ${code} bei ${settings.name} liegt zur Abholung bereit. ` +
        `Bitte holen Sie ihn bald ab. Abholzeit wählen: ${link}` +
        unsubscribeSuffix(channel, link)
      );
    default:
      throw new Error(`${type} is an appointment message, see appointmentText`);
  }
}

/** Texts for drop-off appointments. `when` is e.g. "Mittwoch, 25.11.2026, 09:00 Uhr". No name, no item. */
export function appointmentText(type: MessageType, businessName: string, when: string, link: string): string {
  switch (type) {
    case "TERMIN_BESTAETIGUNG":
      return `Guten Tag, Ihr Termin zum Abgeben bei ${businessName} ist gebucht: ${when}. Absagen oder ändern: ${link}`;
    case "TERMIN_ERINNERUNG":
      return `Guten Tag, morgen ist Ihr Termin zum Abgeben bei ${businessName}: ${when}. Absagen oder ändern: ${link}`;
    case "TERMIN_GEAENDERT":
      return `Guten Tag, Ihr Termin zum Abgeben bei ${businessName} ist geändert auf ${when}. Absagen oder ändern: ${link}`;
    case "TERMIN_ABSAGE":
      return `Guten Tag, ${businessName} muss Ihren Termin am ${when} leider absagen. Bitte buchen Sie einen neuen Termin: ${link}`;
    default:
      throw new Error(`not an appointment message: ${type}`);
  }
}

/** "Mittwoch, 25.11.2026, 09:00 Uhr" in the server's local time (opening hours are local too). */
export function whenText(startIso: string): string {
  const d = new Date(startIso);
  const day = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
  const time = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  return `${day}, ${time} Uhr`;
}

export const costFor = (channel: Channel) => CHANNEL_COST_EUR[channel];
