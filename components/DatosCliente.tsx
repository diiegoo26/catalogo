// components/DatosCliente.tsx
'use client';
import { LIMITE_TELEFONO, limpiarTelefono, limpiarTelegram } from '@/lib/cliente';

export type Datos = { nombre: string; telefono: string; telegram: string };

type Props = { valor: Datos; onChange: (d: Datos) => void };

export default function DatosCliente({ valor, onChange }: Props) {
  const set = (parcial: Partial<Datos>) => onChange({ ...valor, ...parcial });

  return (
    <div className="rounded-2xl border border-line p-4">
      <p className="mb-3 font-display text-sm font-bold">Tus datos</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="col-span-2">
          <span className="mb-1 block text-xs text-muted">Nombre *</span>
          <input value={valor.nombre} maxLength={60}
            onChange={(e) => set({ nombre: e.target.value })}
            placeholder="Tu nombre" className="field" />
        </label>
        <label>
          <span className="mb-1 block text-xs text-muted">Teléfono *</span>
          <input value={valor.telefono} inputMode="tel" maxLength={LIMITE_TELEFONO}
            onChange={(e) => set({ telefono: limpiarTelefono(e.target.value) })}
            placeholder="612 345 678" className="field" />
        </label>
        <label>
          <span className="mb-1 block text-xs text-muted">Telegram (opcional)</span>
          <input value={valor.telegram}
            onChange={(e) => set({ telegram: limpiarTelegram(e.target.value) })}
            placeholder="@usuario" className="field" />
        </label>
      </div>
      <p className="mt-2 text-xs text-muted">Usaremos tus datos solo para gestionar tu pedido.</p>
    </div>
  );
}
