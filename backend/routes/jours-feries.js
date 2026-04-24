import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import { supabase } from '../supabase.js';

const router = Router();
router.use(authMiddleware);

// Algorithme grégorien anonyme — Dimanche de Pâques
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 86400000);
}

function toStr(date) {
  return date.toISOString().split('T')[0];
}

function feriesMetropole(year) {
  const p = easterSunday(year);
  return [
    { date: toStr(new Date(Date.UTC(year,  0,  1))), libelle: "Jour de l'An" },
    { date: toStr(addDays(p,  1)),                   libelle: 'Lundi de Pâques' },
    { date: toStr(new Date(Date.UTC(year,  4,  1))), libelle: 'Fête du Travail' },
    { date: toStr(new Date(Date.UTC(year,  4,  8))), libelle: 'Victoire 1945' },
    { date: toStr(addDays(p, 39)),                   libelle: 'Ascension' },
    { date: toStr(addDays(p, 50)),                   libelle: 'Lundi de Pentecôte' },
    { date: toStr(new Date(Date.UTC(year,  6, 14))), libelle: 'Fête Nationale' },
    { date: toStr(new Date(Date.UTC(year,  7, 15))), libelle: 'Assomption' },
    { date: toStr(new Date(Date.UTC(year, 10,  1))), libelle: 'Toussaint' },
    { date: toStr(new Date(Date.UTC(year, 10, 11))), libelle: 'Armistice 1918' },
    { date: toStr(new Date(Date.UTC(year, 11, 25))), libelle: 'Noël' },
  ];
}

// GET /api/jours-feries?annee=2025
router.get('/', async (req, res) => {
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
    res.status(500).json({ error: err.message });
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
    res.json({ inserted: data?.length ?? 0, feries: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/jours-feries/:id
router.delete('/:id', requireRole('admin_app'), async (req, res) => {
  try {
    const { error } = await supabase.from('jours_feries').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
