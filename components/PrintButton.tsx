'use client';

/** Botón que lanza el diálogo de impresión del navegador (Guardar como PDF). */
export default function PrintButton({ label = 'Imprimir / Guardar PDF' }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn btn-outline print:hidden">
      {label}
    </button>
  );
}
