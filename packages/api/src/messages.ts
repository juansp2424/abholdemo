import { CHANNEL_COST_EUR, statusUrl, type BusinessSettings, type Channel, type MessageType } from "@abholdemo/shared";

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
): string {
  const link = statusUrl(settings.webname, code);
  const vars = { betrieb: settings.name, nummer: code, link };
  switch (type) {
    case "STATUSLINK":
      return `Guten Tag, Ihr Auftrag ${code} bei ${settings.name} ist angenommen. Den Stand sehen Sie hier: ${link}`;
    case "ABHOLBEREIT":
      return renderTemplate(settings.messageTemplate, vars) + unsubscribeSuffix(channel, link);
    case "ERINNERUNG":
      return (
        `Guten Tag, Ihr Auftrag ${code} bei ${settings.name} liegt zur Abholung bereit. ` +
        `Bitte holen Sie ihn bald ab. Abholzeit wählen: ${link}` +
        unsubscribeSuffix(channel, link)
      );
  }
}

export const costFor = (channel: Channel) => CHANNEL_COST_EUR[channel];
