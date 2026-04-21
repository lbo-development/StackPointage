// ============ ConvocationsPage.jsx ============
import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ConvocationsPage() {
  const { api, can, profile } = useAuth();
  const { selectedService } = useOutletContext();
  const [convocations, setConvocations] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editConvoc, setEditConvoc] = useState(null);
  const [agents, setAgents] = useState([]);

  const TYPES = ['disciplinaire','information','formation','medical','autre'];
  const STATUTS = ['planifiee','realisee','annulee'];

  function load() {
    if (!api) return;
    const sid = selectedService?.id || profile?.service_id || '';
    api.get(`/convocations?service_id=${sid}`).then(setConvocations).catch(console.error);
    api.get(`/agents?service_id=${sid}`).then(setAgents).catch(console.error);
  }

  useEffect(load, [api, selectedService]);

  async function handleDelete(id) {
    if (!confirm('Supprimer cette convocation ?')) return;
    await api.delete(`/convocations/${id}`);
    load();
  }

  return (
    <div className="page-wrapper">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="page-title">Convocations</h1>
        {can('edit_convocations') && (
          <button className="btn btn-primary" onClick={() => { setEditConvoc(null); setShowModal(true); }}>+ Nouvelle convocation</button>
        )}
      </div>

      <table className="data-table">
        <thead><tr><th>Date</th><th>Agent</th><th>Type</th><th>Intitulé</th><th>Statut</th><th>Actions</th></tr></thead>
        <tbody>
          {convocations.map(c => (
            <tr key={c.id}>
              <td style={{ fontFamily: 'var(--font-mono)' }}>{c.date}</td>
              <td>{c.agents?.nom} {c.agents?.prenom}</td>
              <td><span className="badge badge-blue">{c.type}</span></td>
              <td>{c.intitule}</td>
              <td><span className={`badge ${c.statut === 'realisee' ? 'badge-green' : c.statut === 'annulee' ? 'badge-red' : 'badge-yellow'}`}>{c.statut}</span></td>
              <td style={{ display: 'flex', gap: 6 }}>
                {can('edit_convocations') && <>
                  <button className="btn btn-sm" onClick={() => { setEditConvoc(c); setShowModal(true); }}>Éditer</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(c.id)}>✕</button>
                </>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showModal && (
        <ConvocModal convoc={editConvoc} agents={agents} serviceId={selectedService?.id || profile?.service_id}
          api={api} onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

function ConvocModal({ convoc, agents, serviceId, api, onClose, onSaved }) {
  const TYPES = ['disciplinaire','information','formation','medical','autre'];
  const [form, setForm] = useState({
    agent_id: convoc?.agent_id || '',
    date: convoc?.date || new Date().toISOString().split('T')[0],
    type: convoc?.type || 'information',
    intitule: convoc?.intitule || '',
    commentaire: convoc?.commentaire || '',
    statut: convoc?.statut || 'planifiee'
  });
  const [saving, setSaving] = useState(false);
  function set(k, v) { setForm(p => ({ ...p, [k]: v })); }

  async function handleSave() {
    if (!form.agent_id || !form.intitule) return;
    setSaving(true);
    try {
      const payload = { ...form, service_id: serviceId };
      if (convoc) await api.put(`/convocations/${convoc.id}`, payload);
      else await api.post('/convocations', payload);
      onSaved();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{convoc ? 'Modifier convocation' : 'Nouvelle convocation'}</span>
          <button className="btn btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group"><label>Agent *</label>
            <select value={form.agent_id} onChange={e => set('agent_id', e.target.value)} style={{ width: '100%' }}>
              <option value="">— Choisir —</option>
              {agents.map(a => <option key={a.agent_id} value={a.agent_id}>{a.agents?.nom} {a.agents?.prenom} ({a.agents?.matricule})</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}><label>Date *</label><input type="date" value={form.date} onChange={e => set('date', e.target.value)} /></div>
            <div className="form-group" style={{ flex: 1 }}><label>Type</label>
              <select value={form.type} onChange={e => set('type', e.target.value)}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group"><label>Intitulé *</label><input value={form.intitule} onChange={e => set('intitule', e.target.value)} style={{ width: '100%' }} /></div>
          <div className="form-group"><label>Commentaire</label><textarea value={form.commentaire} onChange={e => set('commentaire', e.target.value)} rows={2} style={{ width: '100%' }} /></div>
          <div className="form-group"><label>Statut</label>
            <select value={form.statut} onChange={e => set('statut', e.target.value)}>
              {['planifiee','realisee','annulee'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </div>
    </div>
  );
}

export { ConvocationsPage as default };
