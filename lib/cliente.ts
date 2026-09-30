// lib/cliente.ts
export const LIMITE_TELEFONO = 20;
export const LIMITE_TELEGRAM = 32;

/** Keeps digits, +, spaces, dashes, dots and parentheses. */
export const limpiarTelefono = (v: string) =>
  v.replace(/[^\d+\s().-]/g, '').slice(0, LIMITE_TELEFONO);

/** A usable phone number has at least 9 digits. */
export const telefonoValido = (v: string) => (v.match(/\d/g)?.length ?? 0) >= 9;

/** Keeps letters, digits and underscore, with an optional leading @. */
export const limpiarTelegram = (v: string) =>
  v.replace(/[^A-Za-z0-9_@]/g, '').replace(/^@{2,}/, '@').slice(0, LIMITE_TELEGRAM + 1);

/** Optional Telegram username: 5-32 chars [A-Za-z0-9_], with or without @. */
export const telegramValido = (v: string) => v === '' || /^@?[A-Za-z0-9_]{5,32}$/.test(v);

/** Telegram usernames are used without the leading @. */
export const normalizarTelegram = (v: string) => v.trim().replace(/^@/, '');
