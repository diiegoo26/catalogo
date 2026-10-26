import { describe, it, expect, afterAll } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

// El hook vive versionado en .githooks/pre-commit. Estas pruebas lo ejecutan en
// repositorios git descartables para comprobar que frena lo que tiene que frenar
// y, igual de importante, que NO frena trabajo legítimo.

const HOOK = resolve(process.cwd(), '.githooks/pre-commit');
const temporales: string[] = [];

function repoNuevo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'kova-hooks-'));
  temporales.push(dir);
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  git('init', '-q');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  mkdirSync(join(dir, '.githooks'), { recursive: true });
  copyFileSync(HOOK, join(dir, '.githooks', 'pre-commit'));
  git('config', 'core.hooksPath', '.githooks');
  return dir;
}

function intentarCommit(dir: string, archivo: string, contenido: string, env: Record<string, string> = {}) {
  const destino = join(dir, archivo);
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, contenido);
  execFileSync('git', ['add', archivo], { cwd: dir, encoding: 'utf8' });
  const r = spawnSync('git', ['commit', '-m', 'prueba'], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return { ok: r.status === 0, salida: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

// Los fixtures se arman en runtime a propósito: si quedaran como literales, el
// propio hook frenaría este archivo. El repo no debe contener nada con forma de
// clave, ni siquiera de mentira.
const JWT_FALSO = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZiIsInJvbGUiOiJhbm9uIn0',
  'firma-de-prueba-1234567890',
].join('.');

const CLAVE_PRIVADA_FALSA = `${['-----BEGIN', 'RSA', 'PRIVATE KEY-----'].join(' ')}\nabc\n`;

afterAll(() => {
  for (const dir of temporales) rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
});

describe('pre-commit: bloquea claves', () => {
  it('rechaza un archivo .env.local', () => {
    const repo = repoNuevo();
    const r = intentarCommit(repo, '.env.local', `NEXT_PUBLIC_SUPABASE_ANON_KEY=${JWT_FALSO}\n`);
    expect(r.ok).toBe(false);
    expect(r.salida).toMatch(/\.env\.local/);
  });

  it('rechaza una clave privada .pem', () => {
    const repo = repoNuevo();
    const r = intentarCommit(repo, 'deploy.pem', CLAVE_PRIVADA_FALSA);
    expect(r.ok).toBe(false);
    expect(r.salida).toMatch(/deploy\.pem/);
  });

  it('rechaza un JWT enterrado en el código', () => {
    const repo = repoNuevo();
    const r = intentarCommit(repo, 'lib/config.ts', `export const KEY = '${JWT_FALSO}';\n`);
    expect(r.ok).toBe(false);
    expect(r.salida).toMatch(/JWT/);
  });

  it('rechaza un token de bot de Telegram real', () => {
    const repo = repoNuevo();
    const token = `TELEGRAM_BOT_TOKEN=${'123456789'}:${'Aa1'.repeat(12)}`;
    const r = intentarCommit(repo, 'apuntes.md', `${token}\n`);
    expect(r.ok).toBe(false);
    expect(r.salida).toMatch(/Telegram/);
  });
});

describe('pre-commit: deja pasar lo legítimo', () => {
  it('acepta una plantilla vacía', () => {
    const repo = repoNuevo();
    const r = intentarCommit(
      repo,
      '.env.local.example',
      'NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co\nNEXT_PUBLIC_SUPABASE_ANON_KEY=<tu anon key>\nTELEGRAM_BOT_TOKEN=123456:ABC-tu-token-de-@BotFather\n',
    );
    expect(r.ok).toBe(true);
  });

  it('acepta código normal', () => {
    const repo = repoNuevo();
    const r = intentarCommit(repo, 'lib/suma.ts', 'export const suma = (a: number, b: number) => a + b;\n');
    expect(r.ok).toBe(true);
  });

  it('acepta documentación que menciona variables sin valores', () => {
    const repo = repoNuevo();
    const r = intentarCommit(
      repo,
      'docs/nota.md',
      'Los secretos viven en `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID`, nunca en `NEXT_PUBLIC_`.\n',
    );
    expect(r.ok).toBe(true);
  });

  it('acepta código que lee la clave del entorno', () => {
    const repo = repoNuevo();
    const r = intentarCommit(
      repo,
      'lib/ocr.ts',
      'const API_KEY = process.env.OCR_API_KEY;\nconst token = process.env.TELEGRAM_BOT_TOKEN;\n',
    );
    expect(r.ok).toBe(true);
  });

  it('permite saltar la revisión de forma explícita', () => {
    const repo = repoNuevo();
    const r = intentarCommit(
      repo,
      '.env.local',
      `NEXT_PUBLIC_SUPABASE_ANON_KEY=${JWT_FALSO}\n`,
      { ALLOW_SECRET_COMMIT: '1' },
    );
    expect(r.ok).toBe(true);
  });
});
