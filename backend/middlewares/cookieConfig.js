const isProd = !(process.env.FRONTEND_URL || 'localhost').includes('localhost');

// SameSite=None requis pour les requêtes cross-origin Railway (frontend ≠ backend subdomain)
// SameSite=Lax suffit en dev car le proxy Vite partage le même origin
export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? 'none' : 'lax',
  path: '/',
};

export function setAuthCookies(res, session) {
  res.cookie('sb_access', session.access_token, {
    ...COOKIE_OPTIONS,
    maxAge: (session.expires_in || 3600) * 1000,
  });
  res.cookie('sb_refresh', session.refresh_token, {
    ...COOKIE_OPTIONS,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(res) {
  res.clearCookie('sb_access', COOKIE_OPTIONS);
  res.clearCookie('sb_refresh', COOKIE_OPTIONS);
}
