import { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import PointageMatrix from '../components/matrix/PointageMatrix.jsx';
import PointageModal from '../components/matrix/PointageModal.jsx';

// Formate en YYYY-MM-DD en heure locale (évite le décalage UTC)
function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function parseLocal(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export default function PointageMatrixPage() {
  const { api, can, profile } = useAuth();
  const { selectedService, selectedCellule } = useOutletContext();

  const [duree, setDuree]         = useState(31);   // 31 ou 62 jours
  const [dateDebut, setDateDebut] = useState(() => formatDate(new Date()));
  const [mode, setMode]           = useState('reel');

  // dateFin toujours dérivé de dateDebut + duree - 1
  const dateFin = useMemo(
    () => formatDate(addDays(parseLocal(dateDebut), duree - 1)),
    [dateDebut, duree]
  );

  const [matrixData, setMatrixData] = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  const [pointageModal, setPointageModal] = useState(null);

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

  const filteredData = matrixData ? {
    ...matrixData,
    agents: selectedCellule
      ? matrixData.agents.filter(a => a.cellule_id === selectedCellule.id)
      : matrixData.agents
  } : null;

  // --- Navigation ---
  function shiftPeriod(dir) {
    setDateDebut(prev => formatDate(addDays(parseLocal(prev), dir * duree)));
  }

  function goToToday() {
    setDateDebut(formatDate(new Date()));
  }

  // --- Combobox mois ---
  const monthOptions = useMemo(() => {
    const today = new Date();
    const opts = [];
    for (let i = -3; i <= 12; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      opts.push({
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
      });
    }
    return opts;
  }, []);

  // Valeur sélectionnée = mois du dateDebut si le 1er du mois, sinon vide
  const selectedMonthValue = useMemo(() => {
    const d = parseLocal(dateDebut);
    if (d.getDate() !== 1) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, [dateDebut]);

  function handleMonthSelect(e) {
    const val = e.target.value;
    if (!val) return;
    const [y, m] = val.split('-').map(Number);
    setDateDebut(formatDate(new Date(y, m - 1, 1)));
  }

  function handleDureeToggle(d) {
    setDuree(d);
    // dateFin se recalcule automatiquement via useMemo
  }

  // --- Pointage ---

  // Clic droit sur une cellule (plage sélectionnée ou cellule seule)
  function handleRightClick(agent, dateDebut, dateFin, currentCode, currentCommentaire = '') {
    if (!can('edit_pointage')) return;
    setPointageModal({ agent, dateDebut, dateFin, currentCode, currentCommentaire });
  }

  async function handleResetPointage({ agentId, dateDebut, dateFin }) {
    try {
      const assignment = matrixData?.agents.find(a => a.agent.id === agentId);
      const toDelete = dateRange(dateDebut, dateFin)
        .map(date => assignment?.reel[date])
        .filter(reel => reel && !reel.is_locked && reel.id);
      await Promise.all(toDelete.map(reel => api.delete(`/pointages/${reel.id}`)));
      setPointageModal(null);
      loadMatrix();
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  }

  // Génère toutes les dates entre debut et fin inclus
  function dateRange(debut, fin) {
    const dates = [];
    let cur = parseLocal(debut);
    const end = parseLocal(fin);
    while (cur <= end) {
      dates.push(formatDate(cur));
      cur = addDays(cur, 1);
    }
    return dates;
  }

  async function handleSavePointage({ agentId, dateDebut, dateFin, code, commentaire }) {
    try {
      const assignment = matrixData?.agents.find(a => a.agent.id === agentId);
      const serviceId  = selectedService?.id || profile?.service_id;
      const codesMap   = matrixData?.codesMap || {};

      const toSave   = []; // dates où on enregistre le code réel
      const toDelete = []; // ids de pointages réels à supprimer
      const isRange  = dateDebut !== dateFin;

      for (const date of dateRange(dateDebut, dateFin)) {
        const reelEntry      = assignment?.reel[date];
        const theoriqueEntry = assignment?.theorique[date];

        if (reelEntry) {
          // Code réel existant : verrouillé ou FE sur une plage → on ne touche pas
          if (reelEntry.is_locked) continue;
          if (isRange && reelEntry.code === 'FE') continue;
          // Nouveau code == code théorique → supprimer le réel (le théorique reprend)
          if (theoriqueEntry && code === theoriqueEntry.code) {
            if (reelEntry.id) toDelete.push(reelEntry.id);
          } else {
            toSave.push(date);
          }
        } else {
          // Pas de code réel, code théorique seul
          if (theoriqueEntry) {
            const codeObj = codesMap[theoriqueEntry.code];
            // Code théorique verrouillé → on ne touche pas
            if (codeObj?.is_locked) continue;
            // Nouveau code == code théorique → rien à faire
            if (code === theoriqueEntry.code) continue;
          }
          toSave.push(date);
        }
      }

      await Promise.all([
        ...toSave.map(date => api.post('/pointages', {
          agent_id: agentId, date, code_pointage: code, commentaire,
          service_id: serviceId, cellule_id: assignment?.cellule_id
        })),
        ...toDelete.map(id => api.delete(`/pointages/${id}`))
      ]);

      setPointageModal(null);
      loadMatrix();
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  }

  async function handleExport() {
    try {
      await api.downloadExcel({
        service_id: selectedService?.id || profile?.service_id,
        date_debut: dateDebut, date_fin: dateFin
      });
    } catch (err) {
      alert('Export échoué: ' + err.message);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* TOOLBAR */}
      <div className="toolbar">
        <button className="btn btn-sm" onClick={() => shiftPeriod(-1)}>◀</button>
        <button className="btn btn-sm" onClick={goToToday}>Aujourd'hui</button>
        <button className="btn btn-sm" onClick={() => shiftPeriod(1)}>▶</button>

        <select
          value={selectedMonthValue}
          onChange={handleMonthSelect}
          style={{ minWidth: 150 }}
        >
          <option value="">— Mois —</option>
          {monthOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <input
          type="date"
          value={dateDebut}
          onChange={e => setDateDebut(e.target.value)}
          style={{ width: 130 }}
        />
        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>→ {dateFin}</span>

        <div className="toggle-group">
          <button className={`toggle-btn ${duree === 31 ? 'active' : ''}`} onClick={() => handleDureeToggle(31)}>31j</button>
          <button className={`toggle-btn ${duree === 62 ? 'active' : ''}`} onClick={() => handleDureeToggle(62)}>62j</button>
        </div>

        <div className="toggle-group">
          <button className={`toggle-btn ${mode === 'reel' ? 'active' : ''}`} onClick={() => setMode('reel')}>Réel</button>
          <button className={`toggle-btn ${mode === 'theorique' ? 'active' : ''}`} onClick={() => setMode('theorique')}>Théorique</button>
        </div>

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

      {error && <div className="alert alert-error" style={{ margin: '8px 16px' }}>{error}</div>}

      {loading && (
        <div className="loading-overlay" style={{ flex: 1 }}>
          <div className="loading-spinner" />
          Chargement de la matrice…
        </div>
      )}

      {!loading && filteredData && (
        <PointageMatrix
          data={filteredData}
          mode={mode}
          canEdit={can('edit_pointage')}
          onRightClick={handleRightClick}
        />
      )}

      {!loading && !filteredData && !error && (
        <div className="loading-overlay" style={{ flex: 1 }}>
          <span style={{ color: 'var(--text-muted)' }}>
            Sélectionnez un service dans la barre de gauche
          </span>
        </div>
      )}

      {pointageModal && (() => {
        const assignment = matrixData?.agents.find(a => a.agent.id === pointageModal.agent.id);
        const hasReel = dateRange(pointageModal.dateDebut, pointageModal.dateFin)
          .some(date => { const r = assignment?.reel[date]; return r && !r.is_locked; });
        return (
          <PointageModal
            {...pointageModal}
            codes={matrixData?.codesMap ? Object.values(matrixData.codesMap) : []}
            onSave={handleSavePointage}
            onReset={hasReel ? handleResetPointage : undefined}
            onClose={() => setPointageModal(null)}
          />
        );
      })()}
    </div>
  );
}
