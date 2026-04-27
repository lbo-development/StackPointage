import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import { supabase } from '../supabase.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
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
        .from('cellules')
        .select('id')
        .eq('service_id', service_id)
        .eq('is_active', true);
      if (cellules?.length) query = query.in('cellule_id', cellules.map((c) => c.id));
      else return res.json([]);
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

router.post('/', requireRole('admin_app', 'admin_service'), async (req, res) => {
  try {
    const { cellule_id, libelle, specialite_id, code_pointage, couleur, ordre, seuil_alerte, seuil_operateur } = req.body;
    if (!code_pointage || !cellule_id) {
      return res.status(400).json({ error: 'code_pointage et cellule_id sont requis' });
    }
    const { data, error } = await supabase
      .from('cellule_cumuls')
      .insert({ cellule_id, libelle, specialite_id: specialite_id || null, code_pointage, couleur, ordre, seuil_alerte: seuil_alerte ?? null, seuil_operateur: seuil_operateur || '<=' })
      .select('*, specialites(id, nom)')
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

router.put('/:id', requireRole('admin_app', 'admin_service'), async (req, res) => {
  try {
    const { cellule_id, libelle, specialite_id, code_pointage, couleur, ordre, seuil_alerte, seuil_operateur } = req.body;
    if (!code_pointage) {
      return res.status(400).json({ error: 'code_pointage est requis' });
    }
    const { data, error } = await supabase
      .from('cellule_cumuls')
      .update({ cellule_id, libelle, specialite_id: specialite_id || null, code_pointage, couleur, ordre, seuil_alerte: seuil_alerte ?? null, seuil_operateur: seuil_operateur || '<=' })
      .eq('id', req.params.id)
      .select('*, specialites(id, nom)')
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

router.delete('/:id', requireRole('admin_app', 'admin_service'), async (req, res) => {
  try {
    const { error } = await supabase.from('cellule_cumuls').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

export default router;
