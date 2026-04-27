import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRole, requireServiceScope } from '../middlewares/role.js';
import { supabase } from '../supabase.js';
import { PHOTO_MAX_BYTES, detectImageMime } from '../lib/imageUtils.js';

const router = Router();
router.use(authMiddleware);

// GET /api/agents — liste avec tri par cellule → ordre → nom
router.get('/', requireServiceScope, async (req, res) => {
  try {
    const serviceId = req.query.service_id || req.scopedServiceId;
    let query = supabase
      .from('agent_assignments')
      .select(`
        *,
        agents(*),
        cellules(nom, code, couleur, ordre),
        specialites(nom, code, couleur),
        roulements(nom, date_debut_reference)
      `);

    if (serviceId) query = query.eq('service_id', serviceId);
    if (!req.query.include_inactive) query = query.eq('is_active', true);

    // Tri : cellule_id stable, ordre affiné côté frontend par cellules.ordre
    const { data, error } = await query
      .order('cellule_id')
      .order('ordre', { ascending: true })
      .order('agents(nom)', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

// GET /api/agents/sans-affectation?service_id=... — agents sans affectation active dans ce service
router.get('/sans-affectation', requireServiceScope, async (req, res) => {
  try {
    const serviceId = req.query.service_id || req.scopedServiceId;
    if (!serviceId) return res.json([]);

    const { data: assigned } = await supabase
      .from('agent_assignments')
      .select('agent_id')
      .eq('is_active', true);

    const assignedIds = (assigned || []).map(a => a.agent_id);

    let query = supabase
      .from('agents')
      .select('id, matricule, nom, prenom, email, telephone, type_contrat, photo_url')
      .eq('is_active', true)
      .order('nom');

    if (assignedIds.length > 0) {
      query = query.not('id', 'in', `(${assignedIds.join(',')})`);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

// GET /api/agents/:id
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('agents')
      .select(`*, agent_assignments(*, services(*), cellules(*), specialites(*), roulements(*))`)
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

// POST /api/agents — créer agent + affectation (upsert par matricule)
router.post('/', requireRole('admin_app', 'admin_service'), async (req, res) => {
  try {
    const { nom, prenom, matricule, email, telephone, date_embauche, type_contrat, assignment } = req.body;

    // Rechercher un agent existant avec ce matricule
    const { data: existing } = await supabase
      .from('agents')
      .select('id')
      .eq('matricule', matricule)
      .maybeSingle();

    let agent;
    if (existing) {
      // Mettre à jour les infos de l'agent existant et réutiliser son id
      const { data: updated, error: errU } = await supabase
        .from('agents')
        .update({ nom, prenom, email, telephone, type_contrat })
        .eq('id', existing.id)
        .select()
        .single();
      if (errU) throw errU;
      agent = updated;
    } else {
      const { data: created, error: errC } = await supabase
        .from('agents')
        .insert({ nom, prenom, matricule, email, telephone, date_embauche, type_contrat })
        .select()
        .single();
      if (errC) throw errC;
      agent = created;
    }

    if (assignment) {
      const { data: existingInCellule } = await supabase
        .from('agent_assignments')
        .select('ordre')
        .eq('cellule_id', assignment.cellule_id)
        .eq('is_active', true)
        .order('ordre', { ascending: false })
        .limit(1);

      const nextOrdre = existingInCellule?.length
        ? (existingInCellule[0].ordre + 1)
        : 0;

      const { error: errA } = await supabase.from('agent_assignments').insert({
        agent_id: agent.id,
        service_id: assignment.service_id,
        cellule_id: assignment.cellule_id,
        specialite_id: assignment.specialite_id || null,
        roulement_id: assignment.roulement_id || null,
        date_debut: assignment.date_debut,
        ordre: assignment.ordre ?? nextOrdre,
        is_active: true,
        date_debut_reference: assignment.date_debut_reference || null,
      });
      if (errA) throw errA;
    }

    res.status(201).json(agent);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

// PUT /api/agents/assignments/:id — modifier une affectation
router.put('/assignments/:id', requireRole('admin_app', 'admin_service'), async (req, res) => {
  try {
    const { cellule_id, specialite_id, roulement_id, date_debut, date_fin, is_active, date_debut_reference } = req.body;
    const { data, error } = await supabase
      .from('agent_assignments')
      .update({
        cellule_id,
        specialite_id: specialite_id || null,
        roulement_id: roulement_id || null,
        date_debut,
        date_fin: date_fin || null,
        is_active: is_active !== undefined ? is_active : true,
        date_debut_reference: date_debut_reference || null,
      })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

// PUT /api/agents/:id — modifier les infos de l'agent
router.put('/:id', requireRole('admin_app', 'admin_service'), async (req, res) => {
  try {
    const { nom, prenom, matricule, email, telephone, date_embauche, type_contrat } = req.body;
    const { data, error } = await supabase
      .from('agents')
      .update({ nom, prenom, matricule, email, telephone, date_embauche, type_contrat })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

// POST /api/agents/:id/assignments — créer une affectation
router.post('/:id/assignments', requireRole('admin_app', 'admin_service'), async (req, res) => {
  try {
    const { service_id, cellule_id, specialite_id, roulement_id, date_debut, date_fin, ordre, date_debut_reference } = req.body;

    // Auto-calcul de l'ordre si non fourni
    let finalOrdre = ordre;
    if (finalOrdre === undefined || finalOrdre === null) {
      const { data: last } = await supabase
        .from('agent_assignments')
        .select('ordre')
        .eq('cellule_id', cellule_id)
        .eq('is_active', true)
        .order('ordre', { ascending: false })
        .limit(1);
      finalOrdre = last?.length ? last[0].ordre + 1 : 0;
    }

    const { data, error } = await supabase
      .from('agent_assignments')
      .insert({
        agent_id: req.params.id,
        service_id, cellule_id, specialite_id, roulement_id,
        date_debut, date_fin,
        ordre: finalOrdre,
        is_active: true,
        date_debut_reference: date_debut_reference || null,
      })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

// POST /api/agents/:id/photo — upload photo d'identité (base64 JSON)
router.post('/:id/photo', requireRole('admin_app', 'admin_service'), async (req, res) => {
  try {
    const { id } = req.params;
    const { data: base64 } = req.body;
    if (!base64) return res.status(400).json({ error: 'data (base64) requis' });

    const buffer = Buffer.from(base64, 'base64');

    if (buffer.length > PHOTO_MAX_BYTES) {
      return res.status(400).json({ error: 'Photo trop volumineuse (max 5 Mo)' });
    }

    const detectedMime = detectImageMime(buffer);
    if (!detectedMime) {
      return res.status(400).json({ error: 'Format non supporté. Utilisez JPEG, PNG ou WebP.' });
    }

    const storagePath = `photo/${id}`;
    const { error: upErr } = await supabase.storage
      .from('Documents')
      .upload(storagePath, buffer, { contentType: detectedMime, upsert: true });
    if (upErr) throw upErr;

    const { data: { publicUrl } } = supabase.storage
      .from('Documents')
      .getPublicUrl(storagePath);

    const { error: dbErr } = await supabase
      .from('agents')
      .update({ photo_url: publicUrl })
      .eq('id', id);
    if (dbErr) throw dbErr;

    res.json({ photo_url: publicUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

// DELETE /api/agents/:id/photo — supprimer la photo
router.delete('/:id/photo', requireRole('admin_app', 'admin_service'), async (req, res) => {
  try {
    const { id } = req.params;
    const { error: stErr } = await supabase.storage
      .from('Documents')
      .remove([`photo/${id}`]);
    if (stErr) throw stErr;

    await supabase.from('agents').update({ photo_url: null }).eq('id', id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

/**
 * PATCH /api/agents/assignments/:assignmentId/ordre
 * Modifie l'ordre d'un agent dans sa cellule
 * Body: { ordre: number }
 */
router.patch('/assignments/:assignmentId/ordre', requireRole('admin_app', 'admin_service', 'pointeur'), async (req, res) => {
  try {
    const { ordre } = req.body;
    if (ordre === undefined || ordre < 0) {
      return res.status(400).json({ error: 'ordre doit être un entier >= 0' });
    }

    const { data, error } = await supabase
      .from('agent_assignments')
      .update({ ordre: parseInt(ordre) })
      .eq('id', req.params.assignmentId)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

/**
 * POST /api/agents/assignments/reorder
 * Réordonne en masse tous les agents d'une cellule
 * Body: { cellule_id, ordres: [{ assignment_id, ordre }] }
 */
router.post('/assignments/reorder', requireRole('admin_app', 'admin_service', 'pointeur'), async (req, res) => {
  try {
    const { ordres } = req.body; // [{ assignment_id, ordre }]
    if (!Array.isArray(ordres) || !ordres.length) {
      return res.status(400).json({ error: 'ordres[] requis' });
    }

    // Update en parallèle
    const updates = ordres.map(({ assignment_id, ordre }) =>
      supabase
        .from('agent_assignments')
        .update({ ordre: parseInt(ordre) })
        .eq('id', assignment_id)
    );

    const results = await Promise.all(updates);
    const errors = results.filter(r => r.error);
    if (errors.length) throw new Error(errors[0].error.message);

    res.json({ success: true, updated: ordres.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

export default router;
