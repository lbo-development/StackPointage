import { supabase } from '../supabase.js';

/**
 * Vérifie le token JWT Supabase, attache req.user et req.profile
 */
export async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token manquant' });
    }

    const token = authHeader.split(' ')[1];

    // Vérification via Supabase Auth
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Token invalide ou expiré' });
    }

    // Récupération du profil avec rôle
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .eq('is_active', true)
      .single();

    if (profileError || !profile) {
      return res.status(401).json({ error: 'Profil introuvable ou inactif' });
    }

    req.user = user;
    req.profile = profile;
    next();
  } catch (err) {
    console.error('authMiddleware error:', err);
    res.status(500).json({ error: 'Erreur authentification' });
  }
}
