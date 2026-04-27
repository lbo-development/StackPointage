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

  // Les tokens restent dans les cookies httpOnly — ne pas les renvoyer dans le body
  res.json({ profile });
});

router.post('/logout', authMiddleware, (req, res) => {
  clearAuthCookies(res);
  res.json({ ok: true });
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user, profile: req.profile });
});

export default router;
