#!/usr/bin/env node
// scripts/setup-hooks.mjs
//
// Apunta git a los hooks versionados de .githooks/ para que el candado de
// claves exista en cualquier clon, no solo en la máquina de quien lo creó.
// Lo corre `npm install` a través del script "prepare".
//
// Nunca rompe la instalación: si no hay git o el comando falla, sigue.

import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const hook = fileURLToPath(new URL('../.githooks/pre-commit', import.meta.url));

try {
  execFileSync('git', ['rev-parse', '--git-dir'], { stdio: 'ignore' });
} catch {
  process.exit(0); // tarball o imagen sin .git: no hay hooks que instalar
}

try {
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'inherit' });
  if (process.platform !== 'win32' && existsSync(hook)) chmodSync(hook, 0o755);
  console.log('✓ hooks de git activados (.githooks/pre-commit)');
} catch (error) {
  console.warn(`⚠ no se pudieron activar los hooks de git: ${error.message}`);
}
