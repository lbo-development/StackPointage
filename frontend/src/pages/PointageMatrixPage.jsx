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
  const { api, can, profile, isAgent, isAdmin, isAdminService, isAssistantRH } = useAuth();
  const canManageCumuls = isAdmin || isAdminService;
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
  const [convocationModal, setConvocationModal] = useState(null); // { ag, dateStr, convocations }

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

  // Double-clic sur une cellule → modale convocations
  function handleDblClickCell(ag, dateStr, convocations) {
    setConvocationModal({ ag, dateStr, convocations });
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
          // Nouveau code == code théorique et pas de commentaire → supprimer le réel (le théorique reprend)
          if (theoriqueEntry && code === theoriqueEntry.code && !commentaire) {
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
            // Nouveau code == code théorique et pas de commentaire → rien à faire
            if (code === theoriqueEntry.code && !commentaire) continue;
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

  const modalResetProps = useMemo(() => {
    if (!pointageModal || !matrixData) return { showReset: false };
    const assignment = matrixData.agents.find(a => a.agent.id === pointageModal.agent.id);
    const isRange = pointageModal.dateDebut !== pointageModal.dateFin;
    const hasReel = dateRange(pointageModal.dateDebut, pointageModal.dateFin)
      .some(date => { const r = assignment?.reel[date]; return r && !r.is_locked; });
    const hasTheorique = !isRange && !!assignment?.theorique[pointageModal.dateDebut];
    return { showReset: hasReel || hasTheorique };
  }, [pointageModal, matrixData]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* TOOLBAR */}
      <div className="toolbar">

        {/* 1. Rafraîchir */}
        <button className="btn btn-sm btn-icon" onClick={loadMatrix} title="Rafraîchir">↺</button>

        {/* 2. Nom service / cellule */}
        {selectedService && (
          <span className="toolbar-context">
            {selectedService.nom}{selectedCellule ? ` › ${selectedCellule.nom}` : ''}
          </span>
        )}

        <div className="toolbar-sep" />

        {/* 3. Aujourd'hui */}
        <button className="btn btn-sm" onClick={goToToday}>Aujourd'hui</button>

        {/* 4. Période : ◀ date début → date fin ▶ */}
        <div className="toolbar-group">
          <button className="btn btn-sm btn-icon" onClick={() => shiftPeriod(-1)} title="Période précédente">◀</button>
          <input
            type="date"
            value={dateDebut}
            onChange={e => setDateDebut(e.target.value)}
            style={{ width: 115 }}
          />
          <span style={{ color: 'var(--text-muted)', fontSize: 11, whiteSpace: 'nowrap' }}>→ {dateFin}</span>
          <button className="btn btn-sm btn-icon" onClick={() => shiftPeriod(1)} title="Période suivante">▶</button>
        </div>

        {/* 5. Durée */}
        <div className="toggle-group">
          <button className={`toggle-btn ${duree === 31 ? 'active' : ''}`} onClick={() => handleDureeToggle(31)}>31j</button>
          <button className={`toggle-btn ${duree === 62 ? 'active' : ''}`} onClick={() => handleDureeToggle(62)}>62j</button>
        </div>

        {/* 6. Réel / Théorique */}
        <div className="toggle-group">
          <button className={`toggle-btn ${mode === 'reel'      ? 'active' : ''}`} onClick={() => setMode('reel')}>Réel</button>
          <button className={`toggle-btn ${mode === 'theorique' ? 'active' : ''}`} onClick={() => setMode('theorique')}>Théorique</button>
        </div>

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
          canViewStats={!isAgent}
          canManageCumuls={canManageCumuls}
          onRightClick={handleRightClick}
          onDblClickCell={handleDblClickCell}
          onRefreshMatrix={loadMatrix}
          serviceId={selectedService?.id || profile?.service_id}
          dateDebut={dateDebut}
          dateFin={dateFin}
        />
      )}

      {!loading && !filteredData && !error && (
        <div className="loading-overlay" style={{ flex: 1 }}>
          <span style={{ color: 'var(--text-muted)' }}>
            Sélectionnez un service dans la barre de gauche
          </span>
        </div>
      )}

      {pointageModal && (
        <PointageModal
          {...pointageModal}
          codes={matrixData?.codesMap ? Object.values(matrixData.codesMap) : []}
          onSave={handleSavePointage}
          onReset={modalResetProps.showReset ? handleResetPointage : undefined}
          onClose={() => setPointageModal(null)}
        />
      )}

      {convocationModal && (
        <ConvocationModal
          ag={convocationModal.ag}
          dateStr={convocationModal.dateStr}
          initialConvocs={convocationModal.convocations}
          serviceId={selectedService?.id || profile?.service_id}
          api={api}
          canEdit={can('edit_convocations')}
          canDelete={isAdmin || isAdminService || isAssistantRH}
          onClose={() => setConvocationModal(null)}
          onRefresh={loadMatrix}
        />
      )}
    </div>
  );
}

// ─── Modale convocations ─────────────────────────────────────────────────────

const CONVOC_TYPES = [
  { value: 'disciplinaire', label: 'Direction'      },
  { value: 'information',   label: 'Information'   },
  { value: 'formation',     label: 'Formation'      },
  { value: 'medical',       label: 'Médical'        },
  { value: 'autre',         label: 'Autre'          },
];
const CONVOC_STATUTS = [
  { value: '',          label: 'Aucun'    },
  { value: 'planifiee', label: 'Planifié' },
  { value: 'realisee',  label: 'Réalisé'  },
  { value: 'annulee',   label: 'Annulée'  },
];
const TYPE_LABEL   = Object.fromEntries(CONVOC_TYPES.map(t => [t.value, t.label]));
const STATUT_LABEL = Object.fromEntries(CONVOC_STATUTS.map(s => [s.value, s.label]));

function ConvocationModal({ ag, dateStr, initialConvocs, serviceId, api, canEdit, canDelete, onClose, onRefresh }) {
  const agent = ag.agent;
  const [convocs, setConvocs] = useState(initialConvocs);
  const [editing, setEditing] = useState(null); // null = liste, {} = nouveau, {id,...} = édition
  const [form, setForm]       = useState({ type: 'Convocation', intitule: '', statut: 'planifié', commentaire: '' });
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  const dateLabel = new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  function startCreate() {
    setForm({ type: 'disciplinaire', intitule: '', statut: '', commentaire: '' });
    setEditing({});
    setError('');
  }

  function startEdit(c) {
    setForm({ type: c.type || 'disciplinaire', intitule: c.intitule || '', statut: c.statut || '', commentaire: c.commentaire || '' });
    setEditing(c);
    setError('');
  }

  async function handleSave() {
    if (!form.intitule.trim()) { setError("L'intitulé est requis"); return; }
    setSaving(true);
    setError('');
    try {
      const body = { ...form, statut: form.statut || null, agent_id: agent.id, date: dateStr, service_id: serviceId };
      if (editing.id) {
        const updated = await api.put(`/convocations/${editing.id}`, body);
        setConvocs(prev => prev.map(c => c.id === editing.id ? { ...c, ...updated } : c));
      } else {
        const created = await api.post('/convocations', body);
        setConvocs(prev => [...prev, created]);
      }
      setEditing(null);
      onRefresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Supprimer cette convocation ?')) return;
    try {
      await api.delete(`/convocations/${id}`);
      setConvocs(prev => prev.filter(c => c.id !== id));
      onRefresh();
    } catch (e) {
      alert('Erreur : ' + e.message);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440, width: '95vw' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">
            {agent.prenom} {agent.nom}
            <span style={{ fontWeight: 400, marginLeft: 6, fontSize: 13, color: 'var(--text-muted)' }}>{dateLabel}</span>
          </span>
          <button className="btn btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {editing === null ? (
            <>
              {convocs.length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: 12, fontStyle: 'italic' }}>
                  Aucune convocation enregistrée pour ce jour
                </div>
              )}
              {convocs.map(c => (
                <div key={c.id} style={{
                  padding: '8px 10px', background: 'var(--bg-surface)',
                  border: '1px solid var(--border)', borderRadius: 6, fontSize: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, justifyContent: 'space-between' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span className="badge badge-blue" style={{ fontSize: 10 }}>{TYPE_LABEL[c.type] ?? c.type}</span>
                        {c.statut && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{STATUT_LABEL[c.statut] ?? c.statut}</span>}
                      </div>
                      <div style={{ fontWeight: 600 }}>{c.intitule}</div>
                      {c.commentaire && <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>{c.commentaire}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      {canEdit && (
                        <button className="btn btn-sm" onClick={() => startEdit(c)}>Éditer</button>
                      )}
                      {canDelete && (
                        <button className="btn btn-sm" style={{ color: '#f87171' }} onClick={() => handleDelete(c.id)}>✕</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {canEdit && (
                <button className="btn btn-primary" onClick={startCreate} style={{ marginTop: 4 }}>
                  + Ajouter une convocation
                </button>
              )}
            </>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select className="form-control" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                    {CONVOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Intitulé *</label>
                  <input
                    className="form-control"
                    value={form.intitule}
                    onChange={e => setForm(p => ({ ...p, intitule: e.target.value }))}
                    placeholder="Objet de la convocation"
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Statut</label>
                  <select className="form-control" value={form.statut} onChange={e => setForm(p => ({ ...p, statut: e.target.value }))}>
                    {CONVOC_STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Commentaire</label>
                  <textarea
                    className="form-control"
                    value={form.commentaire}
                    onChange={e => setForm(p => ({ ...p, commentaire: e.target.value }))}
                    rows={2}
                    placeholder="Optionnel"
                  />
                </div>
                {error && <div style={{ fontSize: 12, color: '#f87171' }}>{error}</div>}
                <div className="modal-footer">
                  <button className="btn" onClick={() => setEditing(null)}>Annuler</button>
                  <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    {saving ? 'Enregistrement…' : editing.id ? 'Enregistrer' : 'Créer'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
