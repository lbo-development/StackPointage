import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

const ROLE_LABELS = {
  admin_app: 'Administrateur applicatif',
  admin_service: 'Administrateur de service',
  pointeur: 'Pointeur',
  assistant_rh: 'Assistant RH',
  agent: 'Agent'
};

export default function MonEspacePage() {
  const { api, profile, logout } = useAuth();
  const [convocations, setConvocations] = useState([]);
  const [pointages, setPointages] = useState([]);

  useEffect(() => {
    if (!api || !profile) return;
    // Récupération convocations de l'agent
    api.get(`/convocations?agent_id=${profile.id}`)
      .then(setConvocations).catch(() => {});
  }, [api, profile]);

  if (!profile) return null;

  const initiales = `${profile.prenom?.[0] || ''}${profile.nom?.[0] || ''}`.toUpperCase();

  return (
    <div className="page-wrapper">
      <h1 className="page-title">Mon Espace</h1>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', maxWidth: 800 }}>
        {/* Carte profil */}
        <div style={{
          flex: '0 0 280px',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 24
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'var(--accent-dim)', border: '2px solid var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 18, color: 'var(--accent)',
              fontFamily: 'var(--font-mono)', flexShrink: 0
            }}>
              {initiales}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                {profile.prenom} {profile.nom}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {profile.email}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Rôle</span>
              <span className="badge badge-blue">{ROLE_LABELS[profile.role] || profile.role}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Statut</span>
              <span className={`badge ${profile.is_active ? 'badge-green' : 'badge-red'}`}>
                {profile.is_active ? 'Actif' : 'Inactif'}
              </span>
            </div>
          </div>

          <button
            className="btn btn-danger"
            onClick={logout}
            style={{ width: '100%', justifyContent: 'center', marginTop: 20 }}
          >
            Se déconnecter
          </button>
        </div>

        {/* Aide selon le rôle */}
        <div style={{ flex: 1, minWidth: 260 }}>
          <RoleGuide role={profile.role} />
        </div>
      </div>

      {/* Convocations pour agents */}
      {convocations.length > 0 && (
        <div style={{ marginTop: 20, maxWidth: 600 }}>
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 13 }}>
            Mes convocations ({convocations.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {convocations.map(c => (
              <div key={c.id} style={{
                background: 'var(--bg-panel)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '12px 16px',
                borderLeft: `3px solid ${c.statut === 'realisee' ? 'var(--success)' : c.statut === 'annulee' ? 'var(--danger)' : 'var(--warning)'}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{c.intitule}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {new Date(c.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      {' · '}{c.type}
                    </div>
                    {c.commentaire && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>{c.commentaire}</div>
                    )}
                  </div>
                  <span className={`badge ${c.statut === 'realisee' ? 'badge-green' : c.statut === 'annulee' ? 'badge-red' : 'badge-yellow'}`}>
                    {c.statut}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RoleGuide({ role }) {
  const guides = {
    admin_app: {
      title: 'Administrateur applicatif',
      color: 'var(--accent)',
      items: [
        'Accès total à tous les services et fonctionnalités',
        'Création et gestion de tous les services, cellules, spécialités',
        'Gestion des utilisateurs et des rôles',
        'Export Excel de toutes les données',
        'Lecture seule sur mobile'
      ]
    },
    admin_service: {
      title: 'Administrateur de service',
      color: 'var(--info)',
      items: [
        'Accès limité à votre service uniquement',
        'Gestion des agents de votre service',
        'Saisie et modification des pointages',
        'Création, modification et suppression des convocations',
        'Desktop uniquement'
      ]
    },
    pointeur: {
      title: 'Pointeur',
      color: 'var(--success)',
      items: [
        'Saisie des pointages réels (unitaire et en période)',
        'Gestion des prévisions d\'absence',
        'Création de convocations',
        'Accès multi-cellules de votre service',
        'Interface simplifiée sur mobile'
      ]
    },
    assistant_rh: {
      title: 'Assistant RH',
      color: 'var(--warning)',
      items: [
        'Création, modification et suppression des convocations',
        'Lecture seule des pointages de tous les services (pas de modification)',
        'Accès à tous les services via la matrice et le menu convocations',
        'Desktop uniquement'
      ]
    },
    agent: {
      title: 'Agent',
      color: '#a78bfa',
      items: [
        'Consultation de vos pointages',
        'Consultation de vos absences et prévisions',
        'Consultation de vos convocations',
        'Accès mobile uniquement'
      ]
    }
  };

  const guide = guides[role];
  if (!guide) return null;

  return (
    <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 8, padding: 20 }}>
      <div style={{ fontWeight: 600, marginBottom: 12, color: guide.color }}>{guide.title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {guide.items.map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, alignItems: 'flex-start' }}>
            <span style={{ color: guide.color, flexShrink: 0, marginTop: 1 }}>▸</span>
            <span style={{ color: 'var(--text-secondary)' }}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
