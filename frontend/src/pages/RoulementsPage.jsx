import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const TODAY_STR = new Date().toISOString().split('T')[0];

function addMonths(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setMonth(d.getMonth() + n);
  return d.toISOString().split('T')[0];
}

function generateDates(startStr, endStr) {
  const dates = [];
  const end = new Date(endStr + 'T00:00:00');
  const cur = new Date(startStr + 'T00:00:00');
  while (cur <= end) {
    dates.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function getDayInfo(dateStr, feriesSet) {
  const d = new Date(dateStr + 'T00:00:00');
  const dow = d.getDay();
  return {
    isSam: dow === 6,
    isDim: dow === 0,
    isFerie: feriesSet.has(dateStr),
    isToday: dateStr === TODAY_STR,
    dayNum: d.getDate(),
    dayLabel: d.toLocaleDateString('fr-FR', { weekday: 'short' }),
  };
}

function calcRoulementCode(roulement, dateStr) {
  if (!roulement.roulement_cycles?.length) return null;
  const ref = new Date(roulement.date_debut_reference + 'T00:00:00');
  const d = new Date(dateStr + 'T00:00:00');
  const delta = Math.round((d - ref) / 86400000);
  const len = roulement.longueur_cycle;
  const idx = ((delta % len) + len) % len;
  return roulement.roulement_cycles.find(c => c.index_jour === idx)?.code_pointage || null;
}

export default function RoulementsPage() {
  const { api, isAdmin } = useAuth();
  const { selectedService } = useOutletContext();
  const [roulements, setRoulements] = useState([]);
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editRoulement, setEditRoulement] = useState(null);

  const [calendarBase, setCalendarBase] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [feries, setFeries] = useState([]);

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

  const { calStart, calEnd } = useMemo(() => {
    const calStart = calendarBase;
    const d = new Date(calendarBase + 'T00:00:00');
    d.setMonth(d.getMonth() + 2);
    d.setDate(0);
    return { calStart, calEnd: d.toISOString().split('T')[0] };
  }, [calendarBase]);

  useEffect(() => {
    if (!api) return;
    api.get(`/roulements/feries?start=${calStart}&end=${calEnd}`)
      .then(setFeries).catch(() => setFeries([]));
  }, [api, calStart, calEnd]);

  const feriesSet = useMemo(() => new Set(feries), [feries]);
  const calDates = useMemo(() => generateDates(calStart, calEnd), [calStart, calEnd]);
  const codesMap = useMemo(() => {
    const m = {};
    codes.forEach(c => { m[c.code] = c; });
    return m;
  }, [codes]);

  return (
    <div className="page-wrapper">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="page-title">Roulements {selectedService ? `— ${selectedService.nom}` : ''}</h1>
        <button className="btn btn-primary" onClick={() => { setEditRoulement(null); setShowModal(true); }}>+ Nouveau roulement</button>
      </div>

      {loading ? <div className="loading-overlay"><div className="loading-spinner" /></div> : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            {roulements.map(r => {
              const isGlobal = !r.service_id;
              return (
                <div key={r.id} style={{ background: 'var(--bg-panel)', border: `1px solid ${isGlobal ? 'var(--color-accent, #6366f1)' : 'var(--border)'}`, borderRadius: 6, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14 }}>
                        {r.nom}
                        {isGlobal && (
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10, background: 'var(--color-accent, #6366f1)', color: '#fff', letterSpacing: '0.05em' }}>
                            GLOBAL
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        Cycle {r.longueur_cycle}j · Référence: {r.date_debut_reference}
                        {isGlobal && ' · Commun à tous les services'}
                      </div>
                    </div>
                    <button className="btn btn-sm" onClick={() => { setEditRoulement(r); setShowModal(true); }}>Éditer</button>
                  </div>

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

                  <div style={{ marginTop: 10, padding: '6px 10px', background: 'var(--bg-surface)', borderRadius: 4, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    index = ((jours_depuis_{r.date_debut_reference} % {r.longueur_cycle}) + {r.longueur_cycle}) % {r.longueur_cycle}
                  </div>
                </div>
              );
            })}

            {!roulements.length && (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>
                Aucun roulement défini pour ce service
              </div>
            )}
          </div>

          {roulements.length > 0 && (
            <RoulementCalendar
              roulements={roulements}
              codesMap={codesMap}
              calDates={calDates}
              feriesSet={feriesSet}
              calendarBase={calendarBase}
              onPrev={() => setCalendarBase(prev => addMonths(prev, -1))}
              onNext={() => setCalendarBase(prev => addMonths(prev, 1))}
              onToday={() => {
                const d = new Date();
                d.setDate(1);
                setCalendarBase(d.toISOString().split('T')[0]);
              }}
            />
          )}
        </>
      )}

      {showModal && (
        <RoulementModal
          roulement={editRoulement}
          codes={codes}
          serviceId={selectedService?.id}
          api={api}
          isAdmin={isAdmin}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

function RoulementCalendar({ roulements, codesMap, calDates, feriesSet, calendarBase, onPrev, onNext, onToday }) {
  const monthGroups = useMemo(() => {
    const groups = [];
    let cur = null;
    calDates.forEach(d => {
      const [y, m] = d.split('-');
      const key = `${y}-${m}`;
      if (!cur || cur.key !== key) {
        cur = { key, label: new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }), count: 0 };
        groups.push(cur);
      }
      cur.count++;
    });
    return groups;
  }, [calDates]);

  const periodLabel = useMemo(() => {
    if (!calDates.length) return '';
    const start = new Date(calDates[0] + 'T00:00:00');
    const end = new Date(calDates[calDates.length - 1] + 'T00:00:00');
    const fmt = d => d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return `${fmt(start)} — ${fmt(end)}`;
  }, [calDates]);

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>
          Projection calendaire
          <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{periodLabel}</span>
        </span>
        <button className="btn btn-sm" onClick={onPrev} title="Mois précédent">‹</button>
        <button className="btn btn-sm" onClick={onToday}>Aujourd'hui</button>
        <button className="btn btn-sm" onClick={onNext} title="Mois suivant">›</button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="matrix-table">
          <thead>
            <tr>
              <th className="col-sticky" style={{ minWidth: 180, textAlign: 'left', padding: '4px 8px', zIndex: 5, fontFamily: 'var(--font-ui)' }}>
                Roulement
              </th>
              {monthGroups.map(g => (
                <th key={g.key} colSpan={g.count} style={{
                  textAlign: 'center',
                  borderLeft: '2px solid var(--border-light)',
                  padding: '4px 6px',
                  fontSize: 11,
                  fontFamily: 'var(--font-ui)',
                  textTransform: 'capitalize',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  position: 'sticky',
                  top: 0,
                  zIndex: 3,
                }}>
                  {g.label}
                </th>
              ))}
            </tr>
            <tr>
              <th className="col-sticky" style={{ fontSize: 10, color: 'var(--text-muted)', zIndex: 5, fontFamily: 'var(--font-ui)', textAlign: 'left', padding: '3px 8px' }}>
                {roulements.length} roulement{roulements.length > 1 ? 's' : ''}
              </th>
              {calDates.map(dateStr => {
                const { isSam, isDim, isFerie, isToday, dayNum, dayLabel } = getDayInfo(dateStr, feriesSet);
                let cls = 'date-header';
                if (isFerie) cls += ' ferie';
                else if (isDim) cls += ' dimanche';
                else if (isSam) cls += ' weekend';
                if (isToday) cls += ' today';
                const isFirstOfMonth = new Date(dateStr + 'T00:00:00').getDate() === 1;
                return (
                  <th key={dateStr} className={cls} title={dateStr}
                    style={isFirstOfMonth ? { borderLeft: '2px solid var(--border-light)' } : undefined}>
                    <div style={{ lineHeight: 1.2 }}>
                      <div style={{ fontSize: 8, opacity: 0.7, fontFamily: 'var(--font-ui)' }}>{dayLabel}</div>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>{dayNum}</div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {roulements.map(r => (
              <tr key={r.id}>
                <td className="col-sticky" style={{
                  padding: '0 8px',
                  minWidth: 180,
                  height: 28,
                  fontWeight: 600,
                  fontSize: 12,
                  fontFamily: 'var(--font-ui)',
                  color: 'var(--text-primary)',
                  background: 'var(--bg-panel)',
                  whiteSpace: 'nowrap',
                }}>
                  {r.nom}
                  {!r.service_id && (
                    <span style={{ fontSize: 9, marginLeft: 6, padding: '1px 5px', borderRadius: 8, background: '#6366f1', color: '#fff', fontWeight: 600 }}>
                      GLOBAL
                    </span>
                  )}
                </td>
                {calDates.map(dateStr => {
                  const code = calcRoulementCode(r, dateStr);
                  const codeInfo = code ? codesMap[code] : null;
                  const { isSam, isDim, isFerie, isToday } = getDayInfo(dateStr, feriesSet);
                  const isFirstOfMonth = new Date(dateStr + 'T00:00:00').getDate() === 1;

                  let bg = codeInfo?.bg_color || 'transparent';
                  if (!codeInfo) {
                    if (isFerie) bg = 'rgba(239,68,68,0.1)';
                    else if (isDim) bg = 'rgba(139,92,246,0.1)';
                    else if (isSam) bg = 'rgba(99,102,241,0.1)';
                    if (isToday) bg = 'rgba(59,130,246,0.15)';
                  }

                  return (
                    <td key={dateStr} title={`${dateStr}: ${code || '—'}`} style={{
                      background: bg,
                      color: codeInfo?.text_color || 'var(--text-secondary)',
                      textAlign: 'center',
                      fontWeight: 700,
                      fontSize: 10,
                      fontFamily: 'var(--font-mono)',
                      height: 28,
                      width: 36,
                      padding: 0,
                      borderLeft: isFirstOfMonth ? '2px solid var(--border-light)' : undefined,
                    }}>
                      {code || ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="legend" style={{ borderTop: '1px solid var(--border)', marginTop: 0 }}>
        <div className="legend-item"><div className="legend-swatch" style={{ background: 'var(--col-sat)' }} /><span>Samedi</span></div>
        <div className="legend-item"><div className="legend-swatch" style={{ background: 'var(--col-dim)' }} /><span>Dimanche</span></div>
        <div className="legend-item"><div className="legend-swatch" style={{ background: 'var(--col-ferie)' }} /><span>Férié</span></div>
        <div className="legend-item"><div className="legend-swatch" style={{ background: 'var(--col-today)' }} /><span>Aujourd'hui</span></div>
      </div>
    </div>
  );
}

function RoulementModal({ roulement, codes, serviceId, api, isAdmin, onClose, onSaved }) {
  const [nom, setNom] = useState(roulement?.nom || '');
  const [longueur, setLongueur] = useState(roulement?.longueur_cycle || 6);
  const [dateRef, setDateRef] = useState(roulement?.date_debut_reference || new Date().toISOString().split('T')[0]);
  const [isGlobal, setIsGlobal] = useState(roulement ? !roulement.service_id : false);
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
      const payload = {
        nom,
        longueur_cycle: parseInt(longueur),
        date_debut_reference: dateRef,
        service_id: isGlobal ? null : serviceId,
        cycles
      };
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

          {isAdmin && (
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={isGlobal}
                  onChange={e => setIsGlobal(e.target.checked)}
                  style={{ width: 16, height: 16 }}
                />
                <span>Roulement commun à tous les services</span>
                {isGlobal && (
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10, background: 'var(--color-accent, #6366f1)', color: '#fff' }}>
                    GLOBAL
                  </span>
                )}
              </label>
              {isGlobal && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, marginLeft: 24 }}>
                  Ce roulement sera visible et utilisable par tous les services.
                </div>
              )}
            </div>
          )}

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
