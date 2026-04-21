import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import { supabase } from '../supabase.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  const { service_id, agent_id, date_debut, date_fin } = req.query;
  let query = supabase.from('convocations')
    .select('*, agents(nom, prenom, matricule)')
    .order('date', { ascending: false });
  if (service_id) query = query.eq('service_id', service_id);
  if (agent_id) query = query.eq('agent_id', agent_id);
  if (date_debut) query = query.gte('date', date_debut);
  if (date_fin) query = query.lte('date', date_fin);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/', requireRole('admin_app', 'admin_service', 'pointeur', 'assistant_rh'), async (req, res) => {
  const { data, error } = await supabase.from('convocations')
    .insert({ ...req.body, cree_par: req.profile.id })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.put('/:id', requireRole('admin_app', 'admin_service', 'pointeur', 'assistant_rh'), async (req, res) => {
  const { data, error } = await supabase.from('convocations')
    .update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/:id', requireRole('admin_app', 'admin_service', 'assistant_rh'), async (req, res) => {
  const { error } = await supabase.from('convocations').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

export default router;
