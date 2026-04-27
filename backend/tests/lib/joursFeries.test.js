import { describe, it, expect } from 'vitest';
import { easterSunday, feriesMetropole } from '../../lib/joursFeries.js';

describe('easterSunday', () => {
  const known = [
    [2020, '2020-04-12'],
    [2021, '2021-04-04'],
    [2022, '2022-04-17'],
    [2023, '2023-04-09'],
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
  ];

  known.forEach(([year, expected]) => {
    it(`Pâques ${year} = ${expected}`, () => {
      const d = easterSunday(year);
      expect(d.toISOString().split('T')[0]).toBe(expected);
    });
  });
});

describe('feriesMetropole', () => {
  it('retourne exactement 11 jours pour toute année', () => {
    expect(feriesMetropole(2025)).toHaveLength(11);
    expect(feriesMetropole(2000)).toHaveLength(11);
  });

  it('contient les jours fixes pour 2025', () => {
    const feries = feriesMetropole(2025);
    const dates = feries.map(f => f.date);
    expect(dates).toContain('2025-01-01'); // Jour de l'An
    expect(dates).toContain('2025-05-01'); // Fête du Travail
    expect(dates).toContain('2025-05-08'); // Victoire 1945
    expect(dates).toContain('2025-07-14'); // Fête Nationale
    expect(dates).toContain('2025-08-15'); // Assomption
    expect(dates).toContain('2025-11-01'); // Toussaint
    expect(dates).toContain('2025-11-11'); // Armistice
    expect(dates).toContain('2025-12-25'); // Noël
  });

  it('contient les jours mobiles de Pâques pour 2025 (Pâques = 20 avril)', () => {
    const feries = feriesMetropole(2025);
    const dates = feries.map(f => f.date);
    expect(dates).toContain('2025-04-21'); // Lundi de Pâques (P+1)
    expect(dates).toContain('2025-05-29'); // Ascension (P+39)
    expect(dates).toContain('2025-06-09'); // Lundi de Pentecôte (P+50)
  });

  it('toutes les dates sont au format YYYY-MM-DD', () => {
    const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
    feriesMetropole(2025).forEach(f => {
      expect(f.date).toMatch(ISO_DATE);
    });
  });

  it('chaque entrée a date et libelle', () => {
    feriesMetropole(2025).forEach(f => {
      expect(f).toHaveProperty('date');
      expect(f).toHaveProperty('libelle');
      expect(typeof f.libelle).toBe('string');
    });
  });
});
