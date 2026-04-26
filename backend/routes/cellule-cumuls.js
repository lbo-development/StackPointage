import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import { supabase } from '../supabase.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  const { cellule_id, service_id } = req.query;
  let query = supabase
    .from('cellule_cumuls')
    .select('*, specialites(id, nom)')
    .eq('is_active', true)
    .order('ordre');
  if (cellule_id) {
    query = query.eq('cellule_id', cellule_id);
  } else if (service_id) {
    const { data: cellules } = await supabase
      .from('cellules').select('id').eq('service_id', service_id).eq('is_active', true);
    if (cellules?.length) query = query.in('cellule_id', cellules.map(c => c.id));
    else return res.json([]);
  }
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

router.post('/', requireRole('admin_app', 'admin_service'), async (req, res) => {
  const { data, error } = await supabase
    .from('cellule_cumuls')
    .insert(req.body)
    .select('*, specialites(id, nom)')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.put('/:id', requireRole('admin_app', 'admin_service'), async (req, res) => {
  const { data, error } = await supabase
    .from('cellule_cumuls')
    .update(req.body)
    .eq('id', req.params.id)
    .select('*, specialites(id, nom)')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/:id', requireRole('admin_app', 'admin_service'), async (req, res) => {
  const { error } = await supabase.from('cellule_cumuls').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

export default router;
