// Algorithme grégorien anonyme — Dimanche de Pâques
export function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 86400000);
}

function toStr(date) {
  return date.toISOString().split('T')[0];
}

export function feriesMetropole(year) {
  const p = easterSunday(year);
  return [
    { date: toStr(new Date(Date.UTC(year,  0,  1))), libelle: "Jour de l'An" },
    { date: toStr(addDays(p,  1)),                   libelle: 'Lundi de Pâques' },
    { date: toStr(new Date(Date.UTC(year,  4,  1))), libelle: 'Fête du Travail' },
    { date: toStr(new Date(Date.UTC(year,  4,  8))), libelle: 'Victoire 1945' },
    { date: toStr(addDays(p, 39)),                   libelle: 'Ascension' },
    { date: toStr(addDays(p, 50)),                   libelle: 'Lundi de Pentecôte' },
    { date: toStr(new Date(Date.UTC(year,  6, 14))), libelle: 'Fête Nationale' },
    { date: toStr(new Date(Date.UTC(year,  7, 15))), libelle: 'Assomption' },
    { date: toStr(new Date(Date.UTC(year, 10,  1))), libelle: 'Toussaint' },
    { date: toStr(new Date(Date.UTC(year, 10, 11))), libelle: 'Armistice 1918' },
    { date: toStr(new Date(Date.UTC(year, 11, 25))), libelle: 'Noël' },
  ];
}
