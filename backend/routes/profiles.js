// ============ routes/profiles.js ============
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import { supabase } from '../supabase.js';

const router = Router();
router.use(authMiddleware);
router.use(requireRole('admin_app'));

// GET /api/profiles/agents — liste des agents pour le sélecteur de liaison
// Doit être AVANT /:id pour éviter la collision de route
router.get('/agents', async (req, res) => {
  const { data, error } = await supabase
    .from('agents')
    .select('id, matricule, nom, prenom, profile_id, is_active')
    .order('nom');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/profiles — liste tous les profils avec service et agent lié
router.get('/', async (req, res) => {
  const [{ data: profiles, error }, { data: linkedAgents }, { data: services }] = await Promise.all([
    supabase.from('profiles').select('*').order('nom'),
    supabase.from('agents').select('id, nom, prenom, matricule, profile_id').not('profile_id', 'is', null),
    supabase.from('services').select('id, nom, code'),
  ]);
  if (error) return res.status(500).json({ error: error.message });

  const servicesById = (services || []).reduce((acc, s) => { acc[s.id] = s; return acc; }, {});
  const agentByProfileId = (linkedAgents || []).reduce((acc, a) => { acc[a.profile_id] = a; return acc; }, {});

  res.json(profiles.map(p => ({
    ...p,
    services: p.service_id ? (servicesById[p.service_id] || null) : null,
    agent: agentByProfileId[p.id] || null,
  })));
});

// POST /api/profiles — créer un compte Supabase Auth + profil
router.post('/', async (req, res) => {
  const { email, password, role, service_id, agent_id, is_active = true } = req.body;

  if (!email || !password || !role) {
    return res.status(400).json({ error: 'email, password et role sont requis' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
  }

  // Récupérer nom/prenom depuis l'agent lié, sinon dériver de l'email
  let nom = email.split('@')[0];
  let prenom = '';
  if (agent_id) {
    const { data: agent } = await supabase.from('agents').select('nom, prenom').eq('id', agent_id).single();
    if (agent) { nom = agent.nom; prenom = agent.prenom; }
  }

  // 1. Créer le compte Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError) return res.status(400).json({ error: authError.message });

  const userId = authData.user.id;

  try {
    // 2. Insérer le profil
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({ id: userId, email, nom, prenom, role, service_id: service_id || null, is_active })
      .select()
      .single();

    if (profileError) {
      await supabase.auth.admin.deleteUser(userId);
      return res.status(500).json({ error: profileError.message });
    }

    // 3. Lier à un agent
    if (agent_id) {
      await supabase.from('agents').update({ profile_id: userId }).eq('id', agent_id);
    }

    res.status(201).json(profile);
  } catch (err) {
    await supabase.auth.admin.deleteUser(userId);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/profiles/:id — modifier un profil
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { role, service_id, agent_id, is_active } = req.body;

  const updates = {};
  if (role !== undefined) updates.role = role;
  if (service_id !== undefined) updates.service_id = service_id || null;
  if (is_active !== undefined) updates.is_active = is_active;

  // Synchroniser nom/prenom depuis le nouvel agent lié
  if ('agent_id' in req.body && agent_id) {
    const { data: agent } = await supabase.from('agents').select('nom, prenom').eq('id', agent_id).single();
    if (agent) { updates.nom = agent.nom; updates.prenom = agent.prenom; }
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  // Mettre à jour le lien agent si fourni dans la requête
  if ('agent_id' in req.body) {
    await supabase.from('agents').update({ profile_id: null }).eq('profile_id', id);
    if (agent_id) {
      await supabase.from('agents').update({ profile_id: id }).eq('id', agent_id);
    }
  }

  res.json(data);
});

// PUT /api/profiles/:id/password — réinitialiser le mot de passe
router.put('/:id/password', async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Mot de passe requis (minimum 6 caractères)' });
  }
  const { error } = await supabase.auth.admin.updateUserById(req.params.id, { password });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

export default router;
