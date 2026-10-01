'use client';
import { useMemo, useState } from 'react';
import BotonAgregar from './BotonAgregar';
import { useCesta } from './CestaProvider';
import OpcionesPedido, { OPCIONES_INICIALES, type Opciones } from './OpcionesPedido';
import { conCalidad } from '@/lib/calidad';
import { tallasParaProducto } from '@/lib/tallas';
import type { Variant } from '@/lib/types';

export { conCalidad };

type Props = {
  title: string;
  variants: Variant[];
  imageUrl?: string;
  categoria: string;
  /** Precio unitario ya resuelto por quien conoce la regla (calidad/categoría).
   * null/undefined = a consultar. */
  precio?: number | null;
};

export default function ProductPurchase({ title, variants, imageUrl, categoria, precio }: Props) {
  const tallas = useMemo(() => tallasParaProducto(categoria, title), [categoria, title]);
  const colors = useMemo(() => [...new Set(variants.map((v) => v.color).filter(Boolean))] as string[], [variants]);
  const [color, setColor] = useState<string | null>(null);
  const [opciones, setOpciones] = useState<Opciones>(OPCIONES_INICIALES);
  const { agregarItem } = useCesta();

  const listo = Boolean(opciones.talla);

  const agregar = () => {
    agregarItem({
      title,
      productUrl: window.location.href,
      imageUrl,
      talla: opciones.talla ?? '',
      cantidad: opciones.cantidad,
      precio,
      color: color ?? undefined,
      notas: opciones.notas.trim() || undefined,
    });
  };

  return (
    <div className="space-y-5">
      <OpcionesPedido tallas={tallas} valor={opciones} onChange={setOpciones} />
      {colors.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Color</p>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => (
              <button key={c} type="button" data-active={color === c} onClick={() => setColor(c)} className="chip">{c}</button>
            ))}
          </div>
        </div>
      )}
      <BotonAgregar onAgregar={agregar} disabled={!listo} label={listo ? 'Agregar a la cesta' : 'Elige una talla'} />
    </div>
  );
}
