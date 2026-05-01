/**
 * Génère un template Excel d'exemple compatible avec le système d'injection SIPRA.
 *
 * Usage :
 *   node backend/scripts/generate-template-exemple.mjs
 *
 * Le fichier généré est à déposer dans le bucket Supabase : documents/template/
 */

import ExcelJS from 'exceljs';
import path    from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Palette ────────────────────────────────────────────────────────────────
const C = {
  titreBg:   'FF1E3A5F',   // bleu foncé
  titreFg:   'FFFFFFFF',   // blanc
  datesBg:   'FFD6E4F0',   // bleu clair
  datesFg:   'FF1E3A5F',   // bleu foncé
  enteteBg:  'FF2D6E26',   // vert
  enteteFg:  'FFFFFFFF',   // blanc
  ligneImp:  'FFF5F5F5',   // gris très clair (ligne impaire)
  ligneImpB: 'FFFFFFFF',   // blanc (ligne paire)
  bordure:   'FFCCCCCC',   // gris clair
  accentFg:  'FF8DC63F',   // vert accent
};

const thin = (argb = C.bordure) => ({ style: 'thin', color: { argb } });
const border = () => ({ top: thin(), bottom: thin(), left: thin(), right: thin() });

// ── Constantes ─────────────────────────────────────────────────────────────
const NB_COLS_FIXES = 5;          // Cellule | Spéc. | Nom | Prénom | Mat.
const NB_COLS_DATES = 31;         // max jours dans un mois
const TOTAL_COLS    = NB_COLS_FIXES + NB_COLS_DATES;  // = 36

// ── Création du workbook ───────────────────────────────────────────────────
const wb = new ExcelJS.Workbook();
wb.creator  = 'SIPRA';
wb.created  = new Date();

const ws = wb.addWorksheet('Pointages', {
  pageSetup: {
    paperSize:   9,            // A4
    orientation: 'landscape',
    fitToPage:   true,
    fitToWidth:  1,
    fitToHeight: 0,
    margins:     { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
  },
  headerFooter: {
    oddFooter: '&L&"Arial,Italic"&8SIPRA — État de pointage&R&8Page &P / &N',
  },
});

// ── Largeurs de colonnes ───────────────────────────────────────────────────
ws.columns = [
  { width: 16 },   // A — Cellule
  { width: 14 },   // B — Spécialité
  { width: 17 },   // C — Nom
  { width: 14 },   // D — Prénom
  { width: 10 },   // E — Matricule
  // Colonnes dates F à AJ — plus larges pour dd/mm/yyyy en rotation
  ...Array(NB_COLS_DATES).fill({ width: 6 }),
];

// ── Ligne 1 : Titre ────────────────────────────────────────────────────────
ws.addRow([]);   // on configure la cellule directement
ws.mergeCells(1, 1, 1, TOTAL_COLS);
const titre = ws.getCell('A1');
titre.value      = 'ÉTAT DE POINTAGE';
titre.font       = { bold: true, size: 18, color: { argb: C.titreFg }, name: 'Arial' };
titre.fill       = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.titreBg } };
titre.alignment  = { horizontal: 'center', vertical: 'middle' };
ws.getRow(1).height = 30;

// ── Ligne 2 : Infos Service / Période ──────────────────────────────────────
ws.addRow([]);
ws.getRow(2).height = 22;

// "Service :"
const cellServiceLabel = ws.getCell('A2');
cellServiceLabel.value     = 'Service :';
cellServiceLabel.font      = { bold: true, size: 11, name: 'Arial' };
cellServiceLabel.alignment = { vertical: 'middle' };

// {{service_nom}} — marqueur scalaire
ws.mergeCells(2, 2, 2, 4);
const cellService = ws.getCell('B2');
cellService.value     = '{{service_nom}}';        // ← MARQUEUR
cellService.font      = { bold: true, size: 11, color: { argb: C.titreBg }, name: 'Arial' };
cellService.alignment = { vertical: 'middle' };

// "Période :"
const cellPeriodeLabel = ws.getCell('E2');
cellPeriodeLabel.value     = 'Période :';
cellPeriodeLabel.font      = { bold: true, size: 11, name: 'Arial' };
cellPeriodeLabel.alignment = { vertical: 'middle' };

// {{periode_debut}} au {{periode_fin}} — marqueurs scalaires
ws.mergeCells(2, 6, 2, 12);
const cellPeriode = ws.getCell('F2');
cellPeriode.value     = '{{periode_debut}} au {{periode_fin}}';   // ← MARQUEURS
cellPeriode.font      = { bold: true, size: 11, color: { argb: C.titreBg }, name: 'Arial' };
cellPeriode.alignment = { vertical: 'middle' };

// ── Ligne 3 : Séparateur ──────────────────────────────────────────────────
ws.addRow([]);
ws.getRow(3).height = 6;
ws.mergeCells(3, 1, 3, TOTAL_COLS);
ws.getCell('A3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.accentFg } };

// ── Ligne 4 : En-têtes colonnes ────────────────────────────────────────────
ws.addRow([]);
ws.getRow(4).height = 72;  // hauteur pour les dates en rotation verticale

const ENTETES_FIXES = ['Cellule', 'Spécialité', 'Nom', 'Prénom', 'Matricule'];
ENTETES_FIXES.forEach((label, i) => {
  const cell      = ws.getRow(4).getCell(i + 1);
  cell.value      = label;
  cell.font       = { bold: true, size: 10, color: { argb: C.enteteFg }, name: 'Arial' };
  cell.fill       = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.enteteBg } };
  cell.alignment  = { horizontal: 'center', vertical: 'middle' };
  cell.border     = border();
});

// Colonne 6 : marqueur ##DATES## — les dates dd/mm/yyyy s'injectent à partir d'ici
// La rotation verticale permet d'afficher dd/mm/yyyy dans une colonne étroite
const cellDates = ws.getRow(4).getCell(NB_COLS_FIXES + 1);
cellDates.value     = '##DATES##';                // ← MARQUEUR
cellDates.font      = { bold: true, size: 8, color: { argb: C.datesFg }, name: 'Arial' };
cellDates.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.datesBg } };
cellDates.alignment = { textRotation: 90, horizontal: 'center', vertical: 'bottom' };
cellDates.border    = border();

// Colonnes 7-36 : même style (dates 2 à 31)
for (let c = NB_COLS_FIXES + 2; c <= TOTAL_COLS; c++) {
  const cell      = ws.getRow(4).getCell(c);
  cell.fill       = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.datesBg } };
  cell.font       = { bold: true, size: 8, color: { argb: C.datesFg }, name: 'Arial' };
  cell.alignment  = { textRotation: 90, horizontal: 'center', vertical: 'bottom' };
  cell.border     = border();
}

// ── Ligne 5 : Ligne modèle agents ─────────────────────────────────────────
// Cette ligne est supprimée à l'injection et remplacée par les vraies lignes agents.
// Les styles ici définissent l'apparence de CHAQUE ligne agent générée.
ws.addRow([]);
ws.getRow(5).height = 18;

const MARQUEURS_FIXES = ['##cellule##', '##specialite##', '##nom##', '##prenom##', '##matricule##'];
MARQUEURS_FIXES.forEach((marker, i) => {
  const cell      = ws.getRow(5).getCell(i + 1);
  cell.value      = marker;                       // ← MARQUEUR
  cell.font       = { size: 10, name: 'Arial' };
  cell.fill       = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.ligneImp } };
  cell.alignment  = { vertical: 'middle', wrapText: false };
  cell.border     = border();
});

// Colonne 6 : marqueur ##code## — début des codes pointage
const cellCode = ws.getRow(5).getCell(NB_COLS_FIXES + 1);
cellCode.value     = '##code##';                  // ← MARQUEUR
cellCode.font      = { size: 9, name: 'Arial' };
cellCode.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.ligneImp } };
cellCode.alignment = { horizontal: 'center', vertical: 'middle' };
cellCode.border    = border();

// Colonnes 7-36 : même style que ##code##
for (let c = NB_COLS_FIXES + 2; c <= TOTAL_COLS; c++) {
  const cell      = ws.getRow(5).getCell(c);
  cell.fill       = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.ligneImp } };
  cell.font       = { size: 9, name: 'Arial' };
  cell.alignment  = { horizontal: 'center', vertical: 'middle' };
  cell.border     = border();
}

// ── Volets figés ──────────────────────────────────────────────────────────
// 4 lignes d'en-tête + 5 colonnes fixes toujours visibles
ws.views = [{
  state:        'frozen',
  xSplit:       NB_COLS_FIXES,
  ySplit:       4,
  topLeftCell:  'F5',
  activeCell:   'F5',
}];

// ── Feuille README ─────────────────────────────────────────────────────────
const wsDoc = wb.addWorksheet('README');
wsDoc.columns = [{ width: 22 }, { width: 60 }];

const doc = [
  ['SIPRA — Convention des marqueurs'],
  [],
  ['TYPE', 'MARQUEUR / VALEUR'],
  ['Scalaire', '{{service_nom}}  → nom du service'],
  ['Scalaire', '{{periode_debut}}  → date de début (dd/mm/yyyy)'],
  ['Scalaire', '{{periode_fin}}  → date de fin (dd/mm/yyyy)'],
  [],
  ['En-têtes dates', '##DATES##  → 1ère cellule de la ligne dates'],
  [],
  ['Ligne modèle', '##cellule##      → colonne Cellule'],
  ['Ligne modèle', '##specialite##   → colonne Spécialité'],
  ['Ligne modèle', '##nom##          → colonne Nom'],
  ['Ligne modèle', '##prenom##       → colonne Prénom'],
  ['Ligne modèle', '##matricule##    → colonne Matricule'],
  ['Ligne modèle', '##code##         → 1ère colonne codes pointage'],
  [],
  ['RÈGLES', ''],
  ['', '• La ligne contenant ##nom## est la ligne modèle.'],
  ['', '• Elle est supprimée et remplacée par les lignes agents réelles.'],
  ['', '• Ses styles (couleur, police, bordure) sont copiés sur toutes les lignes agents.'],
  ['', '• La ligne contenant ##DATES## doit être immédiatement au-dessus de la ligne modèle.'],
  ['', '• Les marqueurs scalaires {{…}} peuvent être placés dans n\'importe quelle cellule.'],
];

doc.forEach((row, i) => {
  const r = wsDoc.addRow(row);
  if (i === 0) {
    r.getCell(1).font = { bold: true, size: 13 };
  } else if (i === 2) {
    r.eachCell(cell => { cell.font = { bold: true }; });
  }
});

// ── Écriture ──────────────────────────────────────────────────────────────
const outputPath = path.join(__dirname, '..', 'template_pointage_exemple.xlsx');
await wb.xlsx.writeFile(outputPath);

console.log('');
console.log('✓ Template généré avec succès :');
console.log(`  ${outputPath}`);
console.log('');
console.log('Étapes suivantes :');
console.log('  1. Ouvrir le fichier dans Excel pour vérifier/ajuster la mise en forme');
console.log('  2. Uploader dans le bucket Supabase : documents/template/');
console.log('  3. Dans SIPRA > Exports, associer ce template à un état du catalogue');
console.log('');
