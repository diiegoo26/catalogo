const IMPORTADO = /^\s*Producto importado desde\s+https?:\/\/\S+\s*$/i;

export function descripcionVisible(description: string | null | undefined): string | null {
  if (!description) return null;
  const limpio = description
    .split('\n')
    .filter((linea) => !IMPORTADO.test(linea))
    .join('\n')
    .trim();
  return limpio.length > 0 ? limpio : null;
}
