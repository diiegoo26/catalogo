// components/ProductPurchase.tsx
'use client';
import { useMemo, useState } from 'react';
import BotonTelegram from './BotonTelegram';
import DatosCliente, { type Datos } from './DatosCliente';
import OpcionesPedido, { OPCIONES_INICIALES, type Opciones } from './OpcionesPedido';
import { telefonoValido } from '@/lib/cliente';
import { tallasParaCategoria } from '@/lib/tallas';
import type { Variant } from '@/lib/types';

const TELEGRAM_USER = process.env.NEXT_PUBLIC_TELEGRAM_USERNAME; // sin @ — solo respaldo
const DATOS_VACIOS: Datos = { nombre: '', telefono: '', telegram: '' };

export default function ProductPurchase({ title, variants, imageUrl, categoria }: {
  title: string; variants: Variant[]; imageUrl?: string; categoria: string;
}) {
  const tallas = useMemo(() => tallasParaCategoria(categoria), [categoria]);
  const colors = useMemo(() => [...new Set(variants.map((v) => v.color).filter(Boolean))] as string[], [variants]);
  const [color, setColor] = useState<string | null>(null);
  const [opciones, setOpciones] = useState<Opciones>(OPCIONES_INICIALES);
  const [datos, setDatos] = useState<Datos>(DATOS_VACIOS);
  const [aviso, setAviso] = useState(false);

  const listo = datos.nombre.trim() !== '' && telefonoValido(datos.telefono) && Boolean(opciones.talla);

  const pedir = async (): Promise<boolean> => {
    setAviso(false);
    const productUrl = window.location.href;
    try {
      const r = await fetch('/api/pedido', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title, productUrl, imageUrl,
          talla: opciones.talla ?? '', cantidad: opciones.cantidad,
          color: color ?? undefined,
          notas: opciones.notas.trim() || undefined,
          nombre: datos.nombre.trim(),
          telefono: datos.telefono.trim(),
          telegram: datos.telegram.trim() || undefined,
          hp: '',
        }),
      });
      if (r.ok) return true;
    } catch { /* cae al respaldo */ }

    // Plan B: copiar el pedido y ofrecer el chat directo
    if (TELEGRAM_USER) {
      const text = [`Hola, quiero pedir: ${title}`, opciones.talla && `Talla: ${opciones.talla}`, `Cantidad: ${opciones.cantidad}`,
        color && `Color: ${color}`, opciones.notas.trim() && `Notas: ${opciones.notas.trim()}`,
        `Nombre: ${datos.nombre}`, `Teléfono: ${datos.telefono}`, productUrl].filter(Boolean).join('\n');
      try { await navigator.clipboard.writeText(text); setAviso(true); } catch { /* ignore */ }
    }
    return false;
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
      <DatosCliente valor={datos} onChange={setDatos} />
      <BotonTelegram onPedir={pedir} resetKey={`${opciones.talla ?? ''}|${opciones.cantidad}|${color ?? ''}`}
        disabled={!listo} label={listo ? 'Pedir por Telegram' : 'Rellena talla, nombre y teléfono'} />
      {aviso && (
        <p className="text-center text-xs text-muted">
          No se pudo enviar. Mensaje copiado:{' '}
          <a className="underline" href={`https://t.me/${TELEGRAM_USER}`} target="_blank" rel="noreferrer">
            pégalo en Telegram
          </a>.
        </p>
      )}
    </div>
  );
}
