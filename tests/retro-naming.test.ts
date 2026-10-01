import { describe, it, expect } from 'vitest';
import {
  limpiarTitulo, detectarTemporada, detectarKit, esNino,
  candidatosEquipo, renderTitulo, slugify, slugRetro, asignarSlugUnico,
} from '../lib/retro/naming';

describe('limpiarTitulo', () => {
  it('strips the supplier boilerplate and collapses whitespace', () => {
    expect(limpiarTitulo('2002 Dortmund Retro Away vintage football shirt retro soccer jersey camiseta de fútbol retro'))
      .toBe('2002 Dortmund Away');
  });
  it('strips the size range', () => {
    expect(limpiarTitulo('05-06 Chelsea home retro jersey S-XXL')).toBe('05-06 Chelsea home');
    expect(limpiarTitulo('Bar 125th retro model S-4XL')).toBe('Bar 125th');
  });
});

describe('detectarTemporada', () => {
  it('reads a 4-digit year', () => {
    expect(detectarTemporada('2014 Argentina home')).toBe('2014');
  });
  it('expands a 2-digit range', () => {
    expect(detectarTemporada('05-06 Chelsea home')).toBe('2005-06');
    expect(detectarTemporada('97/99 Newcastle home')).toBe('1997-99');
    expect(detectarTemporada('86/87 Napoles home')).toBe('1986-87');
  });
  it('expands a leading 2-digit year', () => {
    expect(detectarTemporada('02 Brazil away')).toBe('2002');
    expect(detectarTemporada('98 England home')).toBe('1998');
  });
  it('returns null when there is no year', () => {
    expect(detectarTemporada('Newcastle model')).toBeNull();
    expect(detectarTemporada('M-U Casual Red')).toBeNull();
  });
});

describe('detectarKit', () => {
  it('reads the kit and the qualifiers', () => {
    expect(detectarKit('2002 Dortmund away')).toEqual({ kit: 'visitante', mangaLarga: false, versionJugador: false });
    expect(detectarKit('04-05 Arsenal home long sleeves')).toEqual({ kit: 'local', mangaLarga: true, versionJugador: false });
    expect(detectarKit('M-U casual red player version long sleeve')).toEqual({ kit: 'local', mangaLarga: true, versionJugador: true });
    expect(detectarKit('mexico pink GK')).toEqual({ kit: 'portero', mangaLarga: false, versionJugador: false });
    expect(detectarKit('Bar 125th')).toEqual({ kit: 'aniversario', mangaLarga: false, versionJugador: false });
  });
  it('defaults to local', () => {
    expect(detectarKit('Newcastle model').kit).toBe('local');
  });
});

describe('esNino', () => {
  it('detects kid albums', () => {
    expect(esNino('98 England home kid kit size 16-28')).toBe(true);
    expect(esNino('BAR X TRAVIS SCOTT KID KIT')).toBe(true);
    expect(esNino('Bayern retro model kid kit')).toBe(true);
  });
  it('does not flag adult kits', () => {
    expect(esNino('1998 England home')).toBe(false);
  });
});

describe('candidatosEquipo', () => {
  it('offers the longest team candidate first, dropping the season and the qualifiers', () => {
    expect(candidatosEquipo('2002 Dortmund away', '2002')[0]).toBe('Dortmund');
    expect(candidatosEquipo('M-U casual red player version long sleeve', null)[0]).toBe('M-U');
    expect(candidatosEquipo('Real Madrid black model', null)[0]).toBe('Real Madrid');
  });
  it('drops colour words', () => {
    expect(candidatosEquipo('Newcastle white model', null)[0]).toBe('Newcastle');
  });
});

describe('renderTitulo', () => {
  it('renders the storefront style', () => {
    expect(renderTitulo({ kit: 'visitante', equipo: 'Borussia Dortmund', temporada: '2002', mangaLarga: false, versionJugador: false }))
      .toBe('Equipación retro visitante Borussia Dortmund 2002');
  });
  it('omits a missing season', () => {
    expect(renderTitulo({ kit: 'local', equipo: 'Newcastle', temporada: null, mangaLarga: false, versionJugador: false }))
      .toBe('Equipación retro local Newcastle');
  });
  it('adds the qualifier suffixes', () => {
    expect(renderTitulo({ kit: 'local', equipo: 'Arsenal', temporada: '2005-06', mangaLarga: true, versionJugador: true }))
      .toBe('Equipación retro local Arsenal 2005-06 (manga larga, versión jugador)');
  });
});

describe('slugify', () => {
  it('strips accents and punctuation', () => {
    expect(slugify('Cádiz')).toBe('cadiz');
  });
});

describe('slugRetro', () => {
  it('builds a stable slug from the team, season and kit', () => {
    expect(slugRetro({ equipoSlug: 'borussia-dortmund', titulo: 'x', temporada: '2002', kit: 'visitante' }))
      .toBe('retro-borussia-dortmund-2002-visitante');
  });
  it('falls back to the title when the team is unresolved, and never emits a double hyphen', () => {
    expect(slugRetro({ equipoSlug: null, titulo: 'Newcastle model', temporada: null, kit: 'local' }))
      .toBe('retro-newcastle-model');
  });
});

describe('asignarSlugUnico', () => {
  it('suffixes on collision', () => {
    const usados = new Set<string>(['retro-newcastle-local']);
    expect(asignarSlugUnico('retro-newcastle-local', usados)).toBe('retro-newcastle-local-2');
    expect(asignarSlugUnico('retro-newcastle-local', usados)).toBe('retro-newcastle-local-3');
  });
  it('keeps a free slug untouched', () => {
    expect(asignarSlugUnico('retro-arsenal-1992-local', new Set())).toBe('retro-arsenal-1992-local');
  });
});
