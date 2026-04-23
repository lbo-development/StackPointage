// ============ CodesPage.jsx ============
import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const TYPES = ['Présence','Repos','Congé','Maladie','Absence','Autre absence','Autre présence','Autre'];

export default function CodesPage() {
  const { api } = useAuth();
  const { selectedService } = useOutletContext();
  const [codes, setCodes] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editCode, setEditCode] = useState(null);
  const [filterType, setFilterType] = useState('');
  const [filterGlobal, setFilterGlobal] = useState(null); // null=tous, true=global, false=service
  const [filterLocked, setFilterLocked] = useState(null); // null=tous, true=verrouillé, false=libre

  function load() {
    if (!api) return;
    api.get(`/codes?service_id=${selectedService?.id || ''}`).then(setCodes).catch(console.error);
  }

  useEffect(load, [api, selectedService]);

  // Grouper par type, dans l'ordre de TYPES, en respectant le filtre
  const groups = useMemo(() => {
    const filtered = codes.filter(c => {
      if (filterType && c.type !== filterType) return false;
      if (filterGlobal !== null && c.is_global !== filterGlobal) return false;
      if (filterLocked !== null && c.is_locked !== filterLocked) return false;
      return true;
    });
    const map = {};
    filtered.forEach(c => {
      const key = c.type || 'Autre';
      if (!map[key]) map[key] = [];
      map[key].push(c);
    });
    // Trier les groupes selon l'ordre de TYPES, puis les types inconnus à la fin
    const knownOrder = TYPES.filter(t => map[t]);
    const unknown = Object.keys(map).filter(t => !TYPES.includes(t));
    return [...knownOrder, ...unknown].map(type => ({ type, items: map[type] }));
  }, [codes, filterType, filterGlobal, filterLocked]);

  // Types présents dans les données (pour la combobox)
  const availableTypes = useMemo(() => {
    const set = new Set(codes.map(c => c.type).filter(Boolean));
    return TYPES.filter(t => set.has(t));
  }, [codes]);

  return (
    <div className="page-wrapper">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="page-title">Codes de pointage</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            style={{ minWidth: 160 }}
          >
            <option value="">Tous les types</option>
            {availableTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <FilterToggle
            label="Global"
            value={filterGlobal}
            onChange={setFilterGlobal}
          />
          <FilterToggle
            label="Verrouillé"
            value={filterLocked}
            onChange={setFilterLocked}
          />
          <button className="btn btn-primary" onClick={() => { setEditCode(null); setShowModal(true); }}>+ Nouveau code</button>
        </div>
      </div>

      {groups.length === 0 && (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>
          Aucun code de pointage défini
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {groups.map(({ type, items }) => (
          <div key={type}>
            <div style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.08em', color: 'var(--text-muted)',
              borderBottom: '1px solid var(--border)', paddingBottom: 6, marginBottom: 10
            }}>
              {type} <span style={{ fontWeight: 400, opacity: 0.6 }}>({items.length})</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {items.map(c => (
                <div key={c.id}
                  style={{ background: c.bg_color, color: c.text_color, borderRadius: 6, padding: '10px 14px', minWidth: 120, border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
                  onClick={() => { setEditCode(c); setShowModal(true); }}
                >
                  <div style={{ fontWeight: 800, fontSize: 18, fontFamily: 'var(--font-mono)' }}>{c.code}</div>
                  <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{c.libelle}</div>
                  {c.is_locked && <div style={{ fontSize: 9, marginTop: 4 }}>🔒 Verrouillé</div>}
                  {c.is_global && <div style={{ fontSize: 9, opacity: 0.6 }}>Global</div>}
                </div>
              ))}
            </div>
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

function FilterToggle({ label, value, onChange }) {
  const states = [
    { val: null, text: `${label} : tous` },
    { val: true, text: `${label} : oui` },
    { val: false, text: `${label} : non` },
  ];
  const current = states.find(s => s.val === value) || states[0];
  function cycle() {
    const idx = states.findIndex(s => s.val === value);
    onChange(states[(idx + 1) % states.length].val);
  }
  return (
    <button
      className="btn btn-sm"
      onClick={cycle}
      style={{
        fontVariantNumeric: 'tabular-nums',
        background: value !== null ? 'var(--accent)' : undefined,
        color: value !== null ? '#fff' : undefined,
        borderColor: value !== null ? 'var(--accent)' : undefined,
      }}
    >
      {current.text}
    </button>
  );
}

function CodeModal({ code, serviceId, api, onClose, onSaved }) {
  const [form, setForm] = useState({
    code: code?.code || '', libelle: code?.libelle || '',
    type: code?.type || 'Présence', bg_color: code?.bg_color || '#FFFFFF',
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
