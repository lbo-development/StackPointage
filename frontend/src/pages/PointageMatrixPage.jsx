import { useState, useEffect, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import PointageMatrix from '../components/matrix/PointageMatrix.jsx';
import ContextMenu from '../components/matrix/ContextMenu.jsx';
import PointageModal from '../components/matrix/PointageModal.jsx';
import PeriodeModal from '../components/matrix/PeriodeModal.jsx';

function formatDate(d) { return d.toISOString().split('T')[0]; }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

export default function PointageMatrixPage() {
  const { api, can, profile } = useAuth();
  const { selectedService, selectedCellule } = useOutletContext();

  // Plage de dates
  const [dateDebut, setDateDebut] = useState(() => formatDate(addDays(new Date(), -7)));
  const [dateFin, setDateFin] = useState(() => formatDate(addDays(new Date(), 7)));
  const [mode, setMode] = useState('reel'); // 'reel' | 'theorique'
  const [periode, setPeriode] = useState('15j'); // '15j' | 'mois'

  // Données matrice
  const [matrixData, setMatrixData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // UI
  const [contextMenu, setContextMenu] = useState(null);
  const [pointageModal, setPointageModal] = useState(null);
  const [periodeModal, setPeriodeModal] = useState(false);

  const loadMatrix = useCallback(async () => {
    const serviceId = selectedService?.id || profile?.service_id;
    if (!api || !serviceId) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.get(
        `/pointages/matrix?service_id=${serviceId}&date_debut=${dateDebut}&date_fin=${dateFin}`
      );
      setMatrixData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [api, selectedService, profile, dateDebut, dateFin]);

  useEffect(() => { loadMatrix(); }, [loadMatrix]);

  // Filtre par cellule si sélectionnée
  const filteredData = matrixData ? {
    ...matrixData,
    agents: selectedCellule
      ? matrixData.agents.filter(a => a.cellule_id === selectedCellule.id)
      : matrixData.agents
  } : null;

  // Navigation temporelle
  function shiftPeriod(dir) {
    const days = periode === 'mois' ? 30 : 15;
    setDateDebut(formatDate(addDays(new Date(dateDebut), dir * days)));
    setDateFin(formatDate(addDays(new Date(dateFin), dir * days)));
  }

  function goToToday() {
    const days = periode === 'mois' ? 30 : 15;
    setDateDebut(formatDate(addDays(new Date(), -Math.floor(days / 2))));
    setDateFin(formatDate(addDays(new Date(), Math.floor(days / 2))));
  }

  function setPeriodeMode(p) {
    setPeriode(p);
    const today = new Date();
    if (p === 'mois') {
      setDateDebut(formatDate(new Date(today.getFullYear(), today.getMonth(), 1)));
      setDateFin(formatDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)));
    } else {
      setDateDebut(formatDate(addDays(today, -7)));
      setDateFin(formatDate(addDays(today, 7)));
    }
  }

  // Clic sur cellule de pointage
  function handleCellClick(agent, date, currentCode, isLocked) {
    if (!can('edit_pointage')) return;
    if (isLocked) return;
    setPointageModal({ agent, date, currentCode });
    setContextMenu(null);
  }

  // Clic droit sur cellule
  function handleCellContextMenu(e, agent, date, currentCode) {
    e.preventDefault();
    const codes = matrixData?.codesMap ? Object.values(matrixData.codesMap) : [];
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      agent,
      date,
      currentCode,
      codes,
      convocations: filteredData?.agents.find(a => a.agent.id === agent.id)?.convocations?.[date] || []
    });
  }

  async function handleSavePointage({ agentId, date, code, commentaire }) {
    try {
      const assignment = matrixData?.agents.find(a => a.agent.id === agentId);
      await api.post('/pointages', {
        agent_id: agentId,
        date,
        code_pointage: code,
        commentaire,
        service_id: selectedService?.id || profile?.service_id,
        cellule_id: assignment?.cellule_id
      });
      setPointageModal(null);
      loadMatrix();
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  }

  async function handleCodeFromContextMenu(code) {
    if (!contextMenu || !can('edit_pointage')) return;
    const { agent, date } = contextMenu;
    try {
      const assignment = matrixData?.agents.find(a => a.agent.id === agent.id);
      await api.post('/pointages', {
        agent_id: agent.id,
        date,
        code_pointage: code,
        service_id: selectedService?.id || profile?.service_id,
        cellule_id: assignment?.cellule_id
      });
      setContextMenu(null);
      loadMatrix();
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  }

  async function handleExport() {
    try {
      await api.downloadExcel({
        service_id: selectedService?.id || profile?.service_id,
        date_debut: dateDebut,
        date_fin: dateFin
      });
    } catch (err) {
      alert('Export échoué: ' + err.message);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* TOOLBAR */}
      <div className="toolbar">
        <div className="toggle-group">
          <button className={`toggle-btn ${periode === '15j' ? 'active' : ''}`} onClick={() => setPeriodeMode('15j')}>15j</button>
          <button className={`toggle-btn ${periode === 'mois' ? 'active' : ''}`} onClick={() => setPeriodeMode('mois')}>Mois</button>
        </div>

        <button className="btn btn-sm" onClick={() => shiftPeriod(-1)}>◀</button>
        <button className="btn btn-sm" onClick={goToToday}>Aujourd'hui</button>
        <button className="btn btn-sm" onClick={() => shiftPeriod(1)}>▶</button>

        <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} style={{ width: 130 }} />
        <span style={{ color: 'var(--text-muted)' }}>→</span>
        <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} style={{ width: 130 }} />

        <div className="toggle-group">
          <button className={`toggle-btn ${mode === 'reel' ? 'active' : ''}`} onClick={() => setMode('reel')}>Réel</button>
          <button className={`toggle-btn ${mode === 'theorique' ? 'active' : ''}`} onClick={() => setMode('theorique')}>Théorique</button>
        </div>

        {can('edit_pointage') && (
          <button className="btn btn-sm" onClick={() => setPeriodeModal(true)}>
            ⊞ Saisie période
          </button>
        )}

        <button className="btn btn-sm" onClick={handleExport} style={{ marginLeft: 'auto' }}>
          ↓ Export Excel
        </button>

        <button className="btn btn-sm" onClick={loadMatrix}>↺ Rafraîchir</button>

        {selectedService && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {selectedService.nom}{selectedCellule ? ` › ${selectedCellule.nom}` : ''}
          </span>
        )}
      </div>

      {/* MESSAGES */}
      {error && <div className="alert alert-error" style={{ margin: '8px 16px' }}>{error}</div>}

      {loading && (
        <div className="loading-overlay" style={{ flex: 1 }}>
          <div className="loading-spinner" />
          Chargement de la matrice…
        </div>
      )}

      {/* MATRICE */}
      {!loading && filteredData && (
        <PointageMatrix
          data={filteredData}
          mode={mode}
          canEdit={can('edit_pointage')}
          onCellClick={handleCellClick}
          onCellContextMenu={handleCellContextMenu}
        />
      )}

      {!loading && !filteredData && !error && (
        <div className="loading-overlay" style={{ flex: 1 }}>
          <span style={{ color: 'var(--text-muted)' }}>
            Sélectionnez un service dans la barre de gauche
          </span>
        </div>
      )}

      {/* MODALS / MENUS */}
      {contextMenu && (
        <ContextMenu
          {...contextMenu}
          canEdit={can('edit_pointage')}
          onSelectCode={handleCodeFromContextMenu}
          onClose={() => setContextMenu(null)}
          onOpenModal={() => {
            setPointageModal({ agent: contextMenu.agent, date: contextMenu.date, currentCode: contextMenu.currentCode });
            setContextMenu(null);
          }}
        />
      )}

      {pointageModal && (
        <PointageModal
          {...pointageModal}
          codes={matrixData?.codesMap ? Object.values(matrixData.codesMap) : []}
          onSave={handleSavePointage}
          onClose={() => setPointageModal(null)}
        />
      )}

      {periodeModal && (
        <PeriodeModal
          agents={matrixData?.agents || []}
          codes={matrixData?.codesMap ? Object.values(matrixData.codesMap) : []}
          serviceId={selectedService?.id || profile?.service_id}
          defaultDateDebut={dateDebut}
          defaultDateFin={dateFin}
          api={api}
          onClose={() => setPeriodeModal(false)}
          onSaved={() => { setPeriodeModal(false); loadMatrix(); }}
        />
      )}
    </div>
  );
}
