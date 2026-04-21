import { useState } from 'react';

export default function PeriodeModal({ agents, codes, serviceId, defaultDateDebut, defaultDateFin, api, onClose, onSaved }) {
  const [selectedAgents, setSelectedAgents] = useState([]);
  const [code, setCode] = useState('');
  const [dateDebut, setDateDebut] = useState(defaultDateDebut);
  const [dateFin, setDateFin] = useState(defaultDateFin);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  function toggleAgent(agId) {
    setSelectedAgents(prev => prev.includes(agId) ? prev.filter(id => id !== agId) : [...prev, agId]);
  }

  async function handleSave() {
    if (!selectedAgents.length || !code || !dateDebut || !dateFin) return;
    setSaving(true);
    try {
      const res = await api.post('/pointages/periode', {
        agent_ids: selectedAgents, date_debut: dateDebut, date_fin: dateFin,
        code_pointage: code, service_id: serviceId
      });
      setResult(res);
    } catch (err) {
      alert('Erreur: ' + err.message);
    } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ minWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Saisie en période</span>
          <button className="btn btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {result ? (
            <div>
              <div className="alert alert-success">✓ {result.count} pointage(s) enregistré(s). {result.skipped > 0 ? `${result.skipped} verrouillé(s) ignoré(s).` : ''}</div>
              <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={onSaved}>Fermer</button>
            </div>
          ) : (
            <>
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Du</label>
                  <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Au</label>
                  <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>Code *</label>
                <select value={code} onChange={e => setCode(e.target.value)} style={{ width: '100%' }}>
                  <option value="">— Choisir —</option>
                  {codes.map(c => <option key={c.code} value={c.code}>{c.code} — {c.libelle}</option>)}
                </select>
              </div>
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label>Agents ({selectedAgents.length}/{agents.length})</label>
                  <button className="btn btn-sm" onClick={() => setSelectedAgents(agents.map(a => a.agent.id))}>Tout</button>
                </div>
                <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 4 }}>
                  {agents.map(ag => (
                    <label key={ag.agent.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', cursor: 'pointer', color: 'var(--text-primary)', background: selectedAgents.includes(ag.agent.id) ? 'var(--bg-active)' : undefined }}>
                      <input type="checkbox" checked={selectedAgents.includes(ag.agent.id)} onChange={() => toggleAgent(ag.agent.id)} />
                      {ag.agent.nom} {ag.agent.prenom}
                      <span style={{ marginLeft: 'auto', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{ag.agent.matricule}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="alert alert-info" style={{ fontSize: 11 }}>⚠️ Les codes verrouillés 🔒 ne seront pas écrasés.</div>
            </>
          )}
        </div>
        {!result && (
          <div className="modal-footer">
            <button className="btn" onClick={onClose}>Annuler</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={!selectedAgents.length || !code || saving}>
              {saving ? 'Enregistrement…' : `Saisir ${selectedAgents.length} agent(s)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
