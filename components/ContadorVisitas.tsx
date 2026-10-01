'use client';
import { useEffect, useRef } from 'react';

/** Avisa de una visita al montar. No pinta nada: solo dispara el registro. */
export default function ContadorVisitas() {
  const reportado = useRef(false);

  useEffect(() => {
    // El doble montaje de StrictMode en desarrollo contaría dos veces la misma visita.
    if (reportado.current) return;
    reportado.current = true;

    const url = '/api/visita';
    if (navigator.sendBeacon?.(url)) return;
    void fetch(url, { method: 'POST', keepalive: true }).catch(() => {});
  }, []);

  return null;
}
