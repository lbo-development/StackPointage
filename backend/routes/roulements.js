import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRole, requireServiceScope } from '../middlewares/role.js';
import { supabase } from '../supabase.js';

const router = Router();
router.use(authMiddleware);

router.get('/', requireServiceScope, async (req, res) => {
  const serviceId = req.query.service_id || req.scopedServiceId;
  let query = supabase.from('roulements').select('*, roulement_cycles(*)').eq('is_active', true).order('nom');
  if (serviceId) query = query.eq('service_id', serviceId);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/', requireRole('admin_app', 'admin_service'), requireServiceScope, async (req, res) => {
  try {
    const { nom, description, longueur_cycle, date_debut_reference, service_id, cycles } = req.body;
    const sid = service_id || req.scopedServiceId;

    const { data: roulement, error } = await supabase
      .from('roulements')
      .insert({ nom, description, longueur_cycle, date_debut_reference, service_id: sid })
      .select().single();
    if (error) throw error;

    if (cycles?.length) {
      const cycleRows = cycles.map((c, i) => ({
        roulement_id: roulement.id,
        index_jour: i,
        code_pointage: c.code,
        label: c.label || null
      }));
      const { error: errC } = await supabase.from('roulement_cycles').insert(cycleRows);
      if (errC) throw errC;
    }

    res.status(201).json(roulement);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requireRole('admin_app', 'admin_service'), async (req, res) => {
  try {
    const { cycles, ...roulementData } = req.body;
    const { data, error } = await supabase.from('roulements').update(roulementData).eq('id', req.params.id).select().single();
    if (error) throw error;

    if (cycles) {
      await supabase.from('roulement_cycles').delete().eq('roulement_id', req.params.id);
      const cycleRows = cycles.map((c, i) => ({
        roulement_id: req.params.id,
        index_jour: i,
        code_pointage: c.code,
        label: c.label || null
      }));
      await supabase.from('roulement_cycles').insert(cycleRows);
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
