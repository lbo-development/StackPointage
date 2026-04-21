import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

// En prod Railway, VITE_API_URL = https://backend.railway.app
// En dev local, on laisse vide → le proxy Vite redirige /api vers localhost:3001
const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

// ============================================================
// API CLIENT
// ============================================================
export function createApiClient(token) {
  const headers = (extra = {}) => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra
  });

  async function request(method, path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: headers(),
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    put: (path, body) => request('PUT', path, body),
    delete: (path) => request('DELETE', path),

    // Export spécial (blob)
    downloadExcel: async (params) => {
      const qs = new URLSearchParams(params).toString();
      const res = await fetch(`${API_BASE}/export/excel?${qs}`, {
        headers: headers()
      });
      if (!res.ok) throw new Error('Export échoué');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pointages_${params.date_debut}_${params.date_fin}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };
}

// ============================================================
// AUTH PROVIDER
// ============================================================
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('pointage_session');
    if (stored) {
      try {
        const { session: s, profile: p } = JSON.parse(stored);
        setSession(s);
        setProfile(p);
      } catch {}
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Connexion échouée');
    }
    const data = await res.json();
    setSession(data.session);
    setProfile(data.profile);
    localStorage.setItem('pointage_session', JSON.stringify({ session: data.session, profile: data.profile }));
    return data;
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    setProfile(null);
    localStorage.removeItem('pointage_session');
  }, []);

  const api = session ? createApiClient(session.access_token) : null;

  // Vérification du rôle
  const can = useCallback((action) => {
    if (!profile) return false;
    const role = profile.role;
    const perms = {
      'edit_pointage': ['admin_app', 'admin_service', 'pointeur'],
      'edit_agents': ['admin_app', 'admin_service'],
      'edit_roulements': ['admin_app', 'admin_service'],
      'edit_codes': ['admin_app', 'admin_service'],
      'edit_convocations': ['admin_app', 'admin_service', 'pointeur', 'assistant_rh'],
      'read_only': ['agent'],
      'admin': ['admin_app']
    };
    return perms[action]?.includes(role) ?? false;
  }, [profile]);

  const isAdmin = profile?.role === 'admin_app';
  const isAdminService = profile?.role === 'admin_service';
  const isPointeur = profile?.role === 'pointeur';
  const isAssistantRH = profile?.role === 'assistant_rh';
  const isAgent = profile?.role === 'agent';

  return (
    <AuthContext.Provider value={{
      session, profile, loading, api, login, logout, can,
      isAdmin, isAdminService, isPointeur, isAssistantRH, isAgent,
      token: session?.access_token
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
