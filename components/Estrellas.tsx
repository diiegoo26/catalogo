/** Estrellas de puntuación. La nota media se rellena de forma parcial y exacta. */
export default function Estrellas({
  valor,
  className = 'h-4 w-4',
}: {
  valor: number;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (valor / 5) * 100));
  return (
    <span className="relative inline-flex align-middle" role="img" aria-label={`${valor} de 5`}>
      <Fila className={`${className} text-line`} />
      <span aria-hidden className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${pct}%` }}>
        <Fila className={`${className} text-bolt2`} />
      </span>
    </span>
  );
}

function Fila({ className }: { className: string }) {
  return (
    <span className="inline-flex whitespace-nowrap">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} viewBox="0 0 24 24" fill="currentColor" aria-hidden className={`${className} shrink-0`}>
          <path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.44 6.19 20.5l1.11-6.47L2.6 9.45l6.5-.95z" />
        </svg>
      ))}
    </span>
  );
}
