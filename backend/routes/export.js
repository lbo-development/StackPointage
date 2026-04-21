import { Router } from 'express';
import * as XLSX from 'xlsx';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRole, requireServiceScope } from '../middlewares/role.js';
import { buildMatrix } from '../services/matrixService.js';
import { supabase } from '../supabase.js';

const router = Router();
router.use(authMiddleware);

/**
 * GET /api/export/excel
 * Export Excel de la matrice de pointage
 * Query: service_id, date_debut, date_fin
 */
router.get('/excel', requireServiceScope, async (req, res) => {
  try {
    const serviceId = req.query.service_id || req.scopedServiceId;
    const dateDebut = req.query.date_debut;
    const dateFin = req.query.date_fin;

    if (!serviceId || !dateDebut || !dateFin) {
      return res.status(400).json({ error: 'service_id, date_debut, date_fin requis' });
    }

    const matrix = await buildMatrix(serviceId, dateDebut, dateFin);

    // Récupération du service
    const { data: service } = await supabase.from('services').select('nom').eq('id', serviceId).single();

    const wb = XLSX.utils.book_new();

    // ---- Feuille 1 : Matrice Réel ----
    const headerRow = ['Cellule', 'Spécialité', 'Nom', 'Prénom', 'Matricule', ...matrix.dates];

    const cellulesMap = {};
    matrix.cellules.forEach(c => { cellulesMap[c.id] = c.nom; });
    const specialitesMap = {};
    (matrix.specialites || []).forEach(s => { specialitesMap[s.id] = s.nom; });

    const rows = [headerRow];

    // Trier agents par cellule, spécialité, nom
    const agents = [...matrix.agents].sort((a, b) => {
      const ca = cellulesMap[a.cellule_id] || '';
      const cb = cellulesMap[b.cellule_id] || '';
      if (ca !== cb) return ca.localeCompare(cb);
      return (a.agent.nom + a.agent.prenom).localeCompare(b.agent.nom + b.agent.prenom);
    });

    agents.forEach(ag => {
      const row = [
        cellulesMap[ag.cellule_id] || '',
        specialitesMap[ag.specialite_id] || '',
        ag.agent.nom,
        ag.agent.prenom,
        ag.agent.matricule,
        ...matrix.dates.map(d => ag.reel[d]?.code || ag.theorique[d]?.code || '')
      ];
      rows.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Style entête
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cellAddr = XLSX.utils.encode_cell({ r: 0, c: C });
      if (!ws[cellAddr]) continue;
      ws[cellAddr].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '1E3A5F' } },
        alignment: { horizontal: 'center' }
      };
    }

    // Largeurs colonnes
    ws['!cols'] = [
      { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 10 },
      ...matrix.dates.map(() => ({ wch: 5 }))
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Pointages Réels');

    // ---- Feuille 2 : Cumuls ----
    const cumsHeader = ['Cellule', 'Date', 'Matin', 'Après-midi', 'Nuit', 'Journée'];
    const cumsRows = [cumsHeader];

    Object.entries(matrix.cumuls).forEach(([celluleId, datesCumuls]) => {
      const celluleName = cellulesMap[celluleId] || celluleId;
      Object.entries(datesCumuls).forEach(([date, cums]) => {
        cumsRows.push([celluleName, date, cums.matin, cums.apres_midi, cums.nuit, cums.journee]);
      });
    });

    const wsCums = XLSX.utils.aoa_to_sheet(cumsRows);
    XLSX.utils.book_append_sheet(wb, wsCums, 'Cumuls');

    // Envoi
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `pointages_${service?.nom || serviceId}_${dateDebut}_${dateFin}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);

  } catch (err) {
    console.error('export error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
