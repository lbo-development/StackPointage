import { Router } from 'express';
import { supabase } from '../supabase.js';
import { authMiddleware } from '../middlewares/auth.js';
import { setAuthCookies, clearAuthCookies } from '../middlewares/cookieConfig.js';

const router = Router();

// GET /api/auth/users-list — public, liste des noms pour la combobox de connexion
// Retourne uniquement id/nom/prenom, jamais les emails
router.get('/users-list', async (req, res) => {
  const { data, error } = await supabase
    .from('agents')
    .select('profile_id, nom, prenom, profiles(is_active)')
    .eq('is_active', true)
    .not('profile_id', 'is', null);

  if (error) return res.status(500).json({ error: 'Erreur serveur interne.' });

  // Dédoublonner par profile_id, ne garder que les profils actifs
  const seen = new Set();
  const list = (data || [])
    .filter(a => a.profiles?.is_active && !seen.has(a.profile_id) && seen.add(a.profile_id))
    .map(a => ({ id: a.profile_id, nom: a.nom, prenom: a.prenom }))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr') || a.prenom.localeCompare(b.prenom, 'fr'));

  res.json(list);
});

router.post('/login', async (req, res) => {
  let { email, password, profile_id } = req.body;

  // Résolution email depuis profile_id (la combobox envoie profile_id, pas l'email)
  if (!email && profile_id) {
    // Vérifier que le profil est actif
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_active')
      .eq('id', profile_id)
      .single();
    if (!profile?.is_active) return res.status(401).json({ error: 'Utilisateur introuvable' });

    // Lire l'email depuis Supabase Auth (source de vérité — profiles.email peut être absent)
    const { data: { user: authUser }, error: authErr } = await supabase.auth.admin.getUserById(profile_id);
    if (authErr || !authUser?.email) return res.status(401).json({ error: 'Utilisateur introuvable' });
    email = authUser.email;
  }

  if (!email || !password) return res.status(400).json({ error: 'Identifiants requis' });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: 'Identifiants invalides' });

  setAuthCookies(res, data.session);

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  // Pour un agent, enrichir avec la cellule de son affectation active
  if (profile?.role === 'agent') {
    const { data: agent } = await supabase
      .from('agents')
      .select('id')
      .eq('profile_id', data.user.id)
      .single();
    if (agent) {
      const { data: assignment } = await supabase
        .from('agent_assignments')
        .select('cellule_id')
        .eq('agent_id', agent.id)
        .eq('is_active', true)
        .maybeSingle();
      if (assignment?.cellule_id) profile.cellule_id = assignment.cellule_id;
    }
  }

  // Tokens dans le body pour le stockage localStorage (iOS Safari compatible)
  res.json({
    profile,
    access_token:  data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in:    data.session.expires_in,
  });
});

router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(400).json({ error: 'refresh_token requis' });

  const { data, error } = await supabase.auth.refreshSession({ refresh_token });
  if (error || !data?.session) {
    return res.status(401).json({ error: 'Session expirée, reconnectez-vous' });
  }

  setAuthCookies(res, data.session);
  res.json({
    access_token:  data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in:    data.session.expires_in,
  });
});

router.post('/logout', (req, res) => {
  clearAuthCookies(res);
  res.json({ ok: true });
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user, profile: req.profile });
});

export default router;
