// ============ PointageModal.jsx ============
import { useState } from 'react';

export function PointageModal({ agent, date, currentCode, codes, onSave, onClose }) {
  const [code, setCode] = useState(currentCode || '');
  const [commentaire, setCommentaire] = useState('');
  const [saving, setSaving] = useState(false);

  const formatDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  async function handleSave() {
    if (!code) return;
    setSaving(true);
    try {
      await onSave({ agentId: agent.id, date, code, commentaire });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Saisie pointage</span>
          <button className="btn btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div style={{ background: 'var(--bg-surface)', borderRadius: 4, padding: '10px 12px' }}>
            <div style={{ fontWeight: 600 }}>{agent.prenom} {agent.nom}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{agent.matricule}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{formatDate(date)}</div>
          </div>

          <div className="form-group">
            <label>Code de pointage *</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {codes.map(c => (
                <button
                  key={c.code}
                  className={`btn btn-sm ${code === c.code ? 'btn-primary' : ''}`}
                  style={{
                    background: code === c.code ? undefined : c.bg_color,
                    color: code === c.code ? undefined : c.text_color,
                    borderColor: code === c.code ? undefined : 'transparent',
                    minWidth: 60
                  }}
                  onClick={() => setCode(c.code)}
                  title={c.libelle}
                >
                  <strong>{c.code}</strong>
                </button>
              ))}
            </div>
          </div>

          {code && (
            <div style={{ padding: '6px 10px', background: 'var(--bg-surface)', borderRadius: 4, fontSize: 12 }}>
              Code sélectionné: <strong style={{ fontFamily: 'var(--font-mono)' }}>{code}</strong>
              {' — '}{codes.find(c => c.code === code)?.libelle}
            </div>
          )}

          <div className="form-group">
            <label>Commentaire (optionnel)</label>
            <textarea
              value={commentaire}
              onChange={e => setCommentaire(e.target.value)}
              rows={2}
              placeholder="Observations…"
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!code || saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PointageModal;


// ============ PeriodeModal.jsx ============
import { useState as useState2 } from 'react';

export function PeriodeModal({ agents, codes, serviceId, defaultDateDebut, defaultDateFin, api, onClose, onSaved }) {
  const [selectedAgents, setSelectedAgents2] = useState2([]);
  const [code, setCode2] = useState2('');
  const [dateDebut, setDateDebut] = useState2(defaultDateDebut);
  const [dateFin, setDateFin] = useState2(defaultDateFin);
  const [saving, setSaving2] = useState2(false);
  const [result, setResult2] = useState2(null);

  function toggleAgent(agId) {
    setSelectedAgents2(prev =>
      prev.includes(agId) ? prev.filter(id => id !== agId) : [...prev, agId]
    );
  }

  function selectAll() {
    setSelectedAgents2(agents.map(a => a.agent.id));
  }

  async function handleSave() {
    if (!selectedAgents.length || !code || !dateDebut || !dateFin) return;
    setSaving2(true);
    try {
      const res = await api.post('/pointages/periode', {
        agent_ids: selectedAgents,
        date_debut: dateDebut,
        date_fin: dateFin,
        code_pointage: code,
        service_id: serviceId
      });
      setResult2(res);
    } catch (err) {
      alert('Erreur: ' + err.message);
    } finally {
      setSaving2(false);
    }
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
              <div className="alert alert-success">
                ✓ {result.count} pointage(s) enregistré(s). {result.skipped > 0 ? `${result.skipped} verrouillé(s) ignoré(s).` : ''}
              </div>
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
                <label>Code de pointage *</label>
                <select value={code} onChange={e => setCode2(e.target.value)} style={{ width: '100%' }}>
                  <option value="">— Choisir un code —</option>
                  {codes.map(c => (
                    <option key={c.code} value={c.code}>{c.code} — {c.libelle}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label>Agents ({selectedAgents.length}/{agents.length} sélectionnés)</label>
                  <button className="btn btn-sm" onClick={selectAll}>Tout sélectionner</button>
                </div>
                <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 4 }}>
                  {agents.map(ag => (
                    <label key={ag.agent.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '5px 10px', cursor: 'pointer', color: 'var(--text-primary)',
                      background: selectedAgents.includes(ag.agent.id) ? 'var(--bg-active)' : undefined
                    }}>
                      <input
                        type="checkbox"
                        checked={selectedAgents.includes(ag.agent.id)}
                        onChange={() => toggleAgent(ag.agent.id)}
                      />
                      <span>{ag.agent.nom} {ag.agent.prenom}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{ag.agent.matricule}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="alert alert-info" style={{ fontSize: 11 }}>
                ⚠️ Les codes verrouillés (🔒) ne seront pas écrasés.
              </div>
            </>
          )}
        </div>

        {!result && (
          <div className="modal-footer">
            <button className="btn" onClick={onClose}>Annuler</button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={!selectedAgents.length || !code || saving}
            >
              {saving ? 'Enregistrement…' : `Saisir pour ${selectedAgents.length} agent(s)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default PeriodeModal;
