import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

const ROLE_LABELS = {
  admin_app: 'Admin App',
  admin_service: 'Admin Service',
  pointeur: 'Pointeur',
  assistant_rh: 'Assistant RH',
  agent: 'Agent'
};

export default function AppShell() {
  const { profile, api, logout, isAdmin, isAdminService, isPointeur, isAssistantRH, isAgent } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedCellule, setSelectedCellule] = useState(null);
  const [expandedServices, setExpandedServices] = useState({});

  useEffect(() => {
    if (!api) return;
    api.get('/services').then(data => {
      setServices(data);
      // Auto-sélection du service de l'utilisateur
      if (profile?.service_id && !selectedService) {
        const svc = data.find(s => s.id === profile.service_id);
        if (svc) {
          setSelectedService(svc);
          setExpandedServices(prev => ({ ...prev, [svc.id]: true }));
        }
      } else if (isAdmin && data.length > 0 && !selectedService) {
        setSelectedService(data[0]);
      }
    }).catch(console.error);
  }, [api]);

  const navItems = [
    { path: '/matrice', label: 'Matrice', icon: '▦', show: true },
    { path: '/agents', label: 'Agents', icon: '◈', show: !isAgent },
    { path: '/roulements', label: 'Roulements', icon: '↻', show: isAdmin || isAdminService },
    { path: '/codes', label: 'Codes', icon: '◉', show: isAdmin || isAdminService },
    { path: '/convocations', label: 'Convocations', icon: '✉', show: !isAgent },
    { path: '/previsions', label: 'Prévisions', icon: '◷', show: !isAgent },
    { path: '/mon-espace', label: 'Mon Espace', icon: '◎', show: true }
  ].filter(n => n.show);

  function toggleService(serviceId) {
    setExpandedServices(prev => ({ ...prev, [serviceId]: !prev[serviceId] }));
  }

  // Partage de l'état service/cellule sélectionné avec les pages enfants via context ou state
  // Pour simplifier, on passe via URL params ou via un context dédié
  // Ici on stocke dans sessionStorage pour que les pages y accèdent
  useEffect(() => {
    if (selectedService) {
      sessionStorage.setItem('selectedService', JSON.stringify(selectedService));
    }
  }, [selectedService]);

  useEffect(() => {
    if (selectedCellule) {
      sessionStorage.setItem('selectedCellule', JSON.stringify(selectedCellule));
    } else {
      sessionStorage.removeItem('selectedCellule');
    }
  }, [selectedCellule]);

  return (
    <div className="app-shell">
      {/* HEADER */}
      <header className="app-header">
        <span className="logo">⬡ Pointage</span>

        <nav style={{ display: 'flex', gap: 2, flex: 1 }}>
          {navItems.map(item => (
            <button
              key={item.path}
              className={`nav-tab ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span style={{ marginRight: 4 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {profile?.prenom} {profile?.nom}
          </span>
          <span className="badge badge-blue">{ROLE_LABELS[profile?.role]}</span>
          <button className="btn btn-sm" onClick={logout}>Déconnexion</button>
        </div>
      </header>

      {/* BODY */}
      <div className="app-body">
        {/* SIDEBAR - Arborescence Services/Cellules */}
        <aside className="sidebar">
          <div className="sidebar-section">
            <div className="sidebar-section-header">Services</div>
            {services.map(svc => (
              <div key={svc.id}>
                <div
                  className={`tree-item ${selectedService?.id === svc.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedService(svc);
                    setSelectedCellule(null);
                    toggleService(svc.id);
                  }}
                >
                  <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                    {expandedServices[svc.id] ? '▾' : '▸'}
                  </span>
                  <span style={{ flex: 1 }}>{svc.nom}</span>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{svc.code}</span>
                </div>

                {expandedServices[svc.id] && (
                  <CellulesTree
                    serviceId={svc.id}
                    api={api}
                    selectedCellule={selectedCellule}
                    onSelect={(c) => { setSelectedCellule(c); setSelectedService(svc); }}
                  />
                )}
              </div>
            ))}
          </div>
        </aside>

        {/* CONTENU PRINCIPAL */}
        <main className="main-content">
          <Outlet context={{ selectedService, selectedCellule, setSelectedService, setSelectedCellule }} />
        </main>
      </div>
    </div>
  );
}

function CellulesTree({ serviceId, api, selectedCellule, onSelect }) {
  const [cellules, setCellules] = useState([]);

  useEffect(() => {
    if (!api || !serviceId) return;
    api.get(`/services/${serviceId}/cellules`).then(setCellules).catch(console.error);
  }, [api, serviceId]);

  return (
    <>
      {cellules.map(c => (
        <div
          key={c.id}
          className={`tree-item child ${selectedCellule?.id === c.id ? 'active' : ''}`}
          onClick={() => onSelect(c)}
        >
          <span className="dot" style={{ background: c.couleur }} />
          {c.nom}
        </div>
      ))}
    </>
  );
}
