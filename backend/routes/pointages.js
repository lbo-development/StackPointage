import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRole, requireServiceScope } from '../middlewares/role.js';
import { buildMatrix } from '../services/matrixService.js';
import { supabase } from '../supabase.js';

const router = Router();

// Toutes les routes nécessitent auth
router.use(authMiddleware);

/**
 * GET /api/pointages/matrix
 * Endpoint principal - retourne la matrice complète
 * Query: service_id, date_debut, date_fin
 */
router.get('/matrix', requireServiceScope, async (req, res) => {
  try {
    const serviceId = req.query.service_id || req.scopedServiceId;
    const dateDebut = req.query.date_debut || getTodayMinus7();
    const dateFin = req.query.date_fin || getTodayPlus7();

    if (!serviceId) {
      return res.status(400).json({ error: 'service_id requis' });
    }

    // Valider que la plage ne dépasse pas 31 jours
    const diff = (new Date(dateFin) - new Date(dateDebut)) / (1000 * 60 * 60 * 24);
    if (diff > 62) {
      return res.status(400).json({ error: 'La plage ne peut dépasser 62 jours' });
    }

    const matrix = await buildMatrix(serviceId, dateDebut, dateFin);
    res.json(matrix);
  } catch (err) {
    console.error('matrix error:', err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

/**
 * POST /api/pointages
 * Saisie d'un pointage réel (1 jour, 1 agent)
 * Rôle: pointeur, admin_service, admin_app
 */
router.post('/', requireRole('admin_app', 'admin_service', 'pointeur'), requireServiceScope, async (req, res) => {
  try {
    const { agent_id, date, code_pointage, commentaire, service_id, cellule_id } = req.body;

    if (!agent_id || !date || !code_pointage) {
      return res.status(400).json({ error: 'agent_id, date, code_pointage requis' });
    }

    // Vérification code existant (is_locked)
    const { data: existing } = await supabase
      .from('pointages')
      .select('id, is_locked')
      .eq('agent_id', agent_id)
      .eq('date', date)
      .maybeSingle();

    if (existing?.is_locked) {
      return res.status(403).json({ error: 'Ce pointage est verrouillé et ne peut pas être modifié' });
    }

    const payload = {
      agent_id, date, code_pointage,
      commentaire: commentaire || null,
      service_id: service_id || req.scopedServiceId,
      cellule_id,
      saisi_par: req.profile.id,
      modifie_par: existing ? req.profile.id : null,
      modifie_le: existing ? new Date().toISOString() : null
    };

    let result;
    if (existing) {
      const { data, error } = await supabase
        .from('pointages')
        .update({ ...payload, saisi_le: undefined })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from('pointages')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    res.json(result);
  } catch (err) {
    console.error('pointage upsert error:', err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

/**
 * POST /api/pointages/periode
 * Saisie en masse sur une période
 * Rôle: pointeur, admin_service, admin_app
 * ⚠️ N'écrase pas les codes is_locked
 */
router.post('/periode', requireRole('admin_app', 'admin_service', 'pointeur'), requireServiceScope, async (req, res) => {
  try {
    const { agent_ids, date_debut, date_fin, code_pointage, commentaire, service_id, cellule_id } = req.body;

    if (!agent_ids?.length || !date_debut || !date_fin || !code_pointage) {
      return res.status(400).json({ error: 'agent_ids, date_debut, date_fin, code_pointage requis' });
    }

    const sid = service_id || req.scopedServiceId;
    const dates = generateDateRange(date_debut, date_fin);

    // Récupérer les pointages verrouillés existants
    const { data: locked } = await supabase
      .from('pointages')
      .select('agent_id, date')
      .in('agent_id', agent_ids)
      .in('date', dates)
      .eq('is_locked', true);

    const lockedSet = new Set((locked || []).map(l => `${l.agent_id}_${l.date}`));

    // Construire les upserts (en excluant les verrouillés)
    const upserts = [];
    for (const agentId of agent_ids) {
      for (const date of dates) {
        const key = `${agentId}_${date}`;
        if (lockedSet.has(key)) continue;
        upserts.push({
          agent_id: agentId,
          date,
          code_pointage,
          commentaire: commentaire || null,
          service_id: sid,
          cellule_id,
          saisi_par: req.profile.id,
          saisi_le: new Date().toISOString()
        });
      }
    }

    if (!upserts.length) {
      return res.json({ message: 'Aucun pointage à modifier (tous verrouillés)', count: 0 });
    }

    const { error } = await supabase
      .from('pointages')
      .upsert(upserts, { onConflict: 'agent_id,date' });

    if (error) throw error;

    res.json({ message: `${upserts.length} pointages enregistrés`, count: upserts.length, skipped: (locked || []).length });
  } catch (err) {
    console.error('periode error:', err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

/**
 * DELETE /api/pointages/:id
 */
router.delete('/:id', requireRole('admin_app', 'admin_service', 'pointeur'), async (req, res) => {
  try {
    const { data: existing } = await supabase
      .from('pointages')
      .select('is_locked')
      .eq('id', req.params.id)
      .single();

    if (existing?.is_locked) {
      return res.status(403).json({ error: 'Pointage verrouillé' });
    }

    const { error } = await supabase.from('pointages').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

function generateDateRange(dateDebut, dateFin) {
  const dates = [];
  let current = new Date(dateDebut);
  const end = new Date(dateFin);
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function getTodayMinus7() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split('T')[0];
}

function getTodayPlus7() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
}

export default router;
