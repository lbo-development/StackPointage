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
  res.json({ session: data.session, user: data.user, profile });
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user, profile: req.profile });
});

export default router;
