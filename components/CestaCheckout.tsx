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
      <div className="rounded-2xl border border-line bg-mist p-8 text-center">
        <p className="font-display text-lg font-bold">¡Gracias! Te atenderemos lo antes posible</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
          Hemos recibido tu presupuesto. Te responderemos con el precio final y, si hay envío, con su coste.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <DatosCliente valor={datos} onChange={setDatos} />

      <div className="grid gap-3 rounded-2xl border border-line p-4 sm:grid-cols-2">
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
        <p className="text-xs text-muted sm:col-span-2">El envío es un extra; lo añadimos al presupuesto.</p>
      </div>

      <button
        type="button" onClick={enviar} disabled={!listo || estado === 'enviando'}
        className="flex w-full items-center justify-center rounded-full bg-ink py-3.5 font-semibold text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-70"
      >
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
