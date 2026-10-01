'use client';
import { useState } from 'react';
import PrecioSelector from './PrecioSelector';
import ProductPurchase from './ProductPurchase';
import { conCalidad } from '@/lib/calidad';
import { precioDe, type Calidad } from '@/lib/precios';
import type { Variant } from '@/lib/types';

/**
 * Compra de una equipación que no llega al personalizador (temporadas antiguas):
 * el selector de calidad sigue siendo obligatorio porque de él depende el
 * precio, y el prefijo del título deja la calidad registrada en la cesta.
 */
export default function CompraEquipacion({
  title,
  variants,
  imageUrl,
  categoria,
}: {
  title: string;
  variants: Variant[];
  imageUrl?: string;
  categoria: string;
}) {
  const [calidad, setCalidad] = useState<Calidad>('fans');

  return (
    <div className="space-y-5">
      <PrecioSelector valor={calidad} onChange={setCalidad} />
      <ProductPurchase
        title={conCalidad(title, calidad)}
        variants={variants}
        imageUrl={imageUrl}
        categoria={categoria}
        precio={precioDe(categoria, null, calidad)}
      />
    </div>
  );
}