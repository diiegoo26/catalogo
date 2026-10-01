// lib/retro/teams.ts
// Resolución de equipo del proveedor SoccerPlus contra la tabla `teams`.
//
// El proveedor ofusca los nombres con guiones para esquivar filtros:
// 'Cel-ta', 'Valla-dolid', 'Osa-suna', 'Las Pal-mas', 'Co-lombia'.
// Las claves de ALIAS_EQUIPO están YA normalizadas con `normalizar`, que es
// como se consultan; escribir aquí una clave sin normalizar es un fallo.

export type EquipoLite = { id: string; name: string; slug: string };

export const ALIAS_EQUIPO: Record<string, string> = {
  // Abreviaturas y nombres ofuscados con guiones ('Cel-ta', 'Zara-goza').
  'bar': 'FC Barcelona',
  'm u': 'Manchester United',
  'mu': 'Manchester United',
  'ro': 'Real Madrid',
  'real madr': 'Real Madrid',
  'cel ta': 'Celta de Vigo',
  'valla dolid': 'Real Valladolid',
  'osa suna': 'Osasuna',
  'las pal mas': 'Las Palmas',
  'ath bil': 'Athletic Club',
  'co lombia': 'Colombia',
  'vlc': 'Valencia',
  'cdz': 'Cádiz',
  'napoles': 'Napoli',
  'zara goza': 'Real Zaragoza',
  'ma laga': 'Málaga',
  'bayern': 'Bayern de Múnich',

  // Selecciones: el proveedor las nombra en inglés y la tabla `teams` las tiene
  // en español. Sin esto, 1 de cada 5 retro se quedaría sin equipo.
  'germany': 'Alemania',
  'spain': 'España',
  'brazil': 'Brasil',
  'netherlands': 'Países Bajos',
  'holland': 'Países Bajos',
  'belgium': 'Bélgica',
  'japan': 'Japón',
  'england': 'Inglaterra',
  'france': 'Francia',
  'italy': 'Italia',
  'croatia': 'Croacia',
  'morocco': 'Marruecos',
  'mexico': 'México',
  'usa': 'Estados Unidos',
  'united states': 'Estados Unidos',
};

export function normalizar(s: string): string {
  return s
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export type Resolucion =
  | { estado: 'ok'; equipo: EquipoLite }
  | { estado: 'sin-match' }
  | { estado: 'ambiguo'; candidatos: EquipoLite[] };

/**
 * Un equipo solo se asigna cuando exactamente una fila encaja.
 * Cero o varios candidatos => no se adivina: se reporta.
 */
export function resolverEquipo(nombre: string, equipos: EquipoLite[]): Resolucion {
  const normalizado = normalizar(nombre);
  const clave = normalizar(ALIAS_EQUIPO[normalizado] ?? nombre);
  if (!clave) return { estado: 'sin-match' };

  const exactos = equipos.filter((e) => normalizar(e.name) === clave);
  if (exactos.length === 1) return { estado: 'ok', equipo: exactos[0] };
  if (exactos.length > 1) return { estado: 'ambiguo', candidatos: exactos };

  const parciales = equipos.filter((e) => {
    const n = normalizar(e.name);
    return n.includes(clave) || clave.includes(n);
  });
  if (parciales.length === 1) return { estado: 'ok', equipo: parciales[0] };
  if (parciales.length > 1) return { estado: 'ambiguo', candidatos: parciales };

  return { estado: 'sin-match' };
}
