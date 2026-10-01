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

  // Clubes que el proveedor escribe a la inglesa o abreviados. Verificados
  // contra `teams`: el destino existe con ese nombre exacto.
  // 'Lis-bon' es el Sporting de Lisboa, que en `teams` figura como 'Sporting CP'.
  'inter': 'Inter de Milán',
  'inter milan': 'Inter de Milán',
  'milan': 'AC Milan',
  'marseille': 'Olympique de Marsella',
  'pa ris': 'Paris Saint-Germain',
  'paris': 'Paris Saint-Germain',
  'de portivo': 'Deportivo de La Coruña',
  'atm': 'Atlético de Madrid',
  'lis bon': 'Sporting CP',

  // Selecciones: el proveedor las nombra en inglés y la tabla `teams` las tiene
  // en español. Sin esto, 1 de cada 5 retro se quedaría sin equipo.
  'germany': 'Alemania',
  'spain': 'España',
  'brazil': 'Brasil',
  'netherlands': 'Países Bajos',
  'netherland': 'Países Bajos',
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

// Por debajo de esta longitud una clave de alias es demasiado corta para usarla
// como prefijo: 'ro' casaría con 'roma', 'rosenborg' o 'romania', y 'mu' con
// media liga. Las claves cortas siguen funcionando, pero solo por igualdad.
const LARGO_MINIMO_PREFIJO = 6;

/**
 * Nombre destino del alias: primero la clave exacta; si no la hay, la clave más
 * larga que sea PREFIJO del candidato.
 *
 * El proveedor pega la palabra siguiente al nombre del equipo y no deja
 * separador: 'Real MadrUCL final', 'Real Madrhome liga', 'Real Madrihome'.
 * Eso es lo que hace falta resolver aquí. Nunca hay fuzzy matching: solo casan
 * las claves escritas a mano en ALIAS_EQUIPO.
 */
function nombreDeAlias(normalizado: string): string | null {
  const exacto = ALIAS_EQUIPO[normalizado];
  if (exacto) return exacto;

  let mejor: string | null = null;
  for (const clave of Object.keys(ALIAS_EQUIPO)) {
    if (clave.length < LARGO_MINIMO_PREFIJO) continue;
    if (normalizado.startsWith(clave) && (mejor === null || clave.length > mejor.length)) mejor = clave;
  }
  return mejor ? ALIAS_EQUIPO[mejor] : null;
}

/**
 * Un equipo solo se asigna cuando exactamente una fila encaja.
 * Cero o varios candidatos => no se adivina: se reporta.
 */
export function resolverEquipo(nombre: string, equipos: EquipoLite[]): Resolucion {
  const normalizado = normalizar(nombre);
  const conAlias = nombreDeAlias(normalizado);
  const clave = conAlias ? normalizar(conAlias) : normalizado;
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
