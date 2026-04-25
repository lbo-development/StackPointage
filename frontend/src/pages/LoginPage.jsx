import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
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

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label>Adresse email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="nom@service.fr"
              required
              autoFocus
              style={{ width: '100%' }}
            />
          </div>

          <div className="form-group">
            <label>Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{ width: '100%' }}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '8px', marginTop: 4 }}
          >
            {loading ? <><span className="loading-spinner" style={{ width: 12, height: 12 }} /> Connexion…</> : 'Connexion'}
          </button>
        </form>
      </div>
    </div>
  );
}
