import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import { supabase } from '../supabase.js';

const router = Router();
router.use(authMiddleware);

// GET /api/export-catalogue
router.get('/', async (req, res) => {
  try {
    let query = supabase
      .from('export_catalogues')
      .select('*, services(nom), cellules(nom)')
      .order('created_at', { ascending: false });

    // Non-admin : restreint au service de l'utilisateur
    const { role, service_id } = req.profile;
    if (role !== 'admin_app' && service_id) {
      query = query.eq('service_id', service_id);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('export-catalogue GET:', err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

// POST /api/export-catalogue
router.post('/', requireRole('admin_app', 'admin_service'), async (req, res) => {
  try {
    const { nom, service_id, cellule_id, date_debut, date_fin } = req.body;
    if (!nom || !service_id || !date_debut || !date_fin) {
      return res.status(400).json({ error: 'nom, service_id, date_debut, date_fin requis' });
    }
    const { data, error } = await supabase
      .from('export_catalogues')
      .insert({ nom, service_id, cellule_id: cellule_id || null, date_debut, date_fin, created_by: req.profile.id })
      .select('*, services(nom), cellules(nom)')
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('export-catalogue POST:', err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

// PUT /api/export-catalogue/:id
router.put('/:id', requireRole('admin_app', 'admin_service'), async (req, res) => {
  try {
    const { nom, service_id, cellule_id, date_debut, date_fin } = req.body;
    if (!nom || !service_id || !date_debut || !date_fin) {
      return res.status(400).json({ error: 'nom, service_id, date_debut, date_fin requis' });
    }
    const { data, error } = await supabase
      .from('export_catalogues')
      .update({ nom, service_id, cellule_id: cellule_id || null, date_debut, date_fin })
      .eq('id', req.params.id)
      .select('*, services(nom), cellules(nom)')
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('export-catalogue PUT:', err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

// DELETE /api/export-catalogue/:id
router.delete('/:id', requireRole('admin_app', 'admin_service'), async (req, res) => {
  try {
    const { error } = await supabase
      .from('export_catalogues')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.status(204).end();
  } catch (err) {
    console.error('export-catalogue DELETE:', err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

export default router;
