import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const INACTIVITY_MS = 15 * 60 * 1000; // 15 minutes

const AuthContext = createContext(null);

// En prod Railway, VITE_API_URL = https://backend.railway.app
// En dev local, on laisse vide → le proxy Vite redirige /api vers localhost:3001
const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

// ============================================================
// TOKEN STORAGE — localStorage (iOS Safari / ITP compatible)
// ============================================================
// sessionStorage : effacé à la fermeture du navigateur (≠ localStorage qui persiste)
function saveTokens({ access_token, refresh_token, expires_in }) {
  sessionStorage.setItem('sb_access', access_token);
  sessionStorage.setItem('sb_refresh', refresh_token);
  const expiresAt = Math.floor(Date.now() / 1000) + (expires_in || 3600);
  sessionStorage.setItem('sb_expires_at', String(expiresAt));
}

function clearTokens() {
  sessionStorage.removeItem('sb_access');
  sessionStorage.removeItem('sb_refresh');
  sessionStorage.removeItem('sb_expires_at');
}

function loadTokens() {
  return {
    access_token:  sessionStorage.getItem('sb_access'),
    refresh_token: sessionStorage.getItem('sb_refresh'),
    expires_at:    parseInt(sessionStorage.getItem('sb_expires_at') || '0', 10),
  };
}

async function doRefresh(refresh_token) {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ============================================================
// API CLIENT — Authorization: Bearer header
// ============================================================
export function createApiClient(tokenRef, onTokenExpired, onUnauthorized) {
  async function request(method, path, body, isRetry = false) {
    const token = tokenRef.current;
    if (!token) { onUnauthorized?.(); throw new Error('Non authentifié'); }

    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401) {
      const data = await res.json().catch(() => ({}));
      if (!isRetry && data.code === 'TOKEN_EXPIRED') {
        const refreshed = await onTokenExpired();
        if (refreshed) return request(method, path, body, true);
      }
      onUnauthorized?.();
      throw new Error('Session expirée');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  return {
    get:    (path)       => request('GET',    path),
    post:   (path, body) => request('POST',   path, body),
    put:    (path, body) => request('PUT',    path, body),
    patch:  (path, body) => request('PATCH',  path, body),
    delete: (path)       => request('DELETE', path),

    downloadExcel: async (params) => {
      const token = tokenRef.current;
      if (!token) throw new Error('Non authentifié');
      const qs = new URLSearchParams(params).toString();
      const res = await fetch(`${API_BASE}/export/excel?${qs}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || `Erreur ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pointages_${params.date_debut}_${params.date_fin}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    },
  };
}

// ============================================================
// AUTH PROVIDER
// ============================================================
export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const tokenRef = useRef(null);

  const handleUnauthorized = useCallback(() => {
    clearTokens();
    tokenRef.current = null;
    setProfile(null);
  }, []);

  const handleTokenExpired = useCallback(async () => {
    const { refresh_token } = loadTokens();
    if (!refresh_token) { handleUnauthorized(); return false; }
    const data = await doRefresh(refresh_token);
    if (!data?.access_token) { handleUnauthorized(); return false; }
    saveTokens(data);
    tokenRef.current = data.access_token;
    return true;
  }, [handleUnauthorized]);

  // Restauration de session au montage depuis localStorage
  useEffect(() => {
    const { access_token, refresh_token, expires_at } = loadTokens();
    if (!access_token) { setLoading(false); return; }

    const now = Math.floor(Date.now() / 1000);
    const needsRefresh = expires_at > 0 && expires_at - now < 60;

    (async () => {
      try {
        let token = access_token;
        if (needsRefresh) {
          const refreshed = await doRefresh(refresh_token);
          if (!refreshed?.access_token) { clearTokens(); setLoading(false); return; }
          saveTokens(refreshed);
          token = refreshed.access_token;
        }
        tokenRef.current = token;
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` },
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.profile) setProfile(data.profile);
          else { clearTokens(); tokenRef.current = null; }
        } else {
          clearTokens(); tokenRef.current = null;
        }
      } catch {
        clearTokens(); tokenRef.current = null;
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // credentials: { profile_id, password } ou { email, password } (fallback admin)
  const login = useCallback(async (credentials) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(credentials),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Connexion échouée');
    }
    const data = await res.json();
    saveTokens(data);
    tokenRef.current = data.access_token;
    setProfile(data.profile);
    return data;
  }, []);

  const logout = useCallback(async () => {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});
    clearTokens();
    tokenRef.current = null;
    setProfile(null);
  }, []);

  // Déconnexion automatique après 15 min sans interaction utilisateur
  useEffect(() => {
    if (!profile) return;

    let timer;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(logout, INACTIVITY_MS);
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(ev => window.addEventListener(ev, reset, { passive: true }));
    reset();

    return () => {
      clearTimeout(timer);
      events.forEach(ev => window.removeEventListener(ev, reset));
    };
  }, [profile, logout]);

  const api = profile
    ? createApiClient(tokenRef, handleTokenExpired, handleUnauthorized)
    : null;

  const can = useCallback((action) => {
    if (!profile) return false;
    const role = profile.role;
    const perms = {
      'edit_pointage':     ['admin_app', 'admin_service', 'pointeur'],
      'edit_agents':       ['admin_app', 'admin_service'],
      'edit_roulements':   ['admin_app', 'admin_service'],
      'edit_codes':        ['admin_app', 'admin_service'],
      'edit_convocations': ['admin_app', 'admin_service', 'pointeur', 'assistant_rh'],
      'read_only':         ['agent', 'viewer'],
      'admin':             ['admin_app'],
    };
    return perms[action]?.includes(role) ?? false;
  }, [profile]);

  const isAdmin        = profile?.role === 'admin_app';
  const isAdminService = profile?.role === 'admin_service';
  const isPointeur     = profile?.role === 'pointeur';
  const isAssistantRH  = profile?.role === 'assistant_rh';
  const isAgent        = profile?.role === 'agent';
  const isViewer       = profile?.role === 'viewer';

  return (
    <AuthContext.Provider value={{
      profile, loading, api, login, logout, can,
      isAdmin, isAdminService, isPointeur, isAssistantRH, isAgent, isViewer,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être dans AuthProvider');
  return ctx;
}
