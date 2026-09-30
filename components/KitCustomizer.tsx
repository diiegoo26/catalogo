'use client';
import Image from 'next/image';
import { useMemo, useState } from 'react';
import BotonTelegram from './BotonTelegram';
import DatosCliente, { type Datos } from './DatosCliente';
import OpcionesPedido, { OPCIONES_INICIALES, type Opciones } from './OpcionesPedido';
import { telefonoValido } from '@/lib/cliente';
import { LIMITE_NOMBRE } from '@/lib/personalizacion';
import { tallasParaCategoria } from '@/lib/tallas';
import type { PatchBadge, Player, Variant } from '@/lib/types';

const TELEGRAM_USER = process.env.NEXT_PUBLIC_TELEGRAM_USERNAME; // sin @

const limpiarNombre = (v: string) =>
  v.toUpperCase().replace(/[^A-ZÁÉÍÓÚÜÑ\s'’-]/g, '').slice(0, LIMITE_NOMBRE);
const limpiarNumero = (v: string) => v.replace(/\D/g, '').slice(0, 2);

type Props = {
  title: string;
  variants: Variant[];
  players: Player[];       // vacío = club sin plantilla cargada
  patches: PatchBadge[];   // vacío = sin parches (sin suplemento)
  imageUrl?: string;
  categoria: string;
};

export default function KitCustomizer({ title, variants, players, patches, imageUrl, categoria }: Props) {
  const tallas = useMemo(() => tallasParaCategoria(categoria), [categoria]);
  const colors = useMemo(() => [...new Set(variants.map((v) => v.color).filter(Boolean))] as string[], [variants]);
  const [opciones, setOpciones] = useState<Opciones>(OPCIONES_INICIALES);
  const [color, setColor] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [numero, setNumero] = useState('');
  const [jugadorId, setJugadorId] = useState('');
  const [aviso, setAviso] = useState(false);
  const [datos, setDatos] = useState<Datos>({ nombre: '', telefono: '', telegram: '' });
  const [parchesSel, setParchesSel] = useState<string[]>([]);

  const listo = datos.nombre.trim() !== '' && telefonoValido(datos.telefono) && Boolean(opciones.talla);

  const numeroValido = numero === '' || (Number(numero) >= 1 && Number(numero) <= 99);
  const conImpresion = (nombre.trim() !== '' || numero !== '') && numeroValido;

  const elegirJugador = (id: string) => {
    setJugadorId(id);
    if (!id) return;
    const p = players.find((x) => x.id === id);
    if (p) { setNombre(limpiarNombre(p.name)); setNumero(String(p.number)); }
  };

  const pedir = async (): Promise<boolean> => {
    setAviso(false);
    const personalizacion = conImpresion && numeroValido
      ? [nombre && `${nombre}`, numero && `${numero}`, jugadorId ? '(plantilla)' : ''].filter(Boolean).join(' ')
      : undefined;
    const productUrl = window.location.href;
    try {
      const r = await fetch('/api/pedido', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title, productUrl, imageUrl,
          talla: opciones.talla ?? '', cantidad: opciones.cantidad,
          color: color ?? undefined,
          personalizacion,
          parches: parchesSel.length ? parchesSel : undefined,
          notas: opciones.notas.trim() || undefined,
          nombre: datos.nombre.trim(),
          telefono: datos.telefono.trim(),
          telegram: datos.telegram.trim() || undefined,
          hp: '',
        }),
      });
      if (r.ok) return true;
    } catch { /* cae al respaldo */ }

    if (TELEGRAM_USER) {
      const text = [`Hola, quiero pedir: ${title}`, opciones.talla && `Talla: ${opciones.talla}`, `Cantidad: ${opciones.cantidad}`,
        color && `Color: ${color}`, personalizacion && `Personalización: ${personalizacion}`,
        parchesSel.length && `Parches: ${parchesSel.join(', ')}`,
        opciones.notas.trim() && `Notas: ${opciones.notas.trim()}`,
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

      <div className="rounded-2xl border border-line p-4">
        <p className="mb-3 font-display text-sm font-bold">Personaliza tu equipación</p>

        {players.length > 0 && (
          <label className="mb-3 block">
            <span className="mb-1 block text-xs text-muted">Plantilla</span>
            <select value={jugadorId} onChange={(e) => elegirJugador(e.target.value)} className="field">
              <option value="">Personalizado (yo escribo el nombre)</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>{p.number} · {p.name}</option>
              ))}
            </select>
          </label>
        )}

        <div className="grid grid-cols-3 gap-2">
          <label className="col-span-2">
            <span className="mb-1 block text-xs text-muted">Nombre (máx. {LIMITE_NOMBRE})</span>
            <input value={nombre} onChange={(e) => setNombre(limpiarNombre(e.target.value))}
              placeholder="TU NOMBRE" className="field" />
          </label>
          <label>
            <span className="mb-1 block text-xs text-muted">Número</span>
            <input value={numero} inputMode="numeric"
              onChange={(e) => setNumero(limpiarNumero(e.target.value))}
              placeholder="10" className={`field ${numeroValido ? '' : 'border-red-400'}`} />
          </label>
        </div>
        {!numeroValido && <p className="mt-1 text-xs text-red-500">El número debe estar entre 1 y 99.</p>}

        {patches.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs text-muted">Parches de competiciones (opcional)</p>
            <ul className="flex flex-wrap gap-2">
              {patches.map((p) => {
                const activo = parchesSel.includes(p.name);
                return (
                  <li key={p.name}>
                    <button type="button" data-active={activo}
                      onClick={() => setParchesSel((s) => activo ? s.filter((n) => n !== p.name) : [...s, p.name])}
                      className="chip">
                      {p.logo_url && (
                        <Image src={p.logo_url} alt="" width={16} height={16} className="mr-1.5 h-4 w-4 object-contain" />
                      )}
                      {p.name}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <DatosCliente valor={datos} onChange={setDatos} />
      <BotonTelegram onPedir={pedir} resetKey={`${opciones.talla ?? ''}|${opciones.cantidad}|${color ?? ''}|${nombre}|${numero}`}
        disabled={!listo} label={listo ? 'Pedir por Telegram' : 'Rellena talla, nombre y teléfono'} />      {aviso && (
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
