// ============ routes/services.js ============
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import { supabase } from '../supabase.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  const includeInactive = req.query.include_inactive === 'true';
  let svcQuery = supabase.from('services').select('*').order('num_ordre').order('nom');
  if (!includeInactive) svcQuery = svcQuery.eq('is_active', true);
  const [{ data: services, error }, { data: counts }] = await Promise.all([
    svcQuery,
    supabase.from('agent_assignments').select('service_id').eq('is_active', true)
  ]);
  if (error) return res.status(500).json({ error: error.message });
  const countsByService = (counts || []).reduce((acc, row) => {
    acc[row.service_id] = (acc[row.service_id] || 0) + 1;
    return acc;
  }, {});
  res.json(services.map(s => ({ ...s, nb_agents: countsByService[s.id] || 0 })));
});

router.get('/:id/cellules', async (req, res) => {
  const includeInactive = req.query.include_inactive === 'true';
  let celQuery = supabase.from('cellules').select('*').eq('service_id', req.params.id).order('ordre');
  if (!includeInactive) celQuery = celQuery.eq('is_active', true);
  const [{ data: cellules, error }, { data: counts }] = await Promise.all([
    celQuery,
    supabase.from('agent_assignments').select('cellule_id').eq('service_id', req.params.id).eq('is_active', true)
  ]);
  if (error) return res.status(500).json({ error: error.message });
  const countsByCellule = (counts || []).reduce((acc, row) => {
    if (row.cellule_id) acc[row.cellule_id] = (acc[row.cellule_id] || 0) + 1;
    return acc;
  }, {});
  res.json(cellules.map(c => ({ ...c, nb_agents: countsByCellule[c.id] || 0 })));
});

router.get('/:id/specialites', async (req, res) => {
  const { data, error } = await supabase.from('specialites').select('*').eq('service_id', req.params.id).eq('is_active', true).order('ordre');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/', requireRole('admin_app'), async (req, res) => {
  const { data, error } = await supabase.from('services').insert(req.body).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// Doit être AVANT router.put('/:id') pour éviter la collision de route
router.put('/reorder', requireRole('admin_app'), async (req, res) => {
  const updates = req.body; // [{id, num_ordre}, ...]
  try {
    await Promise.all(updates.map(({ id, num_ordre }) =>
      supabase.from('services').update({ num_ordre }).eq('id', id)
    ));
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

router.put('/:id', requireRole('admin_app', 'admin_service'), async (req, res) => {
  const { data, error } = await supabase.from('services').update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/:id/cellules', requireRole('admin_app', 'admin_service'), async (req, res) => {
  const { data, error } = await supabase.from('cellules').insert({ ...req.body, service_id: req.params.id }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// Doit être AVANT router.put('/cellules/:id') pour éviter la collision de route
router.put('/cellules/reorder', requireRole('admin_app', 'admin_service'), async (req, res) => {
  const updates = req.body; // [{id, ordre}, ...]
  try {
    await Promise.all(updates.map(({ id, ordre }) =>
      supabase.from('cellules').update({ ordre }).eq('id', id)
    ));
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

router.put('/cellules/:id', requireRole('admin_app', 'admin_service'), async (req, res) => {
  const { data, error } = await supabase.from('cellules').update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── Spécialités ──────────────────────────────────────────────
router.post('/:id/specialites', requireRole('admin_app', 'admin_service'), async (req, res) => {
  const { data, error } = await supabase
    .from('specialites')
    .insert({ ...req.body, service_id: req.params.id })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// Doit être AVANT router.put('/specialites/:id') pour éviter la collision de route
router.put('/specialites/reorder', requireRole('admin_app', 'admin_service'), async (req, res) => {
  const updates = req.body; // [{id, ordre}, ...]
  try {
    await Promise.all(updates.map(({ id, ordre }) =>
      supabase.from('specialites').update({ ordre }).eq('id', id)
    ));
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

router.put('/specialites/:id', requireRole('admin_app', 'admin_service'), async (req, res) => {
  const { data, error } = await supabase
    .from('specialites')
    .update(req.body)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

export default router;
