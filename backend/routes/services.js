// ============ routes/services.js ============
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import { supabase } from '../supabase.js';
import { cache, invalidate } from '../middlewares/cache.js';

const router = Router();
router.use(authMiddleware);

const CACHE_PREFIX = '/api/services';

router.get('/', cache(5 * 60 * 1000), async (req, res) => {
  const includeInactive = req.query.include_inactive === 'true';
  let svcQuery = supabase.from('services').select('*').order('num_ordre').order('nom');
  if (!includeInactive) svcQuery = svcQuery.eq('is_active', true);
  const [{ data: services, error }, { data: counts }] = await Promise.all([
    svcQuery,
    supabase.from('agent_assignments').select('service_id').eq('is_active', true)
  ]);
  if (error) { console.error(error); return res.status(500).json({ error: 'Erreur serveur interne.' }); }
  const countsByService = (counts || []).reduce((acc, row) => {
    acc[row.service_id] = (acc[row.service_id] || 0) + 1;
    return acc;
  }, {});
  res.json(services.map(s => ({ ...s, nb_agents: countsByService[s.id] || 0 })));
});

router.get('/:id/cellules', cache(5 * 60 * 1000), async (req, res) => {
  const includeInactive = req.query.include_inactive === 'true';
  let celQuery = supabase.from('cellules').select('*').eq('service_id', req.params.id).order('ordre');
  if (!includeInactive) celQuery = celQuery.eq('is_active', true);
  const [{ data: cellules, error }, { data: counts }] = await Promise.all([
    celQuery,
    supabase.from('agent_assignments').select('cellule_id').eq('service_id', req.params.id).eq('is_active', true)
  ]);
  if (error) { console.error(error); return res.status(500).json({ error: 'Erreur serveur interne.' }); }
  const countsByCellule = (counts || []).reduce((acc, row) => {
    if (row.cellule_id) acc[row.cellule_id] = (acc[row.cellule_id] || 0) + 1;
    return acc;
  }, {});
  res.json(cellules.map(c => ({ ...c, nb_agents: countsByCellule[c.id] || 0 })));
});

router.get('/:id/specialites', cache(5 * 60 * 1000), async (req, res) => {
  const { data, error } = await supabase.from('specialites').select('*').eq('service_id', req.params.id).eq('is_active', true).order('ordre');
  if (error) { console.error(error); return res.status(500).json({ error: 'Erreur serveur interne.' }); }
  res.json(data);
});

router.post('/', requireRole('admin_app'), async (req, res) => {
  const { nom, code, description, num_ordre, is_active } = req.body;
  const { data, error } = await supabase
    .from('services')
    .insert({ nom, code, description, num_ordre, is_active })
    .select().single();
  if (error) { console.error(error); return res.status(500).json({ error: 'Erreur serveur interne.' }); }
  invalidate(CACHE_PREFIX);
  res.status(201).json(data);
});

// Doit être AVANT router.put('/:id') pour éviter la collision de route
router.put('/reorder', requireRole('admin_app'), async (req, res) => {
  const updates = req.body; // [{id, num_ordre}, ...]
  try {
    await Promise.all(updates.map(({ id, num_ordre }) =>
      supabase.from('services').update({ num_ordre }).eq('id', id)
    ));
    invalidate(CACHE_PREFIX);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

router.put('/:id', requireRole('admin_app', 'admin_service'), async (req, res) => {
  const { nom, code, description, num_ordre, is_active } = req.body;
  const { data, error } = await supabase
    .from('services')
    .update({ nom, code, description, num_ordre, is_active })
    .eq('id', req.params.id).select().single();
  if (error) { console.error(error); return res.status(500).json({ error: 'Erreur serveur interne.' }); }
  invalidate(CACHE_PREFIX);
  res.json(data);
});

router.post('/:id/cellules', requireRole('admin_app', 'admin_service'), async (req, res) => {
  const { nom, code, couleur, ordre, is_active } = req.body;
  const { data, error } = await supabase
    .from('cellules')
    .insert({ nom, code, couleur, ordre, is_active, service_id: req.params.id })
    .select().single();
  if (error) { console.error(error); return res.status(500).json({ error: 'Erreur serveur interne.' }); }
  invalidate(CACHE_PREFIX);
  res.status(201).json(data);
});

// Doit être AVANT router.put('/cellules/:id') pour éviter la collision de route
router.put('/cellules/reorder', requireRole('admin_app', 'admin_service'), async (req, res) => {
  const updates = req.body; // [{id, ordre}, ...]
  try {
    await Promise.all(updates.map(({ id, ordre }) =>
      supabase.from('cellules').update({ ordre }).eq('id', id)
    ));
    invalidate(CACHE_PREFIX);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

router.put('/cellules/:id', requireRole('admin_app', 'admin_service'), async (req, res) => {
  const { nom, code, couleur, ordre, is_active } = req.body;
  const { data, error } = await supabase
    .from('cellules')
    .update({ nom, code, couleur, ordre, is_active })
    .eq('id', req.params.id).select().single();
  if (error) { console.error(error); return res.status(500).json({ error: 'Erreur serveur interne.' }); }
  invalidate(CACHE_PREFIX);
  res.json(data);
});

// ── Spécialités ──────────────────────────────────────────────
router.post('/:id/specialites', requireRole('admin_app', 'admin_service'), async (req, res) => {
  const { nom, code, couleur, ordre, is_active } = req.body;
  const { data, error } = await supabase
    .from('specialites')
    .insert({ nom, code, couleur, ordre, is_active, service_id: req.params.id })
    .select()
    .single();
  if (error) { console.error(error); return res.status(500).json({ error: 'Erreur serveur interne.' }); }
  invalidate(CACHE_PREFIX);
  res.status(201).json(data);
});

// Doit être AVANT router.put('/specialites/:id') pour éviter la collision de route
router.put('/specialites/reorder', requireRole('admin_app', 'admin_service'), async (req, res) => {
  const updates = req.body; // [{id, ordre}, ...]
  try {
    await Promise.all(updates.map(({ id, ordre }) =>
      supabase.from('specialites').update({ ordre }).eq('id', id)
    ));
    invalidate(CACHE_PREFIX);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

router.put('/specialites/:id', requireRole('admin_app', 'admin_service'), async (req, res) => {
  const { nom, code, couleur, ordre, is_active } = req.body;
  const { data, error } = await supabase
    .from('specialites')
    .update({ nom, code, couleur, ordre, is_active })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) { console.error(error); return res.status(500).json({ error: 'Erreur serveur interne.' }); }
  invalidate(CACHE_PREFIX);
  res.json(data);
});

export default router;
