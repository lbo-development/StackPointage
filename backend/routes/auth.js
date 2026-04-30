import { Router } from 'express';
import { supabase } from '../supabase.js';
import { authMiddleware } from '../middlewares/auth.js';
import { setAuthCookies, clearAuthCookies } from '../middlewares/cookieConfig.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email et password requis' });

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
