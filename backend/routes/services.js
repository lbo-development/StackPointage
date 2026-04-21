// ============ routes/services.js ============
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import { supabase } from '../supabase.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('services').select('*').eq('is_active', true).order('nom');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/:id/cellules', async (req, res) => {
  const { data, error } = await supabase.from('cellules').select('*').eq('service_id', req.params.id).eq('is_active', true).order('ordre');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
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

router.put('/cellules/:id', requireRole('admin_app', 'admin_service'), async (req, res) => {
  const { data, error } = await supabase.from('cellules').update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

export default router;
