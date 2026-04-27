// routes/previsions.js
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import { supabase } from '../supabase.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  const { agent_id, date_debut, date_fin } = req.query;
  let query = supabase.from('previsions_absence').select('*');
  if (agent_id) query = query.eq('agent_id', agent_id);
  if (date_debut) query = query.gte('date', date_debut);
  if (date_fin) query = query.lte('date', date_fin);
  const { data, error } = await query;
  if (error) { console.error(error); return res.status(500).json({ error: 'Erreur serveur interne.' }); }
  res.json(data);
});

router.post('/', requireRole('admin_app', 'admin_service', 'pointeur'), async (req, res) => {
  const { agent_id, date, code_pointage, commentaire, service_id, cellule_id } = req.body;
  const { data: existing } = await supabase.from('previsions_absence').select('id, is_locked').eq('agent_id', agent_id).eq('date', date).maybeSingle();
  if (existing?.is_locked) return res.status(403).json({ error: 'Prévision verrouillée' });
  const payload = { agent_id, date, code_pointage, commentaire, service_id, cellule_id, saisi_par: req.profile.id };
  const { data, error } = existing
    ? await supabase.from('previsions_absence').update(payload).eq('id', existing.id).select().single()
    : await supabase.from('previsions_absence').insert(payload).select().single();
  if (error) { console.error(error); return res.status(500).json({ error: 'Erreur serveur interne.' }); }
  res.json(data);
});

export default router;
