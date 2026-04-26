import { Router } from 'express';
import { supabase } from '../supabase.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email et password requis' });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: error.message });
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();

  // Pour un agent, enrichir le profil avec la cellule de son affectation active
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

  res.json({ session: data.session, user: data.user, profile });
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user, profile: req.profile });
});

export default router;
