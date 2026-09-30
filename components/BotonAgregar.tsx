'use client';
import { useState } from 'react';

type Props = { onAgregar: () => void; disabled?: boolean; label?: string };

export default function BotonAgregar({ onAgregar, disabled = false, label = 'Agregar a la cesta' }: Props) {
  const [anadido, setAnadido] = useState(false);
  const pulsar = () => {
    onAgregar();
    setAnadido(true);
    window.setTimeout(() => setAnadido(false), 2000);
  };
  return (
    <button
      type="button" onClick={pulsar} disabled={disabled}
      className="flex w-full items-center justify-center gap-2 rounded-full bg-ink py-3.5 font-semibold text-white shadow-[0_12px_26px_-14px_rgba(11,16,48,0.7)] transition hover:bg-ink/90 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70"
    >
      {anadido ? 'Añadido a la cesta ✓' : label}
    </button>
  );
}
