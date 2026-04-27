// backend/routes/stats.js
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { requireServiceScope } from '../middlewares/role.js';
import { supabase } from '../supabase.js';
import { buildMatrix } from '../services/matrixService.js';
import { cache } from '../middlewares/cache.js';

const router = Router();
router.use(authMiddleware);

router.get('/', requireServiceScope, cache(2 * 60 * 1000), async (req, res) => {
  const { service_id, date_debut, date_fin, cellule_id, agent_ids } = req.query;

  if (!service_id || !date_debut || !date_fin) {
    return res.status(400).json({ error: 'service_id, date_debut et date_fin sont requis' });
  }

  try {
    // ── 1. Construire la matrice (réel + théorique) ────────────────────────────
    const matrix = await buildMatrix(service_id, date_debut, date_fin);
    let { agents, dates } = matrix;

    // ── 2. Filtres agents / cellule ────────────────────────────────────────────
    if (cellule_id) {
      agents = agents.filter(a => String(a.cellule_id) === String(cellule_id));
    }
    if (agent_ids) {
      const ids = agent_ids.split(',').filter(Boolean);
      if (ids.length) agents = agents.filter(a => ids.includes(String(a.agent.id)));
    }

    // ── 3. Codes avec type_code et couleur ────────────────────────────────────
    const { data: codes, error: codesError } = await supabase
      .from('codes_pointage')
      .select('code, libelle, type, bg_color')
      .or(`service_id.eq.${service_id},is_global.eq.true`);
    if (codesError) throw codesError;

    const codesMap = Object.fromEntries((codes || []).map(c => [c.code, c]));

    // ── 4. Calculs (réel sinon théorique) ─────────────────────────────────────
    const parCode  = {};
    const parType  = {};
    const parAgent = {};

    agents.forEach(ag => {
      const aid = ag.agent.id;
      if (!parAgent[aid]) {
        parAgent[aid] = {
          agent_id:   aid,
          nom:        ag.agent.nom,
          prenom:     ag.agent.prenom,
          matricule:  ag.agent.matricule,
          cellule_id: ag.cellule_id,
          parCode:    {},
          total:      0,
        };
      }

      dates.forEach(date => {
        const entry = ag.reel[date] || ag.theorique[date];
        if (!entry?.code) return;

        const code     = entry.code;
        const codeInfo = codesMap[code];

        // parCode
        if (!parCode[code]) parCode[code] = { count: 0, libelle: codeInfo?.libelle ?? code, couleur: codeInfo?.bg_color ?? null, type: codeInfo?.type ?? 'Autre' };
        parCode[code].count++;

        // parType
        const type = codeInfo?.type ?? 'Autre';
        if (!parType[type]) parType[type] = { count: 0, codes: new Set() };
        parType[type].count++;
        parType[type].codes.add(code);

        // parAgent
        parAgent[aid].total++;
        parAgent[aid].parCode[code] = (parAgent[aid].parCode[code] ?? 0) + 1;
      });
    });

    // Sérialiser les Sets
    for (const t of Object.keys(parType)) {
      parType[t].codes = [...parType[t].codes];
    }

    const total    = Object.values(parAgent).reduce((s, a) => s + a.total, 0);
    const nbAgents = Object.keys(parAgent).length;
    const nbJours  = Math.round(
      (new Date(date_fin) - new Date(date_debut)) / (1000 * 60 * 60 * 24)
    ) + 1;

    return res.json({
      meta:     { service_id, date_debut, date_fin, total, nbAgents, nbJours },
      parCode,
      parType,
      parAgent: Object.values(parAgent),
      codesMap,
    });
  } catch (err) {
    console.error('[stats] erreur :', err);
    return res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

export default router;
