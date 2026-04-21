import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import { supabase } from '../supabase.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  const { service_id } = req.query;
  let query = supabase.from('codes_pointage').select('*').eq('is_active', true).order('ordre');
  if (service_id) query = query.or(`service_id.eq.${service_id},is_global.eq.true`);
  else query = query.eq('is_global', true);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/', requireRole('admin_app', 'admin_service'), async (req, res) => {
  const { data, error } = await supabase.from('codes_pointage').insert(req.body).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.put('/:id', requireRole('admin_app', 'admin_service'), async (req, res) => {
  const { data, error } = await supabase.from('codes_pointage').update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

export default router;
