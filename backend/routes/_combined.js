// ============ routes/codes.js ============
import { Router as CodeRouter } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import { supabase } from '../supabase.js';

export const codesRouter = CodeRouter();
codesRouter.use(authMiddleware);

codesRouter.get('/', async (req, res) => {
  const { service_id } = req.query;
  let query = supabase.from('codes_pointage').select('*').eq('is_active', true).order('ordre');
  if (service_id) query = query.or(`service_id.eq.${service_id},is_global.eq.true`);
  else query = query.eq('is_global', true);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

codesRouter.post('/', requireRole('admin_app', 'admin_service'), async (req, res) => {
  const { data, error } = await supabase.from('codes_pointage').insert(req.body).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

codesRouter.put('/:id', requireRole('admin_app', 'admin_service'), async (req, res) => {
  const { data, error } = await supabase.from('codes_pointage').update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ============ routes/convocations.js ============
import { Router as ConvRouter } from 'express';

export const convocationsRouter = ConvRouter();
convocationsRouter.use(authMiddleware);

convocationsRouter.get('/', async (req, res) => {
  const { service_id, agent_id, date_debut, date_fin } = req.query;
  let query = supabase.from('convocations').select('*, agents(nom, prenom, matricule)').order('date', { ascending: false });
  if (service_id) query = query.eq('service_id', service_id);
  if (agent_id) query = query.eq('agent_id', agent_id);
  if (date_debut) query = query.gte('date', date_debut);
  if (date_fin) query = query.lte('date', date_fin);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

convocationsRouter.post('/', requireRole('admin_app', 'admin_service', 'pointeur', 'assistant_rh'), async (req, res) => {
  const { data, error } = await supabase.from('convocations').insert({ ...req.body, cree_par: req.profile.id }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

convocationsRouter.put('/:id', requireRole('admin_app', 'admin_service', 'pointeur', 'assistant_rh'), async (req, res) => {
  const { data, error } = await supabase.from('convocations').update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

convocationsRouter.delete('/:id', requireRole('admin_app', 'admin_service', 'assistant_rh'), async (req, res) => {
  const { error } = await supabase.from('convocations').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ============ routes/previsions.js ============
import { Router as PrevRouter } from 'express';

export const previsionsRouter = PrevRouter();
previsionsRouter.use(authMiddleware);

previsionsRouter.get('/', async (req, res) => {
  const { agent_id, date_debut, date_fin } = req.query;
  let query = supabase.from('previsions_absence').select('*');
  if (agent_id) query = query.eq('agent_id', agent_id);
  if (date_debut) query = query.gte('date', date_debut);
  if (date_fin) query = query.lte('date', date_fin);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

previsionsRouter.post('/', requireRole('admin_app', 'admin_service', 'pointeur'), async (req, res) => {
  const { agent_id, date, code_pointage, commentaire, service_id, cellule_id } = req.body;
  const { data: existing } = await supabase.from('previsions_absence').select('id, is_locked').eq('agent_id', agent_id).eq('date', date).maybeSingle();
  if (existing?.is_locked) return res.status(403).json({ error: 'Prévision verrouillée' });

  const payload = { agent_id, date, code_pointage, commentaire, service_id, cellule_id, saisi_par: req.profile.id };
  const { data, error } = existing
    ? await supabase.from('previsions_absence').update(payload).eq('id', existing.id).select().single()
    : await supabase.from('previsions_absence').insert(payload).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ============ routes/auth.js ============
import { Router as AuthRouter } from 'express';
import { supabase as sb } from '../supabase.js';

export const authRouter = AuthRouter();

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: error.message });

  const { data: profile } = await sb.from('profiles').select('*').eq('id', data.user.id).single();
  res.json({ session: data.session, user: data.user, profile });
});

authRouter.post('/logout', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) await sb.auth.admin.signOut(token);
  res.json({ success: true });
});

authRouter.get('/me', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Non authentifié' });
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Token invalide' });
  const { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).single();
  res.json({ user, profile });
});
