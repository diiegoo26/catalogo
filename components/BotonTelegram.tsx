// components/BotonTelegram.tsx
'use client';
import { useRef, useState } from 'react';

export type Estado = 'idle' | 'enviando' | 'enviado' | 'error';

type Props = {
  onPedir: () => Promise<boolean>;
  resetKey?: string;
  label?: string;
  disabled?: boolean;
};

export default function BotonTelegram({ onPedir, resetKey, label = 'Pedir por Telegram', disabled = false }: Props) {
  const [estado, setEstado] = useState<Estado>('idle');
  const [ultimoResetKey, setUltimoResetKey] = useState(resetKey);
  const enVuelo = useRef(false);

  if (ultimoResetKey !== resetKey) {
    setUltimoResetKey(resetKey);
    setEstado('idle');
  }

  const pulsar = async () => {
    if (enVuelo.current) return;
    enVuelo.current = true;
    setEstado('enviando');
    try {
      const ok = await onPedir();
      setEstado(ok ? 'enviado' : 'error');
    } catch {
      setEstado('error');
    } finally {
      enVuelo.current = false;
    }
  };

  const etiqueta =
    estado === 'enviando' ? 'Enviando…'
    : estado === 'enviado' ? 'Pedido enviado ✓'
    : estado === 'error' ? 'No se pudo enviar. Reintentar'
    : label;

  return (
    <button
      onClick={pulsar}
      disabled={disabled || estado === 'enviando' || estado === 'enviado'}
      className="flex w-full items-center justify-center gap-2 rounded-full bg-[#229ED9] py-3.5 font-semibold text-white shadow-[0_12px_26px_-14px_rgba(34,158,217,0.9)] transition hover:bg-[#1b8dc4] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70"
    >
      <LogoTelegram />
      {etiqueta}
    </button>
  );
}

function LogoTelegram() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
    </svg>
  );
}
