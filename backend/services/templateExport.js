/**
 * Injection de données de pointage dans un template Excel.
 *
 * Convention des marqueurs dans le template :
 *
 * Scalaires (n'importe quelle cellule) :
 *   {{service_nom}}     → nom du service
 *   {{periode_debut}}   → date de début formatée (dd/mm/yyyy)
 *   {{periode_fin}}     → date de fin   formatée (dd/mm/yyyy)
 *
 * Ligne d'en-têtes des dates (une cellule dans cette ligne) :
 *   ##DATES##           → marque la première colonne des dates ;
 *                         le code remplace à partir de là avec les numéros de jours.
 *
 * Ligne modèle des agents (UNE seule ligne, supprimée et remplacée par les agents) :
 *   ##cellule##         → colonne nom de cellule
 *   ##specialite##      → colonne spécialité
 *   ##nom##             → colonne nom agent
 *   ##prenom##          → colonne prénom agent
 *   ##matricule##       → colonne matricule
 *   ##code##            → première colonne des codes pointage (se répète pour chaque date)
 */

import ExcelJS from 'exceljs';

const SCALAR_RE = /\{\{(\w+)\}\}/g;

const MARKERS = {
  dates:      '##DATES##',
  cellule:    '##cellule##',
  specialite: '##specialite##',
  nom:        '##nom##',
  prenom:     '##prenom##',
  matricule:  '##matricule##',
  code:       '##code##',
};

function cloneStyle(style) {
  try { return JSON.parse(JSON.stringify(style ?? {})); } catch { return {}; }
}

// Convertit un numéro de colonne (1-based) en lettre Excel (A, B, ..., Z, AA, ...)
function colLetter(n) {
  let s = '';
  while (n > 0) { s = String.fromCharCode(64 + ((n - 1) % 26 + 1)) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

// Retourne les MFC dont la plage couvre une ligne donnée
function mfcPourLigne(ws, rowNumber) {
  return (ws.conditionalFormattings || []).filter(cf =>
    (cf.ref || '').split(/\s+/).some(ref => {
      const m = ref.match(/\$?[A-Z]+\$?(\d+)(?::\$?[A-Z]+\$?(\d+))?/);
      if (!m) return false;
      const r1 = parseInt(m[1], 10);
      const r2 = m[2] ? parseInt(m[2], 10) : r1;
      return r1 <= rowNumber && r2 >= rowNumber;
    })
  );
}

function cellText(cell) {
  const v = cell.value;
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v.richText) return v.richText.map(r => r.text).join('');
  return String(v);
}

/**
 * @param {Buffer} templateBuffer
 * @param {{ scalars: object, dates: string[], agents: Array }} data
 * @returns {Promise<Buffer>}
 */
export async function fillTemplate(templateBuffer, { scalars, dates, agents }) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBuffer);

  // Trouver la feuille qui contient les marqueurs de structure
  let ws = null;
  workbook.eachSheet(sheet => {
    if (ws) return;
    sheet.eachRow(row => {
      if (ws) return;
      row.eachCell({ includeEmpty: false }, cell => {
        if (ws) return;
        const txt = cellText(cell);
        if (Object.values(MARKERS).some(m => txt.includes(m))) ws = sheet;
      });
    });
  });
  ws = ws || workbook.getWorksheet(1);
  if (!ws) throw new Error('Template vide — aucune feuille trouvée');

  let modelRowNumber = null;
  let dateRowNumber  = null;
  let dateStartCol   = null;
  const colMap       = {};

  // Passe 1 : remplace les scalaires, repère les marqueurs de structure
  ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    let isModelRow = false;

    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const raw = cellText(cell);
      if (!raw) return;

      let newVal = raw.replace(SCALAR_RE, (_, key) => scalars[key] ?? '');

      if (raw.includes(MARKERS.dates)) {
        dateRowNumber = rowNumber;
        dateStartCol  = colNumber;
        newVal = newVal.replace(MARKERS.dates, '').trim() || null;
      }

      for (const [key, marker] of Object.entries(MARKERS)) {
        if (key === 'dates') continue;
        if (raw.includes(marker)) {
          isModelRow  = true;
          colMap[key] = colNumber;
          newVal = (newVal ?? '').replace(marker, '').trim() || null;
        }
      }

      cell.value = newVal;
    });

    if (isModelRow) modelRowNumber = rowNumber;
  });

  // Pas de ligne modèle → retourne le template avec les scalaires remplacés
  if (!modelRowNumber) {
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  const codeStartCol = colMap.code ?? dateStartCol ?? 6;
  const maxCol       = Math.max(codeStartCol + dates.length - 1, ws.columnCount || 0);

  // Passe 2 : capture les styles et les MFC de la ligne modèle avant de la supprimer
  const modelRow    = ws.getRow(modelRowNumber);
  const modelHeight = modelRow.height;
  const styles      = {};
  const codeStyle   = cloneStyle(modelRow.getCell(codeStartCol).style);
  for (let c = 1; c <= maxCol; c++) {
    const s = cloneStyle(modelRow.getCell(c).style);
    styles[c] = (c >= codeStartCol && Object.keys(s).length === 0) ? codeStyle : s;
  }

  // Capture les MFC sur la ligne dates et la ligne modèle AVANT toute modification
  // → étendues après injection pour couvrir toutes les colonnes/lignes injectées
  const mfcDates  = dateRowNumber  ? mfcPourLigne(ws, dateRowNumber)  : [];
  const mfcSurLigneModele = mfcPourLigne(ws, modelRowNumber);

  // Remplir la ligne d'en-têtes dates au format dd/mm/yyyy
  if (dateRowNumber) {
    const dateRow = ws.getRow(dateRowNumber);
    dates.forEach((dateStr, i) => {
      const [y, m, d] = dateStr.split('-');
      dateRow.getCell(codeStartCol + i).value = `${d}/${m}/${y}`;
    });
    dateRow.commit();

    // Étendre les MFC de la ligne dates sur toutes les colonnes injectées
    // (elles ne couvrent initialement que la cellule ##DATES##)
    if (mfcDates.length > 0 && dates.length > 1) {
      const colDebut = colLetter(codeStartCol);
      const colFin   = colLetter(codeStartCol + dates.length - 1);
      mfcDates.forEach(cf => {
        cf.ref = (cf.ref || '').split(/\s+/).map(ref => {
          const m = ref.match(/\$?[A-Z]+\$?(\d+)/);
          if (!m) return ref;
          return `${colDebut}${m[1]}:${colFin}${m[1]}`;
        }).join(' ');
      });
    }
  }

  // Supprimer la ligne modèle
  ws.spliceRows(modelRowNumber, 1);

  // Insérer une ligne par agent avec les styles copiés
  agents.forEach((agent, idx) => {
    const rowValues = new Array(maxCol).fill(null);

    if (colMap.cellule)    rowValues[colMap.cellule    - 1] = agent.cellule_nom    || '';
    if (colMap.specialite) rowValues[colMap.specialite - 1] = agent.specialite_nom || '';
    if (colMap.nom)        rowValues[colMap.nom        - 1] = agent.nom            || '';
    if (colMap.prenom)     rowValues[colMap.prenom     - 1] = agent.prenom         || '';
    if (colMap.matricule)  rowValues[colMap.matricule  - 1] = agent.matricule      || '';

    dates.forEach((dateStr, i) => {
      rowValues[codeStartCol - 1 + i] = agent.codes[dateStr] || '';
    });

    const newRow = ws.insertRow(modelRowNumber + idx, rowValues, 'n');
    if (modelHeight) newRow.height = modelHeight;
    for (let c = 1; c <= maxCol; c++) {
      if (styles[c]) newRow.getCell(c).style = cloneStyle(styles[c]);
    }
    newRow.commit();
  });

  // Étendre les MFC pour couvrir toutes les lignes agents injectées
  // Sans ça, la MFC ne s'applique qu'à la première ligne (position de l'ancienne ligne modèle)
  if (mfcSurLigneModele.length > 0 && agents.length > 1) {
    const lastAgentRow = modelRowNumber + agents.length - 1;
    mfcSurLigneModele.forEach(cf => {
      cf.ref = (cf.ref || '').split(/\s+/).map(ref => {
        // Extrait les colonnes de la plage et remplace les lignes par la plage agents
        const m = ref.match(/(\$?[A-Z]+)\$?\d+(?::(\$?[A-Z]+)\$?\d+)?/);
        if (!m) return ref;
        const colDebut = m[1].replace(/\$/g, '');
        const colFin   = (m[2] || m[1]).replace(/\$/g, '');
        return `${colDebut}${modelRowNumber}:${colFin}${lastAgentRow}`;
      }).join(' ');
    });
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
