import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import { supabase } from '../supabase.js';
import { cache, invalidate } from '../middlewares/cache.js';
import { feriesMetropole } from '../lib/joursFeries.js';

const router = Router();
router.use(authMiddleware);

const CACHE_PREFIX = '/api/jours-feries';

// GET /api/jours-feries?annee=2025
router.get('/', cache(10 * 60 * 1000), async (req, res) => {
  try {
    const { annee } = req.query;
    let query = supabase.from('jours_feries').select('*').order('date');
    if (annee) {
      query = query.gte('date', `${annee}-01-01`).lte('date', `${annee}-12-31`);
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

// POST /api/jours-feries/generer — génère les 11 jours fériés français pour une année
router.post('/generer', requireRole('admin_app'), async (req, res) => {
  try {
    const annee = parseInt(req.body.annee);
    if (!annee || annee < 1900 || annee > 2100) {
      return res.status(400).json({ error: 'Année invalide (1900–2100)' });
    }
    const feries = feriesMetropole(annee).map(f => ({ ...f, is_active: true }));
    const { data, error } = await supabase
      .from('jours_feries')
      .upsert(feries, { onConflict: 'date', ignoreDuplicates: true })
      .select();
    if (error) throw error;
    invalidate(CACHE_PREFIX);
    res.json({ inserted: data?.length ?? 0, feries: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

// POST /api/jours-feries
router.post('/', requireRole('admin_app'), async (req, res) => {
  try {
    const { date, libelle, is_active } = req.body;
    const { data, error } = await supabase
      .from('jours_feries')
      .insert({ date, libelle, is_active: is_active !== false })
      .select()
      .single();
    if (error) throw error;
    invalidate(CACHE_PREFIX);
    res.status(201).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

// PUT /api/jours-feries/:id
router.put('/:id', requireRole('admin_app'), async (req, res) => {
  try {
    const { date, libelle, is_active } = req.body;
    const { data, error } = await supabase
      .from('jours_feries')
      .update({ date, libelle, is_active })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    invalidate(CACHE_PREFIX);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

// DELETE /api/jours-feries/:id
router.delete('/:id', requireRole('admin_app'), async (req, res) => {
  try {
    const { error } = await supabase.from('jours_feries').delete().eq('id', req.params.id);
    if (error) throw error;
    invalidate(CACHE_PREFIX);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

export default router;
