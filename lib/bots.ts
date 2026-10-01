/**
 * User agents que no son una visita real. Los previews de Telegram, WhatsApp y
 * Slack piden la URL compartida sin que nadie llegue a ver la página, así que
 * son los que más distorsionan el contador.
 */
const NO_HUMANO =
  /bot|crawl|spider|slurp|facebookexternalhit|telegram|whatsapp|preview|curl|wget|python-requests|headless|phantomjs|pingdom|gtmetrix|lighthouse|ahrefs|semrush/i;

/**
 * ¿La petición viene de un bot o de un previsualizador? Entonces no cuenta.
 * Un user-agent vacío también cuenta como no humano: ningún navegador omite el suyo.
 */
export function esBot(userAgent: string): boolean {
  if (!userAgent.trim()) return true;
  return NO_HUMANO.test(userAgent);
}
