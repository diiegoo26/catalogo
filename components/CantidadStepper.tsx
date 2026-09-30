'use client';

type Props = {
  valor: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
};

/** Compact − / + quantity control. Replaces a raw number input so the
 * cart stays tappable and the value can never fall outside its range. */
export default function CantidadStepper({ valor, onChange, min = 1, max = 99 }: Props) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <div className="inline-flex items-center rounded-full border border-line">
      <button
        type="button" aria-label="Quitar una unidad" disabled={valor <= min}
        onClick={() => onChange(clamp(valor - 1))}
        className="flex h-9 w-9 items-center justify-center rounded-full text-lg leading-none text-ink transition hover:bg-mist disabled:cursor-not-allowed disabled:opacity-40"
      >
        −
      </button>
      <span aria-live="polite" className="w-8 text-center font-mono text-sm tabular-nums text-ink">{valor}</span>
      <button
        type="button" aria-label="Añadir una unidad" disabled={valor >= max}
        onClick={() => onChange(clamp(valor + 1))}
        className="flex h-9 w-9 items-center justify-center rounded-full text-lg leading-none text-ink transition hover:bg-mist disabled:cursor-not-allowed disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}
