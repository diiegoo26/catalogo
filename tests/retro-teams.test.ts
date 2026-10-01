import { describe, it, expect } from 'vitest';
import { resolverEquipo, normalizar, type EquipoLite } from '../lib/retro/teams';

const equipos: EquipoLite[] = [
  { id: 't1', name: 'FC Barcelona', slug: 'fc-barcelona' },
  { id: 't2', name: 'Manchester United', slug: 'manchester-united' },
  { id: 't3', name: 'Real Madrid', slug: 'real-madrid' },
  { id: 't4', name: 'Celta de Vigo', slug: 'celta-de-vigo' },
  { id: 't5', name: 'Colombia', slug: 'colombia' },
  { id: 't6', name: 'Sevilla FC', slug: 'sevilla-fc' },
  { id: 't7', name: 'Sevilla Atlético', slug: 'sevilla-atletico' },
  { id: 't8', name: 'Alemania', slug: 'alemania' },
  { id: 't9', name: 'Napoli', slug: 'napoli' },
  { id: 't10', name: 'Real Zaragoza', slug: 'real-zaragoza' },
];

describe('normalizar', () => {
  it('lowercases, strips accents and collapses punctuation', () => {
    expect(normalizar('Cádiz')).toBe('cadiz');
    expect(normalizar('M-U')).toBe('m u');
    expect(normalizar('Cel-ta')).toBe('cel ta');
  });
});

describe('resolverEquipo', () => {
  it('matches an exact normalized name', () => {
    expect(resolverEquipo('Real Madrid', equipos)).toEqual({
      estado: 'ok', equipo: { id: 't3', name: 'Real Madrid', slug: 'real-madrid' },
    });
  });
  it('resolves the supplier aliases', () => {
    expect(resolverEquipo('Bar', equipos)).toMatchObject({ estado: 'ok', equipo: { id: 't1' } });
    expect(resolverEquipo('M-U', equipos)).toMatchObject({ estado: 'ok', equipo: { id: 't2' } });
    expect(resolverEquipo('RO', equipos)).toMatchObject({ estado: 'ok', equipo: { id: 't3' } });
    expect(resolverEquipo('Cel-ta', equipos)).toMatchObject({ estado: 'ok', equipo: { id: 't4' } });
    expect(resolverEquipo('Co-lombia', equipos)).toMatchObject({ estado: 'ok', equipo: { id: 't5' } });
    expect(resolverEquipo('Real Madr', equipos)).toMatchObject({ estado: 'ok', equipo: { id: 't3' } });
  });
  it('resolves the English national-team names and the obfuscated clubs', () => {
    expect(resolverEquipo('Germany', equipos)).toMatchObject({ estado: 'ok', equipo: { id: 't8' } });
    expect(resolverEquipo('Napoles', equipos)).toMatchObject({ estado: 'ok', equipo: { id: 't9' } });
    expect(resolverEquipo('Zara-goza', equipos)).toMatchObject({ estado: 'ok', equipo: { id: 't10' } });
  });
  it('never guesses between two candidates', () => {
    const r = resolverEquipo('Sevilla', equipos);
    expect(r.estado).toBe('ambiguo');
  });
  it('reports an unknown team instead of inventing one', () => {
    expect(resolverEquipo('Wakanda FC', equipos)).toEqual({ estado: 'sin-match' });
  });
});
