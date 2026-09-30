'use client';
import { useState } from 'react';
import DatosCliente, { type Datos } from './DatosCliente';
import { useCesta } from './CestaProvider';
import { telefonoValido } from '@/lib/cliente';
import { PROVINCIAS } from '@/lib/provincias';

const DATOS_VACIOS: Datos = { nombre: '', telefono: '', telegram: '' };
const TELEGRAM_USER = process.env.NEXT_PUBLIC_TELEGRAM_USERNAME;

export default function CestaCheckout() {
  const { items, vaciarCesta } = useCesta();
  const [datos, setDatos] = useState<Datos>(DATOS_VACIOS);
  const [provincia, setProvincia] = useState('');
  const [localidad, setLocalidad] = useState('');
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'enviado' | 'error'>('idle');
  const [copiado, setCopiado] = useState(false);

  const listo = items.length > 0 && datos.nombre.trim() !== '' && telefonoValido(datos.telefono)
    && provincia !== '' && localidad.trim() !== '';

  const copiarPlanB = async () => {
    const texto = [
      'Presupuesto:',
      ...items.map((i, n) => `${n + 1}. ${i.title} — Talla ${i.talla}${i.color ? ` · ${i.color}` : ''} x${i.cantidad}`),
      `Nombre: ${datos.nombre}`,
      `Teléfono: ${datos.telefono}`,
      `Envío: ${localidad} (${provincia})`,
    ].join('\n');
    try { await navigator.clipboard.writeText(texto); setCopiado(true); } catch { /* ignore */ }
  };

  const enviar = async () => {
    setEstado('enviando');
    setCopiado(false);
    try {
      const r = await fetch('/api/presupuesto', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          items,
          cliente: {
            nombre: datos.nombre.trim(),
            telefono: datos.telefono.trim(),
            telegram: datos.telegram.trim() || undefined,
          },
          provincia,
          localidad: localidad.trim(),
          hp: '',
        }),
      });
      if (r.ok) { vaciarCesta(); setEstado('enviado'); return; }
    } catch { /* plan B */ }
    await copiarPlanB();
    setEstado('error');
  };

  if (estado === 'enviado') {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7" />
          </svg>
        </div>
        <p className="mt-4 font-display text-lg font-bold">¡Gracias! Te atenderemos lo antes posible</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
          Hemos recibido tu presupuesto. Te responderemos con el precio final y, si hay envío, con su coste.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DatosCliente valor={datos} onChange={setDatos} />

      <div className="rounded-2xl border border-line p-4">
        <p className="mb-3 font-display text-sm font-bold">Envío</p>
        <div className="grid gap-3">
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Provincia *</span>
            <select value={provincia} onChange={(e) => setProvincia(e.target.value)} className="field">
              <option value="">Elige provincia</option>
              {PROVINCIAS.map((prov) => <option key={prov} value={prov}>{prov}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Localidad *</span>
            <input value={localidad} maxLength={80} onChange={(e) => setLocalidad(e.target.value)}
              placeholder="Tu localidad" className="field" />
          </label>
        </div>
        <p className="mt-2 text-xs text-muted">El envío es un extra; lo añadimos al presupuesto.</p>
      </div>

      <button type="button" onClick={enviar} disabled={!listo || estado === 'enviando'} className="btn btn-brand w-full">
        {estado === 'enviando' ? 'Enviando…' : 'Obtener presupuesto'}
      </button>

      {estado === 'error' && (
        <p className="text-center text-xs text-muted">
          No se pudo enviar. {copiado ? 'Presupuesto copiado: ' : ''}
          {TELEGRAM_USER && (
            <a className="underline" href={`https://t.me/${TELEGRAM_USER}`} target="_blank" rel="noreferrer">escríbenos por Telegram</a>
          )}
        </p>
      )}
    </div>
  );
}
