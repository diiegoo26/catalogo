// scripts/telegram-whoami.mjs
// Prints the chat_id(s) that have messaged the bot, so you can fill TELEGRAM_CHAT_ID.
import { readFileSync } from 'node:fs';

function token() {
  if (process.env.TELEGRAM_BOT_TOKEN) return process.env.TELEGRAM_BOT_TOKEN;
  try {
    const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
    const m = env.match(/^TELEGRAM_BOT_TOKEN=(.+)$/m);
    if (m) return m[1].trim();
  } catch { /* no .env.local */ }
  return '';
}

const t = token();
if (!t) {
  console.error('Falta TELEGRAM_BOT_TOKEN (en el entorno o en .env.local).');
  process.exit(1);
}

const res = await fetch(`https://api.telegram.org/bot${t}/getUpdates`);
const data = await res.json();
if (!data.ok) {
  console.error('Telegram respondió con error:', data.description ?? res.status);
  process.exit(1);
}

const chats = new Map();
for (const u of data.result ?? []) {
  const c = u.message?.chat ?? u.my_chat_member?.chat ?? u.channel_post?.chat;
  if (c) chats.set(c.id, c);
}

if (chats.size === 0) {
  console.log('No hay mensajes todavía. Escribe algo al bot en Telegram y vuelve a ejecutar este script.');
  process.exit(0);
}

for (const [id, c] of chats) {
  const nombre = c.title ?? [c.first_name, c.last_name].filter(Boolean).join(' ');
  console.log(`TELEGRAM_CHAT_ID=${id}   (${nombre}${c.username ? ' @' + c.username : ''})`);
}
