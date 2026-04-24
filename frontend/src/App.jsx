import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import LoginPage from './pages/LoginPage.jsx';
import AppShell from './components/layout/AppShell.jsx';
import PointageMatrixPage from './pages/PointageMatrixPage.jsx';
import AgentsPage from './pages/AgentsPage.jsx';
import RoulementsPage from './pages/RoulementsPage.jsx';
import CodesPage from './pages/CodesPage.jsx';
import SpecialitesPage from './pages/SpecialitesPage.jsx';
import ServicesPage from './pages/ServicesPage.jsx';
import ProfilesPage from './pages/ProfilesPage.jsx';
import ConvocationsPage from './pages/ConvocationsPage.jsx';
import PrevisionsPage from './pages/PrevisionsPage.jsx';
import MonEspacePage from './pages/MonEspacePage.jsx';
import JoursFeriesPage from './pages/JoursFeriesPage.jsx';

function PrivateRoute({ children }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="loading-overlay"><div className="loading-spinner" /> Chargement…</div>;
  return session ? children : <Navigate to="/login" replace />;
}

function RoleRoute({ children, roles }) {
  const { profile } = useAuth();
  if (!roles.includes(profile?.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={
            <PrivateRoute>
              <AppShell />
            </PrivateRoute>
          }>
            <Route index element={<Navigate to="/matrice" replace />} />
            <Route path="matrice" element={<PointageMatrixPage />} />
            <Route path="agents" element={
              <RoleRoute roles={['admin_app','admin_service','pointeur']}>
                <AgentsPage />
              </RoleRoute>
            } />
            <Route path="roulements" element={
              <RoleRoute roles={['admin_app','admin_service']}>
                <RoulementsPage />
              </RoleRoute>
            } />
            <Route path="codes" element={
              <RoleRoute roles={['admin_app','admin_service']}>
                <CodesPage />
              </RoleRoute>
            } />
            <Route path="specialites" element={
              <RoleRoute roles={['admin_app','admin_service']}>
                <SpecialitesPage />
              </RoleRoute>
            } />
            <Route path="services" element={
              <RoleRoute roles={['admin_app','admin_service']}>
                <ServicesPage />
              </RoleRoute>
            } />
            <Route path="profils" element={
              <RoleRoute roles={['admin_app']}>
                <ProfilesPage />
              </RoleRoute>
            } />
            <Route path="jours-feries" element={
              <RoleRoute roles={['admin_app']}>
                <JoursFeriesPage />
              </RoleRoute>
            } />
            <Route path="convocations" element={<ConvocationsPage />} />
            <Route path="previsions" element={<PrevisionsPage />} />
            <Route path="mon-espace" element={<MonEspacePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
