import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import { supabase } from '../supabase.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const { service_id, agent_id, date_debut, date_fin } = req.query;
    let query = supabase
      .from('convocations')
      .select('*, agents(nom, prenom, matricule)')
      .order('date', { ascending: false });
    if (service_id) query = query.eq('service_id', service_id);
    if (agent_id)   query = query.eq('agent_id', agent_id);
    if (date_debut) query = query.gte('date', date_debut);
    if (date_fin)   query = query.lte('date', date_fin);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

router.post('/', requireRole('admin_app', 'admin_service', 'pointeur', 'assistant_rh'), async (req, res) => {
  try {
    const { agent_id, date, type, intitule, commentaire, statut, service_id } = req.body;
    if (!agent_id || !intitule?.trim() || !date) {
      return res.status(400).json({ error: 'agent_id, date et intitule sont requis' });
    }
    const { data, error } = await supabase
      .from('convocations')
      .insert({ agent_id, date, type, intitule: intitule.trim(), commentaire, statut, service_id, cree_par: req.profile.id })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

router.put('/:id', requireRole('admin_app', 'admin_service', 'pointeur', 'assistant_rh'), async (req, res) => {
  try {
    const { agent_id, date, type, intitule, commentaire, statut, service_id } = req.body;
    if (!agent_id || !intitule?.trim() || !date) {
      return res.status(400).json({ error: 'agent_id, date et intitule sont requis' });
    }
    const { data, error } = await supabase
      .from('convocations')
      .update({ agent_id, date, type, intitule: intitule.trim(), commentaire, statut, service_id })
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

router.delete('/:id', requireRole('admin_app', 'admin_service', 'assistant_rh'), async (req, res) => {
  try {
    const { error } = await supabase.from('convocations').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

export default router;
