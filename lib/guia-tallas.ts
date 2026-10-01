// lib/guia-tallas.ts
// Contenido de /guia-de-tallas. Datos puros (sin React) para poder testearlos.

export type IconoPrenda =
  | 'zapatilla'
  | 'camiseta'
  | 'pantalon'
  | 'banador'
  | 'sudadera'
  | 'abrigo';

export type Recomendacion = {
  /** Nombre de la prenda, tal cual aparece en la tarjeta y en la tabla resumen. */
  prenda: string;
  /** Frase corta para la tabla resumen. */
  resumen: string;
  /** Viñetas de la tarjeta. */
  detalle: string[];
  /** Clave de icono, resuelta por components/SeccionInfo.tsx. */
  icono: IconoPrenda;
};

export const RECOMENDACIONES: Recomendacion[] = [
  {
    prenda: 'Zapatillas y calzado',
    resumen: 'Tu talla habitual; si dudas, media talla o una más',
    detalle: [
      'Usa tu talla habitual.',
      'Si quieres ir sobre seguro, media talla o una talla más.',
    ],
    icono: 'zapatilla',
  },
  {
    prenda: 'Camisetas',
    resumen:
      'Slim o deportivas +1/+2 · Normales tu talla o +1 · Oversize tu talla · Fútbol (jugador) +1',
    detalle: [
      'Slim o deportivas: +1 o +2 tallas.',
      'Normales: tu talla o +1.',
      'Oversize: tu talla.',
      'Fútbol (versión jugador): +1 sí o sí.',
    ],
    icono: 'camiseta',
  },
  {
    prenda: 'Shorts y pantalones',
    resumen: 'Tu talla habitual; si son deportivos, +1',
    detalle: [
      'Usa tu talla habitual.',
      'Si son deportivos, mejor una talla más.',
    ],
    icono: 'pantalon',
  },
  {
    prenda: 'Calzoncillos y bañadores',
    resumen: 'Vienen pequeños: pide +2 o +3',
    detalle: ['Van pequeños: pide 2 o 3 tallas más.'],
    icono: 'banador',
  },
  {
    prenda: 'Sudaderas y chaquetas',
    resumen: 'Tu talla o +1',
    detalle: ['Tu talla o una talla más.'],
    icono: 'sudadera',
  },
  {
    prenda: 'Abrigos',
    resumen: '+1 o +2 (suelen venir ajustados)',
    detalle: ['Sube una o dos tallas: suelen venir ajustados.'],
    icono: 'abrigo',
  },
];

export type TablaTallas = {
  titulo: string;
  nota?: string;
  columnas: string[];
  /** Unidad por columna, alineada con `columnas` ('' = sin unidad). */
  unidades: string[];
  filas: string[][];
};

export const TABLAS_TALLAS: TablaTallas[] = [
  {
    titulo: 'Versión jugador',
    nota: 'Corte ajustado',
    columnas: ['Talla', 'Largo', 'Pecho', 'Altura', 'Peso'],
    unidades: ['', 'cm', 'cm', 'cm', 'kg'],
    filas: [
      ['S', '70', '92', '160-170', '50-60'],
      ['M', '72', '96', '170-175', '60-70'],
      ['L', '74', '100', '175-180', '70-75'],
      ['XL', '76', '104', '180-185', '75-80'],
      ['2XL', '78', '108', '185-190', '80-90'],
    ],
  },
  {
    titulo: 'Versión aficionado',
    nota: 'Corte holgado',
    columnas: ['Talla', 'Largo', 'Pecho', 'Altura', 'Peso'],
    unidades: ['', 'cm', 'cm', 'cm', 'kg'],
    filas: [
      ['S', '70', '100', '160-170', '50-60'],
      ['M', '72', '104', '165-175', '60-70'],
      ['L', '74', '108', '175-185', '70-80'],
      ['XL', '76', '112', '180-190', '75-90'],
      ['2XL', '78', '116', '185-200', '80-100'],
      ['3XL', '80', '120', '195-210', '90-110'],
      ['4XL', '82', '126', '200-210', '100-120'],
    ],
  },
  {
    titulo: 'Talla infantil',
    nota: 'Referencia por edad y medidas',
    columnas: ['Talla', 'Código', 'Edad', 'Largo', 'Altura', 'Peso'],
    unidades: ['', '', '', 'cm', 'cm', 'kg'],
    filas: [
      ['S', '16', '2-3 años', '43', '90-100', '< 14'],
      ['M', '18', '3-4 años', '47', '100-110', '14-18'],
      ['L', '20', '4-5 años', '50', '110-120', '18-23'],
      ['XL', '22', '6-7 años', '53', '120-130', '23-27'],
      ['2XL', '24', '8-9 años', '56', '130-140', '27-32'],
      ['3XL', '26', '10-11 años', '58', '140-150', '32-36'],
      ['4XL', '28', '12-13 años', '61', '150-160', '36-41'],
    ],
  },
];
