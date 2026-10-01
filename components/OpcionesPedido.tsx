// components/OpcionesPedido.tsx
'use client';

import Link from 'next/link';

export type Opciones = { talla: string | null; cantidad: number; notas: string };

export const OPCIONES_INICIALES: Opciones = { talla: null, cantidad: 1, notas: '' };
export const CANTIDAD_MAX = 10;
export const NOTAS_MAX = 300;

type Props = { tallas: string[]; valor: Opciones; onChange: (o: Opciones) => void };

export default function OpcionesPedido({ tallas, valor, onChange }: Props) {
  const set = (parcial: Partial<Opciones>) => onChange({ ...valor, ...parcial });

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Talla *</p>
        <div className="flex flex-wrap gap-2">
          {tallas.map((t) => (
            <button key={t} type="button" data-active={valor.talla === t} onClick={() => set({ talla: t })} className="chip">{t}</button>
          ))}
        </div>
        {tallas.length > 1 && (
          <p className="mt-2 text-xs text-muted">
            ¿Dudas con tu talla?{' '}
            <Link href="/guia-de-tallas" className="font-medium text-brand underline underline-offset-2">
              Consulta la guía de tallas
            </Link>
          </p>
        )}
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">Cantidad</span>
        <select value={valor.cantidad} onChange={(e) => set({ cantidad: Number(e.target.value) })} className="field">
          {Array.from({ length: CANTIDAD_MAX }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">Notas (opcional)</span>
        <textarea value={valor.notas} maxLength={NOTAS_MAX} rows={3}
          onChange={(e) => set({ notas: e.target.value })}
          placeholder="¿Algo que debamos saber? (envío, dudas, talla especial…)" className="field" />
      </label>
    </div>
  );
}
