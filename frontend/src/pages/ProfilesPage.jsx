import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

const ROLE_LABELS = {
  admin_app:     'Admin App',
  admin_service: 'Admin Service',
  pointeur:      'Pointeur',
  assistant_rh:  'Assistant RH',
  agent:         'Agent',
};

const ROLE_STYLES = {
  admin_app:     { bg: 'rgba(239,68,68,0.15)',  color: 'var(--danger)',  border: 'rgba(239,68,68,0.3)' },
  admin_service: { bg: 'rgba(249,115,22,0.15)', color: '#f97316',        border: 'rgba(249,115,22,0.3)' },
  pointeur:      { bg: 'rgba(59,130,246,0.15)', color: 'var(--accent)',  border: 'rgba(59,130,246,0.3)' },
  assistant_rh:  { bg: 'rgba(168,85,247,0.15)', color: '#a855f7',        border: 'rgba(168,85,247,0.3)' },
  agent:         { bg: 'rgba(16,185,129,0.15)', color: 'var(--success)', border: 'rgba(16,185,129,0.3)' },
};

export default function ProfilesPage() {
  const { api } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editProfile, setEditProfile] = useState(null);
  const [showInactifs, setShowInactifs] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filtreRole, setFiltreRole] = useState('');

  function load() {
    if (!api) return;
    setLoading(true);
    api.get('/profiles')
      .then(setProfiles)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(load, [api]);

  const visible = profiles.filter(p => {
    if (!showInactifs && !p.is_active) return false;
    if (filtreRole && p.role !== filtreRole) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      const agentNom = p.agent ? `${p.agent.nom} ${p.agent.prenom} ${p.agent.matricule}` : '';
      if (!`${p.email} ${agentNom}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="page-wrapper">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="page-title">Profils utilisateurs</h1>
        <button className="btn btn-primary" onClick={() => { setEditProfile(null); setShowModal(true); }}>
          + Nouveau profil
        </button>
      </div>

      <div className="toolbar" style={{ marginBottom: 12 }}>
        <input
          placeholder="Rechercher email, agent…"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{ width: 240 }}
          autoComplete="off"
        />
        <select value={filtreRole} onChange={e => setFiltreRole(e.target.value)} style={{ width: 160 }}>
          <option value="">Tous les rôles</option>
          {Object.entries(ROLE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
          {visible.length} profil{visible.length !== 1 ? 's' : ''}
        </span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
          <input
            type="checkbox"
            checked={showInactifs}
            onChange={e => setShowInactifs(e.target.checked)}
            style={{ width: 14, height: 14 }}
          />
          <span style={{ color: 'var(--text-muted)' }}>Inclure inactifs</span>
        </label>
      </div>

      {loading
        ? <div className="loading-overlay"><div className="loading-spinner" /></div>
        : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th style={{ width: 140 }}>Rôle</th>
                <th>Service</th>
                <th>Agent lié</th>
                <th style={{ width: 80 }}>Statut</th>
                <th style={{ width: 80 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(p => {
                const rs = ROLE_STYLES[p.role] || {};
                return (
                  <tr key={p.id} style={!p.is_active ? { opacity: 0.45 } : undefined}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{p.email}</td>
                    <td>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8,
                        background: rs.bg, color: rs.color, border: `1px solid ${rs.border}`,
                      }}>
                        {ROLE_LABELS[p.role] || p.role}
                      </span>
                    </td>
                    <td>
                      {p.services
                        ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                              {p.services.code}
                            </span>
                            <span style={{ fontSize: 12 }}>{p.services.nom}</span>
                          </span>
                        )
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>
                      }
                    </td>
                    <td>
                      {p.agent
                        ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                              {p.agent.matricule}
                            </span>
                            <span style={{ fontWeight: 600, fontSize: 12 }}>
                              {p.agent.nom} {p.agent.prenom}
                            </span>
                          </span>
                        )
                        : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Non lié</span>
                      }
                    </td>
                    <td>
                      <span style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 8,
                        background: p.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)',
                        color: p.is_active ? 'var(--success)' : 'var(--text-muted)',
                        border: `1px solid ${p.is_active ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
                      }}>
                        {p.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-sm" onClick={() => { setEditProfile(p); setShowModal(true); }}>
                        Éditer
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!visible.length && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
                    Aucun profil trouvé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )
      }

      {showModal && (
        <ProfileModal
          profile={editProfile}
          api={api}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

// ── ProfileModal ─────────────────────────────────────────────────

function ProfileModal({ profile, api, onClose, onSaved }) {
  const isNew = !profile;

  const [email, setEmail] = useState(profile?.email || '');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [role, setRole] = useState(profile?.role || 'agent');
  const [serviceId, setServiceId] = useState(profile?.service_id || '');
  const [agentId, setAgentId] = useState(profile?.agent?.id || '');
  const [isActive, setIsActive] = useState(profile?.is_active !== false);

  const [services, setServices] = useState([]);
  const [agents, setAgents] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!api) return;
    Promise.all([
      api.get('/services'),
      api.get('/profiles/agents'),
    ]).then(([svcs, ags]) => {
      setServices(svcs);
      setAgents(ags);
    }).catch(console.error);
  }, [api]);

  // Agents disponibles : sans profil lié + celui actuellement lié à ce profil
  const availableAgents = agents.filter(a =>
    !a.profile_id || a.id === profile?.agent?.id
  );

  const needsService = role !== 'admin_app';

  const canSave =
    role &&
    (!isNew || (email.trim() && password.length >= 6));

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      if (isNew) {
        await api.post('/profiles', {
          email: email.trim(),
          password,
          role,
          service_id: serviceId || null,
          agent_id: agentId || null,
          is_active: isActive,
        });
      } else {
        await api.put(`/profiles/${profile.id}`, {
          role,
          service_id: serviceId || null,
          agent_id: agentId || null,
          is_active: isActive,
        });
        if (showPasswordSection && newPassword.length >= 6) {
          await api.put(`/profiles/${profile.id}/password`, { password: newPassword });
        }
      }
      onSaved();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">
            {isNew ? 'Nouveau profil' : `Modifier — ${profile.email}`}
          </span>
          <button className="btn btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* ── Compte ── */}
          {isNew ? (
            <>
              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="utilisateur@domaine.fr"
                  style={{ fontFamily: 'var(--font-mono)' }}
                  autoComplete="off"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>
                  Mot de passe initial *
                  <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>
                    (min. 6 caractères)
                  </span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>
            </>
          ) : (
            <div className="form-group">
              <label>Email</label>
              <div style={{
                padding: '6px 10px',
                borderRadius: 'var(--radius)',
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid var(--border)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: 'var(--text-muted)',
              }}>
                {profile.email}
              </div>
            </div>
          )}

          {/* ── Droits ── */}
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>Rôle *</label>
              <select
                value={role}
                onChange={e => {
                  setRole(e.target.value);
                  if (e.target.value === 'admin_app') setServiceId('');
                }}
              >
                <option value="admin_app">Admin App</option>
                <option value="admin_service">Admin Service</option>
                <option value="pointeur">Pointeur</option>
                <option value="assistant_rh">Assistant RH</option>
                <option value="agent">Agent</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>
                Service
                {!needsService && (
                  <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>
                    (non applicable)
                  </span>
                )}
              </label>
              <select
                value={serviceId}
                onChange={e => setServiceId(e.target.value)}
                disabled={!needsService}
              >
                <option value="">— Aucun —</option>
                {services.map(s => (
                  <option key={s.id} value={s.id}>{s.nom}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label style={{ visibility: 'hidden' }}>Statut</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '2px 0' }}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
                style={{ width: 15, height: 15 }}
              />
              <span style={{ fontSize: 12, color: isActive ? 'var(--success)' : 'var(--text-muted)' }}>
                {isActive ? 'Profil actif' : 'Profil inactif'}
              </span>
            </label>
          </div>

          {/* ── Agent lié ── */}
          <div style={{
            borderTop: '1px solid var(--border)',
            marginTop: 10, paddingTop: 14,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10 }}>
              Agent lié
            </div>
            <div className="form-group">
              <label>
                Associer à un agent
                <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>(optionnel)</span>
              </label>
              <select value={agentId} onChange={e => setAgentId(e.target.value)}>
                <option value="">— Aucun agent —</option>
                {availableAgents.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.matricule} — {a.nom} {a.prenom}{!a.is_active ? ' (inactif)' : ''}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                Permet à l'agent de se connecter et de consulter ses propres données.
              </span>
            </div>
          </div>

          {/* ── Mot de passe (mode édition) ── */}
          {!isNew && (
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 12 }}>
              <button
                className="btn btn-sm"
                type="button"
                onClick={() => { setShowPasswordSection(v => !v); setNewPassword(''); }}
              >
                {showPasswordSection ? 'Annuler' : 'Changer le mot de passe'}
              </button>
              {showPasswordSection && (
                <div className="form-group" style={{ marginTop: 10 }}>
                  <label>
                    Nouveau mot de passe
                    <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>
                      (min. 6 caractères)
                    </span>
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    autoFocus
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!canSave || saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
