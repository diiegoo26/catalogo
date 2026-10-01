import { esBot } from './bots';

/** Holgado para un visitante que recorre veinte fichas; corto contra el inflado trivial. */
export const LIMITE_VISITAS_HORA = 120;
export const VENTANA_VISITAS_MS = 3_600_000;

export type MotivoSinVisita = 'bot' | 'rate_limited';
export type DecisionVisita = { cuenta: true } | { cuenta: false; motivo: MotivoSinVisita };

/**
 * ¿Esta petición cuenta como visita? El filtro de bots va primero y la cuota se
 * consume solo si la petición es de una persona: un crawler no puede agotarle el
 * cupo a un visitante real.
 */
export function decisionVisita(userAgent: string, consumirCupo: () => boolean): DecisionVisita {
  if (esBot(userAgent)) return { cuenta: false, motivo: 'bot' };
  if (!consumirCupo()) return { cuenta: false, motivo: 'rate_limited' };
  return { cuenta: true };
}
