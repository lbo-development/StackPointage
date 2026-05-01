import { Router } from 'express';
import * as XLSX from 'xlsx';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRole, requireServiceScope } from '../middlewares/role.js';
import { exportLimiter } from '../middlewares/rateLimiter.js';
import { buildMatrix } from '../services/matrixService.js';
import { fillTemplate } from '../services/templateExport.js';
import { supabase } from '../supabase.js';

const router = Router();
router.use(authMiddleware);
router.use(exportLimiter);

// Résout le nom exact du bucket Supabase (documents ou document selon la config)
let _resolvedBucket = null;
async function getStorageBucket() {
  if (_resolvedBucket) return _resolvedBucket;
  const { data: buckets } = await supabase.storage.listBuckets();
  const found = (buckets || []).map(b => b.name).find(n => /^documents?$/i.test(n));
  _resolvedBucket = found || 'documents';
  return _resolvedBucket;
}

/**
 * GET /api/export/templates
 * Liste les fichiers .xlsx dans le bucket documents/template
 */
router.get('/templates', async (req, res) => {
  const bucket = await getStorageBucket();
  const { data, error } = await supabase.storage
    .from(bucket)
    .list('template', { sortBy: { column: 'name', order: 'asc' } });

  if (error) {
    console.error('[templates] storage.list error:', error);
    return res.status(500).json({ error: error.message });
  }

  const templates = (data || [])
    .filter(f => f.name && !f.name.startsWith('.') && /\.(xlsx|xltx)$/i.test(f.name))
    .map(f => ({
      path:       `template/${f.name}`,
      nom:        f.name.replace(/\.(xlsx|xltx)$/i, ''),
      updated_at: f.updated_at,
    }));

  res.json(templates);
});

/**
 * GET /api/export/excel
 * Export Excel de la matrice de pointage.
 * Si template_path est fourni, injecte les données dans le template Supabase Storage.
 * Sinon, génère un fichier from scratch (comportement actuel).
 */
router.get('/excel', requireServiceScope, async (req, res) => {
  try {
    const serviceId    = req.query.service_id || req.scopedServiceId;
    const dateDebut    = req.query.date_debut;
    const dateFin      = req.query.date_fin;
    const celluleId    = req.query.cellule_id || null;
    const templatePath = req.query.template_path || null;

    if (!serviceId || !dateDebut || !dateFin) {
      return res.status(400).json({ error: 'service_id, date_debut, date_fin requis' });
    }

    const matrix = await buildMatrix(serviceId, dateDebut, dateFin);

    if (celluleId) {
      matrix.agents = matrix.agents.filter(ag => ag.cellule_id === celluleId);
      const filtered = {};
      if (matrix.cumuls[celluleId]) filtered[celluleId] = matrix.cumuls[celluleId];
      matrix.cumuls = filtered;
    }

    const { data: service } = await supabase.from('services').select('nom').eq('id', serviceId).single();
    const fmtDate = iso => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };

    // Données agents communes aux deux modes
    const cellulesMap   = Object.fromEntries(matrix.cellules.map(c => [c.id, c.nom]));
    const specialitesMap = Object.fromEntries((matrix.specialites || []).map(s => [s.id, s.nom]));

    const agentsSorted = [...matrix.agents].sort((a, b) => {
      const ca = cellulesMap[a.cellule_id] || '';
      const cb = cellulesMap[b.cellule_id] || '';
      if (ca !== cb) return ca.localeCompare(cb, 'fr');
      return (a.agent.nom + a.agent.prenom).localeCompare(b.agent.nom + b.agent.prenom, 'fr');
    });

    const filename = `export_${service?.nom || serviceId}_${dateDebut}_${dateFin}.xlsx`
      .replace(/[^\w.\-_]/g, '_');

    // ── Mode template ──────────────────────────────────────────────
    if (templatePath) {
      const bucket = await getStorageBucket();
      const { data: blob, error: tplErr } = await supabase.storage
        .from(bucket)
        .download(templatePath);

      if (tplErr || !blob) {
        console.error('[export/excel] template download error:', tplErr);
        return res.status(404).json({ error: `Template introuvable : ${templatePath} (bucket: ${bucket})` });
      }

      const templateBuffer = Buffer.from(await blob.arrayBuffer());

      const templateAgents = agentsSorted.map(ag => ({
        cellule_nom:    cellulesMap[ag.cellule_id]    || '',
        specialite_nom: specialitesMap[ag.specialite_id] || '',
        nom:            ag.agent.nom,
        prenom:         ag.agent.prenom,
        matricule:      ag.agent.matricule,
        codes:          Object.fromEntries(
          matrix.dates.map(d => [d, ag.reel[d]?.code || ag.theorique[d]?.code || ''])
        ),
      }));

      const outputBuffer = await fillTemplate(templateBuffer, {
        scalars: {
          service_nom:    service?.nom   || '',
          periode_debut:  fmtDate(dateDebut),
          periode_fin:    fmtDate(dateFin),
        },
        dates:  matrix.dates,
        agents: templateAgents,
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(outputBuffer);
    }

    // ── Mode from scratch (existant) ───────────────────────────────
    const wb        = XLSX.utils.book_new();
    const headerRow = ['Cellule', 'Spécialité', 'Nom', 'Prénom', 'Matricule', ...matrix.dates.map(fmtDate)];
    const rows      = [headerRow];

    agentsSorted.forEach(ag => {
      rows.push([
        cellulesMap[ag.cellule_id]    || '',
        specialitesMap[ag.specialite_id] || '',
        ag.agent.nom,
        ag.agent.prenom,
        ag.agent.matricule,
        ...matrix.dates.map(d => ag.reel[d]?.code || ag.theorique[d]?.code || ''),
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c: C });
      if (ws[addr]) ws[addr].s = {
        font:      { bold: true, color: { rgb: 'FFFFFF' } },
        fill:      { fgColor: { rgb: '1E3A5F' } },
        alignment: { horizontal: 'center' },
      };
    }
    ws['!cols'] = [
      { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 10 },
      ...matrix.dates.map(() => ({ wch: 5 })),
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Pointages Réels');

    const cumsRows = [['Cellule', 'Date', 'Matin', 'Après-midi', 'Nuit', 'Journée']];
    Object.entries(matrix.cumuls).forEach(([cId, datesCumuls]) => {
      const celluleName = cellulesMap[cId] || cId;
      Object.entries(datesCumuls).forEach(([date, cums]) => {
        cumsRows.push([celluleName, fmtDate(date), cums.matin, cums.apres_midi, cums.nuit, cums.journee]);
      });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cumsRows), 'Cumuls');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);

  } catch (err) {
    console.error('export error:', err);
    res.status(500).json({ error: err.message || 'Erreur serveur interne.' });
  }
});

export default router;
