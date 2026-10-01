// La calidad (Fans / Jugador) de una equipación forma parte de la línea de la
// cesta: sin ella, una Fans y una Jugador del mismo kit se fusionarían como la
// misma referencia. Vive aquí, y no en el componente, para que la prueba pueda
// importarlo sin arrastrar React.
import type { Calidad } from './precios';

export function conCalidad(title: string, calidad: Calidad): string {
  return `[${calidad === 'jugador' ? 'Jugador' : 'Fans'}] ${title}`;
}