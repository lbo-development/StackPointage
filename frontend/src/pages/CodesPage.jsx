// ============ CodesPage.jsx ============
import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function CodesPage() {
  const { api } = useAuth();
  const { selectedService } = useOutletContext();
  const [codes, setCodes] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editCode, setEditCode] = useState(null);

  function load() {
    if (!api) return;
    api.get(`/codes?service_id=${selectedService?.id || ''}`).then(setCodes).catch(console.error);
  }

  useEffect(load, [api, selectedService]);

  return (
    <div className="page-wrapper">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="page-title">Codes de pointage</h1>
        <button className="btn btn-primary" onClick={() => { setEditCode(null); setShowModal(true); }}>+ Nouveau code</button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {codes.map(c => (
          <div key={c.id}
            style={{ background: c.bg_color, color: c.text_color, borderRadius: 6, padding: '10px 14px', minWidth: 120, border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
            onClick={() => { setEditCode(c); setShowModal(true); }}
          >
            <div style={{ fontWeight: 800, fontSize: 18, fontFamily: 'var(--font-mono)' }}>{c.code}</div>
            <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{c.libelle}</div>
            <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4 }}>{c.type}</div>
            {c.is_locked && <div style={{ fontSize: 9, marginTop: 4 }}>🔒 Verrouillé</div>}
            {c.is_global && <div style={{ fontSize: 9, opacity: 0.6 }}>Global</div>}
          </div>
        ))}
      </div>

      {showModal && (
        <CodeModal code={editCode} serviceId={selectedService?.id} api={api}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

function CodeModal({ code, serviceId, api, onClose, onSaved }) {
  const [form, setForm] = useState({
    code: code?.code || '', libelle: code?.libelle || '',
    type: code?.type || 'journee', bg_color: code?.bg_color || '#FFFFFF',
    text_color: code?.text_color || '#000000', is_locked: code?.is_locked || false,
    is_global: code?.is_global || false, ordre: code?.ordre || 0
  });
  const [saving, setSaving] = useState(false);

  function set(k, v) { setForm(prev => ({ ...prev, [k]: v })); }

  async function handleSave() {
    if (!form.code || !form.libelle) return;
    setSaving(true);
    try {
      const payload = { ...form, service_id: serviceId || null };
      if (code) await api.put(`/codes/${code.id}`, payload);
      else await api.post('/codes', payload);
      onSaved();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  }

  const TYPES = ['matin','apres_midi','nuit','journee','absence','conge','repos','autre'];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{code ? 'Modifier code' : 'Nouveau code'}</span>
          <button className="btn btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}><label>Code *</label><input value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }} /></div>
            <div className="form-group" style={{ flex: 2 }}><label>Libellé *</label><input value={form.libelle} onChange={e => set('libelle', e.target.value)} /></div>
          </div>
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}><label>Type</label>
              <select value={form.type} onChange={e => set('type', e.target.value)}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}><label>Ordre</label><input type="number" value={form.ordre} onChange={e => set('ordre', parseInt(e.target.value))} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Couleur fond</label><input type="color" value={form.bg_color} onChange={e => set('bg_color', e.target.value)} style={{ height: 32, padding: 2 }} /></div>
            <div className="form-group"><label>Couleur texte</label><input type="color" value={form.text_color} onChange={e => set('text_color', e.target.value)} style={{ height: 32, padding: 2 }} /></div>
            <div style={{ padding: '20px 12px 0', background: form.bg_color, color: form.text_color, borderRadius: 4, fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16, minWidth: 50, textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
              {form.code || '??'}
            </div>
          </div>
          <div className="form-row">
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.is_locked} onChange={e => set('is_locked', e.target.checked)} />
              🔒 Verrouillé (non écrasable en période)
            </label>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.is_global} onChange={e => set('is_global', e.target.checked)} />
              Global (tous services)
            </label>
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
