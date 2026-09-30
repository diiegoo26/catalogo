const hits = new Map<string, number[]>();

export function permitir(key: string, ahora: number = Date.now(), max = 5, ventanaMs = 60_000): boolean {
  const previos = (hits.get(key) ?? []).filter((t) => ahora - t < ventanaMs);
  if (previos.length >= max) {
    hits.set(key, previos);
    return false;
  }
  previos.push(ahora);
  hits.set(key, previos);
  return true;
}

/** Test helper: clears all counters. */
export function limpiarRateLimit(): void {
  hits.clear();
}
