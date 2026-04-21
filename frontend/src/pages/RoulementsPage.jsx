import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function RoulementsPage() {
  const { api } = useAuth();
  const { selectedService } = useOutletContext();
  const [roulements, setRoulements] = useState([]);
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editRoulement, setEditRoulement] = useState(null);

  function load() {
    if (!api) return;
    const sid = selectedService?.id || '';
    setLoading(true);
    Promise.all([
      api.get(`/roulements?service_id=${sid}`),
      api.get(`/codes?service_id=${sid}`)
    ]).then(([r, c]) => { setRoulements(r); setCodes(c); }).finally(() => setLoading(false));
  }

  useEffect(load, [api, selectedService]);

  return (
    <div className="page-wrapper">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="page-title">Roulements</h1>
        <button className="btn btn-primary" onClick={() => { setEditRoulement(null); setShowModal(true); }}>+ Nouveau roulement</button>
      </div>

      {loading ? <div className="loading-overlay"><div className="loading-spinner" /></div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {roulements.map(r => (
            <div key={r.id} style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 6, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{r.nom}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    Cycle {r.longueur_cycle}j · Référence: {r.date_debut_reference}
                  </div>
                </div>
                <button className="btn btn-sm" onClick={() => { setEditRoulement(r); setShowModal(true); }}>Éditer</button>
              </div>

              {/* Visualisation du cycle */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {(r.roulement_cycles || []).sort((a, b) => a.index_jour - b.index_jour).map((c, i) => {
                  const codeInfo = codes.find(cd => cd.code === c.code_pointage);
                  return (
                    <div key={i} title={`Jour ${i + 1}: ${c.code_pointage}`} style={{
                      width: 32, height: 28,
                      background: codeInfo?.bg_color || 'var(--bg-surface)',
                      color: codeInfo?.text_color || 'var(--text-primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 3, fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      position: 'relative'
                    }}>
                      {c.code_pointage}
                      <span style={{ position: 'absolute', top: 0, right: 1, fontSize: 7, color: 'var(--text-muted)' }}>{i + 1}</span>
                    </div>
                  );
                })}
              </div>

              {/* Explication du calcul */}
              <div style={{ marginTop: 10, padding: '6px 10px', background: 'var(--bg-surface)', borderRadius: 4, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                index = ((jours_depuis_{r.date_debut_reference} % {r.longueur_cycle}) + {r.longueur_cycle}) % {r.longueur_cycle}
              </div>
            </div>
          ))}

          {!roulements.length && (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>
              Aucun roulement défini pour ce service
            </div>
          )}
        </div>
      )}

      {showModal && (
        <RoulementModal
          roulement={editRoulement}
          codes={codes}
          serviceId={selectedService?.id}
          api={api}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

function RoulementModal({ roulement, codes, serviceId, api, onClose, onSaved }) {
  const [nom, setNom] = useState(roulement?.nom || '');
  const [longueur, setLongueur] = useState(roulement?.longueur_cycle || 6);
  const [dateRef, setDateRef] = useState(roulement?.date_debut_reference || new Date().toISOString().split('T')[0]);
  const [cycles, setCycles] = useState(
    roulement?.roulement_cycles
      ? [...roulement.roulement_cycles].sort((a, b) => a.index_jour - b.index_jour).map(c => ({ code: c.code_pointage, label: c.label || '' }))
      : Array.from({ length: 6 }, () => ({ code: '', label: '' }))
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const len = parseInt(longueur) || 0;
    setCycles(prev => {
      const next = [...prev];
      while (next.length < len) next.push({ code: '', label: '' });
      return next.slice(0, len);
    });
  }, [longueur]);

  async function handleSave() {
    if (!nom || !cycles.every(c => c.code)) { alert('Tous les jours du cycle doivent avoir un code'); return; }
    setSaving(true);
    try {
      const payload = { nom, longueur_cycle: parseInt(longueur), date_debut_reference: dateRef, service_id: serviceId, cycles };
      if (roulement) await api.put(`/roulements/${roulement.id}`, payload);
      else await api.post('/roulements', payload);
      onSaved();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ minWidth: 520, maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{roulement ? 'Modifier roulement' : 'Nouveau roulement'}</span>
          <button className="btn btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}><label>Nom</label><input value={nom} onChange={e => setNom(e.target.value)} /></div>
            <div className="form-group" style={{ flex: 1 }}><label>Longueur cycle (jours)</label><input type="number" min={1} max={90} value={longueur} onChange={e => setLongueur(e.target.value)} /></div>
          </div>
          <div className="form-group"><label>Date de référence (début du cycle)</label><input type="date" value={dateRef} onChange={e => setDateRef(e.target.value)} /></div>

          <div className="form-group">
            <label>Cycle ({cycles.length} jours)</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6, maxHeight: 300, overflowY: 'auto', padding: 8, background: 'var(--bg-surface)', borderRadius: 4 }}>
              {cycles.map((c, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <label style={{ fontSize: 10 }}>Jour {i + 1}</label>
                  <select value={c.code} onChange={e => { const n = [...cycles]; n[i] = { ...n[i], code: e.target.value }; setCycles(n); }}
                    style={{ background: codes.find(cd => cd.code === c.code)?.bg_color || 'var(--bg-surface)', color: codes.find(cd => cd.code === c.code)?.text_color || undefined, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    <option value="">—</option>
                    {codes.map(cd => <option key={cd.code} value={cd.code}>{cd.code}</option>)}
                  </select>
                </div>
              ))}
            </div>
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
