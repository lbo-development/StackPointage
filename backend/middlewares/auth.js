import { supabase } from '../supabase.js';
import { setAuthCookies, clearAuthCookies } from './cookieConfig.js';

export async function authMiddleware(req, res, next) {
  try {
    const token = req.cookies?.sb_access;
    if (!token) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    let user;
    const { data: { user: u }, error } = await supabase.auth.getUser(token);

    if (error) {
      // Token expiré — tentative de refresh silencieux
      const refreshToken = req.cookies?.sb_refresh;
      if (!refreshToken) {
        clearAuthCookies(res);
        return res.status(401).json({ error: 'Session expirée, reconnectez-vous' });
      }

      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (refreshError || !refreshData?.session) {
        clearAuthCookies(res);
        return res.status(401).json({ error: 'Session expirée, reconnectez-vous' });
      }

      setAuthCookies(res, refreshData.session);
      user = refreshData.user;
    } else {
      user = u;
    }

    if (!user) {
      return res.status(401).json({ error: 'Token invalide' });
    }

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
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
}
