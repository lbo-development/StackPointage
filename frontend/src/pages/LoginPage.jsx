import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

// ============================================================
// Combobox — sélection du profil par nom
// ============================================================
function ProfileCombobox({ profiles, selectedId, onSelect, disabled }) {
  const [inputValue, setInputValue]   = useState('');
  const [open, setOpen]               = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const wrapperRef = useRef(null);
  const inputRef   = useRef(null);

  const filtered = inputValue
    ? profiles.filter(p => {
        const full = `${p.prenom} ${p.nom}`.toLowerCase();
        const rev  = `${p.nom} ${p.prenom}`.toLowerCase();
        return full.includes(inputValue.toLowerCase()) || rev.includes(inputValue.toLowerCase());
      })
    : profiles;

  // Affiche le nom sélectionné quand selectedId change depuis l'extérieur
  useEffect(() => {
    if (!selectedId) return;
    const p = profiles.find(p => p.id === selectedId);
    if (p) setInputValue(`${p.prenom} ${p.nom}`);
  }, [selectedId, profiles]);

  function handleInput(e) {
    setInputValue(e.target.value);
    onSelect(null);          // efface la sélection dès que l'utilisateur retape
    setOpen(true);
    setHighlighted(-1);
  }

  function handleSelect(profile) {
    setInputValue(`${profile.prenom} ${profile.nom}`);
    onSelect(profile.id);
    setOpen(false);
    setHighlighted(-1);
  }

  function handleKeyDown(e) {
    if (!open) { if (e.key === 'ArrowDown') setOpen(true); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(h => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' && highlighted >= 0) {
      e.preventDefault();
      handleSelect(filtered[highlighted]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  function handleBlur() {
    // Délai pour laisser onMouseDown des options s'exécuter avant
    setTimeout(() => {
      setOpen(false);
      // Si rien de sélectionné, vide le champ
      if (!selectedId) setInputValue('');
    }, 150);
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInput}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="Rechercher votre nom…"
        autoComplete="off"
        disabled={disabled}
        required
        style={{ width: '100%' }}
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0,
          background: 'var(--bg-panel)', border: '1px solid var(--border-light)',
          borderRadius: 6, zIndex: 200, maxHeight: 220, overflowY: 'auto',
          boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
        }}>
          {filtered.map((p, i) => (
            <div
              key={p.id}
              onMouseDown={() => handleSelect(p)}
              style={{
                padding: '7px 12px', cursor: 'pointer', fontSize: 13,
                background: i === highlighted ? 'var(--bg-hover)' : 'transparent',
                transition: 'background 0.1s',
              }}
              onMouseEnter={() => setHighlighted(i)}
              onMouseLeave={() => setHighlighted(-1)}
            >
              {p.prenom} {p.nom}
            </div>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && inputValue && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0,
          background: 'var(--bg-panel)', border: '1px solid var(--border-light)',
          borderRadius: 6, zIndex: 200, padding: '8px 12px',
          fontSize: 12, color: 'var(--text-muted)',
        }}>
          Aucun résultat
        </div>
      )}
    </div>
  );
}

// ============================================================
// Page de connexion
// ============================================================
export default function LoginPage() {
  const { login }  = useAuth();
  const navigate   = useNavigate();

  const [profiles,    setProfiles]    = useState([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [selectedId,  setSelectedId]  = useState(null);
  const [password,    setPassword]    = useState('');
  const [error,       setError]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [emailMode,   setEmailMode]   = useState(false); // fallback admin
  const [email,       setEmail]       = useState('');
  const [pwdUnlocked, setPwdUnlocked] = useState(false);
  const [emailUnlocked, setEmailUnlocked] = useState(false);

  // Chargement de la liste des profils (endpoint public, sans auth)
  useEffect(() => {
    fetch(`${API_BASE}/auth/users-list`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setProfiles(data))
      .catch(() => setProfiles([]))
      .finally(() => setProfilesLoading(false));
  }, []);

  // Efface le mot de passe et reset le verrou à chaque changement de profil
  useEffect(() => {
    setPassword('');
    setPwdUnlocked(false);
  }, [selectedId, emailMode]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!emailMode && !selectedId) {
      setError('Veuillez sélectionner votre nom dans la liste.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const credentials = emailMode
        ? { email, password }
        : { profile_id: selectedId, password };
      await login(credentials);
      navigate('/matrice');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
          <img src="/logo.png" alt="Digital Bonsaï" style={{ height: 40, width: 'auto' }} />
          <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1, gap: 4 }}>
            <span style={{
              fontWeight: 700, letterSpacing: '-0.02em', fontSize: 20,
              background: 'linear-gradient(135deg, #2d6e26 0%, #8dc63f 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              SIPRA
            </span>
            <span style={{ fontSize: 7.5, fontWeight: 600, letterSpacing: '0.08em', wordSpacing: '-0.15em', textTransform: 'uppercase', color: '#8dc63f' }}>
              Suivi <span style={{ fontWeight: 800 }}>PR</span>ésence Absence
            </span>
          </span>
        </div>

        <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', margin: '0 0 16px' }}>
          Poste partagé — saisissez votre mot de passe personnel
        </p>

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit} autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {emailMode ? (
            <div className="form-group">
              <label>Adresse email</label>
              <input
                type="email"
                name="sipra-login"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="nom@service.fr"
                autoComplete="off"
                readOnly={!emailUnlocked}
                onFocus={() => setEmailUnlocked(true)}
                required
                autoFocus
                style={{ width: '100%' }}
              />
            </div>
          ) : (
            <div className="form-group">
              <label>Votre nom</label>
              <ProfileCombobox
                profiles={profiles}
                selectedId={selectedId}
                onSelect={setSelectedId}
                disabled={profilesLoading}
              />
            </div>
          )}

          <div className="form-group">
            <label>Mot de passe</label>
            <input
              type="text"
              name="sipra-pwd"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="off"
              data-lpignore="true"
              data-1p-ignore="true"
              readOnly={!pwdUnlocked}
              onFocus={() => setPwdUnlocked(true)}
              required
              style={{ width: '100%', WebkitTextSecurity: 'disc', fontFamily: 'monospace' }}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || (!emailMode && !selectedId)}
            style={{ width: '100%', justifyContent: 'center', padding: '8px', marginTop: 4 }}
          >
            {loading
              ? <><span className="loading-spinner" style={{ width: 12, height: 12 }} /> Connexion…</>
              : 'Connexion'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <button
            type="button"
            onClick={() => { setEmailMode(m => !m); setError(''); setSelectedId(null); setEmail(''); setPassword(''); }}
            style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
          >
            {emailMode ? '← Retour à la liste des agents' : 'Connexion par adresse email'}
          </button>
        </div>
      </div>
    </div>
  );
}
