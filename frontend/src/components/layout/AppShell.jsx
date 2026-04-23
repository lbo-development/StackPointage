import { useState, useEffect, useRef } from 'react';
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

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
    { path: '/convocations', label: 'Convocations', icon: '✉', show: !isAgent },
    { path: '/previsions', label: 'Prévisions', icon: '◷', show: !isAgent },
    { path: '/mon-espace', label: 'Mon Espace', icon: '◎', show: true }
  ].filter(n => n.show);

  const settingsItems = [
    { path: '/agents', label: 'Agents', icon: '◈', show: !isAgent },
    { path: '/roulements', label: 'Roulements', icon: '↻', show: isAdmin || isAdminService },
    { path: '/codes', label: 'Codes', icon: '◉', show: isAdmin || isAdminService },
    { path: '/specialites', label: 'Spécialités', icon: '◆', show: isAdmin || isAdminService },
    { path: '/services', label: 'Services', icon: '⊞', show: isAdmin || isAdminService },
    { path: '/profils', label: 'Profils', icon: '⊙', show: isAdmin },
  ].filter(n => n.show);

  function toggleService(serviceId) {
    setExpandedServices(prev => ({ ...prev, [serviceId]: !prev[serviceId] }));
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setSettingsOpen(false);
      }
    }
    if (settingsOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [settingsOpen]);

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
          <div className="sidebar-scrollable">
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
                    {svc.nb_agents > 0 && <span className="badge badge-count">{svc.nb_agents}</span>}
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
          </div>

          {settingsItems.length > 0 && (
            <div className="sidebar-footer" ref={settingsRef}>
              {settingsOpen && (
                <div className="settings-dropdown">
                  {settingsItems.map(item => (
                    <button
                      key={item.path}
                      className={`settings-dropdown-item ${location.pathname === item.path ? 'active' : ''}`}
                      onClick={() => { navigate(item.path); setSettingsOpen(false); }}
                    >
                      <span className="settings-dropdown-icon">{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="sidebar-footer-row">
                <button
                  className={`sidebar-settings-btn ${settingsOpen ? 'open' : ''}`}
                  onClick={() => setSettingsOpen(prev => !prev)}
                  title="Paramètres"
                >
                  <span className="settings-gear">⚙</span>
                  <span>Paramètres</span>
                </button>
                <button
                  className="sidebar-theme-btn"
                  onClick={toggleTheme}
                  title={theme === 'dark' ? 'Passer en mode jour' : 'Passer en mode nuit'}
                >
                  {theme === 'dark' ? '☀' : '☾'}
                </button>
              </div>
            </div>
          )}
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
          <span style={{ flex: 1 }}>{c.nom}</span>
          {c.nb_agents > 0 && <span className="badge badge-count">{c.nb_agents}</span>}
        </div>
      ))}
    </>
  );
}
