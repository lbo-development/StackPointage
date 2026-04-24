import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRole, requireServiceScope } from '../middlewares/role.js';
import { supabase } from '../supabase.js';

const router = Router();
router.use(authMiddleware);

// Retourne les roulements du service demandé + les roulements globaux (service_id IS NULL)
router.get('/', requireServiceScope, async (req, res) => {
  const serviceId = req.query.service_id || req.scopedServiceId;
  let query = supabase.from('roulements').select('*, roulement_cycles(*)').eq('is_active', true).order('nom');
  if (serviceId) {
    query = query.or(`service_id.eq.${serviceId},service_id.is.null`);
  }
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/', requireRole('admin_app', 'admin_service'), requireServiceScope, async (req, res) => {
  try {
    const { nom, description, longueur_cycle, date_debut_reference, service_id, feries_non_travailles, date_ref_par_agent, cycles } = req.body;

    let sid;
    // service_id explicitement null = roulement global (admin_app uniquement)
    if (service_id === null) {
      if (req.profile.role !== 'admin_app') {
        return res.status(403).json({ error: 'Seul un admin_app peut créer un roulement global' });
      }
      sid = null;
    } else {
      sid = service_id || req.scopedServiceId;
    }

    const { data: roulement, error } = await supabase
      .from('roulements')
      .insert({ nom, description, longueur_cycle, date_debut_reference, service_id: sid, feries_non_travailles: feries_non_travailles ?? false, date_ref_par_agent: date_ref_par_agent ?? false })
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

// GET /api/roulements/feries?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get('/feries', async (req, res) => {
  try {
    const { start, end } = req.query;
    let query = supabase.from('jours_feries').select('date').eq('is_active', true);
    if (start) query = query.gte('date', start);
    if (end) query = query.lte('date', end);
    const { data, error } = await query.order('date');
    if (error) throw error;
    res.json((data || []).map(f => f.date));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requireRole('admin_app', 'admin_service'), async (req, res) => {
  try {
    const { cycles, ...roulementData } = req.body;

    // service_id explicitement null = passage en roulement global (admin_app uniquement)
    if (roulementData.service_id === null && req.profile.role !== 'admin_app') {
      return res.status(403).json({ error: 'Seul un admin_app peut rendre un roulement global' });
    }

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
