import { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import OrdreAgentsModal from '../components/matrix/OrdreAgentsModal.jsx';

const CONTRAT_COLORS = {
  CDI:    { bg: '#dcfce7', text: '#15803d', border: '#86efac' },
  CDD:    { bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1' },
  CFA:    { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' },
  INTERIM:{ bg: '#fef3c7', text: '#b45309', border: '#fcd34d' },
};

export default function AgentsPage() {
  const { api, can } = useAuth();
  const { selectedService } = useOutletContext();
  const [agents, setAgents] = useState([]);
  const [agentsSansAff, setAgentsSansAff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editAgent, setEditAgent] = useState(null);
  const [search, setSearch] = useState('');
  const [filtreContrat, setFiltreContrat] = useState('');
  const [showInactifs, setShowInactifs] = useState(false);
  const [ordreModal, setOrdreModal] = useState(null);
  const [affectationModal, setAffectationModal] = useState(null);
  const [showSansAff, setShowSansAff] = useState(false);
  const [searchSansAff, setSearchSansAff] = useState('');

  function load() {
    if (!api) return;
    setLoading(true);
    const sid = selectedService?.id || '';
    const params = new URLSearchParams({ service_id: sid });
    if (showInactifs) params.append('include_inactive', '1');
    Promise.all([
      api.get(`/agents?${params}`),
      sid ? api.get(`/agents/sans-affectation?service_id=${sid}`) : Promise.resolve([]),
    ])
      .then(([aff, sansAff]) => { setAgents(aff); setAgentsSansAff(sansAff); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(load, [api, selectedService, showInactifs]);

  const sorted = [...agents].sort((a, b) => {
    const co = (a.cellules?.ordre ?? 9999) - (b.cellules?.ordre ?? 9999);
    if (co !== 0) return co;
    const oo = (a.ordre ?? 9999) - (b.ordre ?? 9999);
    if (oo !== 0) return oo;
    return (a.agents?.nom || '').localeCompare(b.agents?.nom || '');
  });

  const filtered = sorted.filter(a => {
    if (search && !`${a.agents?.nom} ${a.agents?.prenom} ${a.agents?.matricule}`
      .toLowerCase().includes(search.toLowerCase())) return false;
    if (filtreContrat === '__vide__') return !a.agents?.type_contrat;
    if (filtreContrat && a.agents?.type_contrat !== filtreContrat) return false;
    return true;
  });

  const filteredSansAff = useMemo(() => {
    if (!searchSansAff.trim()) return agentsSansAff;
    const q = searchSansAff.toLowerCase();
    return agentsSansAff.filter(a =>
      `${a.nom} ${a.prenom} ${a.matricule}`.toLowerCase().includes(q)
    );
  }, [agentsSansAff, searchSansAff]);

  // Grouper par cellule (depuis les données triées) pour les boutons "Ordre"
  const parCellule = useMemo(() => {
    const map = {};
    sorted.forEach(a => {
      const cid = a.cellule_id;
      if (!map[cid]) map[cid] = { cellule: a.cellules, agents: [] };
      map[cid].agents.push(a);
    });
    return map;
  }, [sorted]);

  // Rows de la table : une ligne d'en-tête de cellule + les agents, dans l'ordre
  const groupedRows = useMemo(() => {
    const rows = [];
    let lastCid = null;
    filtered.forEach(a => {
      if (a.cellule_id !== lastCid) {
        rows.push({ type: 'header', cellule: a.cellules, celluleId: a.cellule_id });
        lastCid = a.cellule_id;
      }
      rows.push({ type: 'agent', a });
    });
    return rows;
  }, [filtered]);

  return (
    <div className="page-wrapper">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="page-title">Agents {selectedService ? `— ${selectedService.nom}` : ''}</h1>
        {can('edit_agents') && (
          <button className="btn btn-primary" onClick={() => { setEditAgent(null); setShowModal(true); }}>
            + Nouvel agent
          </button>
        )}
      </div>

      <div className="toolbar" style={{ marginBottom: 12 }}>
        <input
          placeholder="Rechercher nom, prénom, matricule…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 280 }}
        />
        <select
          value={filtreContrat}
          onChange={e => setFiltreContrat(e.target.value)}
          style={{ width: 140 }}
        >
          <option value="">Tous les contrats</option>
          <option value="CDI">CDI</option>
          <option value="CDD">CDD</option>
          <option value="CFA">CFA</option>
          <option value="INTERIM">INTERIM</option>
          <option value="__vide__">Non renseigné</option>
        </select>
        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{filtered.length} agent(s)</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}>
          <input type="checkbox" checked={showInactifs} onChange={e => setShowInactifs(e.target.checked)} />
          Inclure inactifs
        </label>

        {/* Boutons ordre par cellule */}
        {can('edit_agents') && Object.values(parCellule).map(({ cellule, agents: ca }) => (
          cellule && (
            <button
              key={cellule.id}
              className="btn btn-sm"
              onClick={() => setOrdreModal({ cellule, agents: ca })}
              title={`Réordonner les agents de ${cellule.nom}`}
              style={{ display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: cellule.couleur }} />
              ⇅ {cellule.nom}
            </button>
          )
        ))}
      </div>

      {loading
        ? <div className="loading-overlay"><div className="loading-spinner" /></div>
        : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 40 }} />
                <th style={{ width: 36, textAlign: 'center' }}>#</th>
                <th>Matricule</th>
                <th>Nom</th>
                <th>Prénom</th>
                <th>Téléphone</th>
                <th>Contrat</th>
                <th>Spécialité</th>
                <th>Roulement</th>
                <th>Depuis</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {groupedRows.map((row, i) => {
                if (row.type === 'header') {
                  return (
                    <tr key={`hdr-${row.celluleId}`}>
                      <td colSpan={11} style={{
                        padding: '6px 12px',
                        background: 'var(--bg-panel)',
                        borderTop: i === 0 ? 'none' : '2px solid var(--border)',
                        borderBottom: '1px solid var(--border)',
                      }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          <span style={{ width: 9, height: 9, borderRadius: '50%', background: row.cellule?.couleur, flexShrink: 0 }} />
                          {row.cellule?.nom}
                        </span>
                      </td>
                    </tr>
                  );
                }
                const { a } = row;
                const contrat = a.agents?.type_contrat;
                const nonCDD = contrat && contrat !== 'CDI';
                return (
                  <tr key={a.id} style={{
                    ...(!a.is_active ? { opacity: 0.45 } : undefined),
                    ...(nonCDD ? { background: 'rgba(251, 191, 36, 0.10)', borderLeft: '3px solid #f59e0b' } : { borderLeft: '3px solid transparent' }),
                  }}>
                    <td style={{ padding: '4px 6px' }}>
                      <AgentAvatar photoUrl={a.agents?.photo_url} nom={a.agents?.nom} prenom={a.agents?.prenom} size={32} />
                    </td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                      {a.ordre + 1}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{a.agents?.matricule}</td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {a.agents?.nom}
                      {!a.is_active && (
                        <span style={{ marginLeft: 6, fontSize: 9, padding: '1px 5px', borderRadius: 8, background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                          inactif
                        </span>
                      )}
                    </td>
                    <td>{a.agents?.prenom}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                      {a.agents?.telephone || '—'}
                    </td>
                    <td>
                      {contrat ? (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
                          background: CONTRAT_COLORS[contrat]?.bg,
                          color: CONTRAT_COLORS[contrat]?.text,
                          border: `1px solid ${CONTRAT_COLORS[contrat]?.border}`,
                        }}>
                          {contrat}
                        </span>
                      ) : '—'}
                    </td>
                    <td>{a.specialites?.nom || '—'}</td>
                    <td>{a.roulements?.nom || '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{a.date_debut}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      {can('edit_agents') && (
                        <button className="btn btn-sm" onClick={() => { setEditAgent(a); setShowModal(true); }}>
                          Éditer
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )
      }

      {/* ── Section agents sans affectation ── */}
      {agentsSansAff.length > 0 && can('edit_agents') && (
        <div style={{ marginTop: 24, border: '1px solid var(--warning, #f59e0b)', borderRadius: 6, overflow: 'hidden' }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: 'rgba(245,158,11,0.08)', cursor: 'pointer' }}
            onClick={() => setShowSansAff(v => !v)}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warning, #f59e0b)', flexShrink: 0 }} />
            <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>
              Agents importés sans affectation
              <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>
                {agentsSansAff.length} agent{agentsSansAff.length > 1 ? 's' : ''} à affecter dans ce service
              </span>
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{showSansAff ? '▲' : '▼'}</span>
          </div>

          {showSansAff && (
            <div style={{ padding: '10px 14px 14px', background: 'var(--bg-panel)' }}>
              <input
                placeholder="Rechercher nom, prénom, matricule…"
                value={searchSansAff}
                onChange={e => setSearchSansAff(e.target.value)}
                style={{ width: 280, marginBottom: 10 }}
              />
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }} />
                    <th>Matricule</th>
                    <th>Nom</th>
                    <th>Prénom</th>
                    <th>Contrat</th>
                    <th>Email</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSansAff.map(a => {
                    const contrat = a.type_contrat;
                    return (
                      <tr key={a.id}>
                        <td style={{ padding: '4px 6px' }}>
                          <AgentAvatar photoUrl={a.photo_url} nom={a.nom} prenom={a.prenom} size={32} />
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{a.matricule}</td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{a.nom}</td>
                        <td>{a.prenom}</td>
                        <td>
                          {contrat ? (
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
                              background: CONTRAT_COLORS[contrat]?.bg,
                              color: CONTRAT_COLORS[contrat]?.text,
                              border: `1px solid ${CONTRAT_COLORS[contrat]?.border}`,
                            }}>
                              {contrat}
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.email || '—'}</td>
                        <td>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => setAffectationModal(a)}
                          >
                            Affecter
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal édition agent */}
      {showModal && (
        <AgentModal
          agent={editAgent}
          serviceId={selectedService?.id}
          serviceName={selectedService?.nom}
          api={api}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}

      {/* Modal réordonnancement */}
      {ordreModal && (
        <OrdreAgentsModal
          cellule={ordreModal.cellule}
          agents={ordreModal.agents}
          api={api}
          onClose={() => setOrdreModal(null)}
          onSaved={() => { setOrdreModal(null); load(); }}
        />
      )}

      {/* Modal affectation agent importé */}
      {affectationModal && (
        <AssignmentModal
          agent={affectationModal}
          serviceId={selectedService?.id}
          serviceName={selectedService?.nom}
          api={api}
          onClose={() => setAffectationModal(null)}
          onSaved={() => { setAffectationModal(null); load(); }}
        />
      )}
    </div>
  );
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function AgentModal({ agent, serviceId, serviceName, api, onClose, onSaved }) {
  const [nom, setNom] = useState(agent?.agents?.nom || '');
  const [prenom, setPrenom] = useState(agent?.agents?.prenom || '');
  const [matricule, setMatricule] = useState(agent?.agents?.matricule || '');
  const [email, setEmail] = useState(agent?.agents?.email || '');
  const [telephone, setTelephone] = useState(agent?.agents?.telephone || '');
  const [typeContrat, setTypeContrat] = useState(agent?.agents?.type_contrat || '');
  const [celluleId, setCelluleId] = useState(agent?.cellule_id || '');
  const [specialiteId, setSpecialiteId] = useState(agent?.specialite_id || '');
  const [roulementId, setRoulementId] = useState(agent?.roulement_id || '');
  const [dateRefAgent, setDateRefAgent] = useState(agent?.date_debut_reference || '');
  const [dateDebut, setDateDebut] = useState(
    agent?.date_debut || new Date().toISOString().split('T')[0]
  );
  const [isActive, setIsActive] = useState(agent?.is_active !== false);
  const [cellules, setCellules] = useState([]);
  const [specialites, setSpecialites] = useState([]);
  const [roulements, setRoulements] = useState([]);
  const [saving, setSaving] = useState(false);

  const selectedRoulement = useMemo(
    () => roulements.find(r => r.id === roulementId),
    [roulements, roulementId]
  );
  const roulementNeedsDateRef = selectedRoulement?.date_ref_par_agent === true;

  const originalPhotoUrl = agent?.agents?.photo_url || null;
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(originalPhotoUrl);
  const [photoDragging, setPhotoDragging] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!serviceId) return;
    Promise.all([
      api.get(`/services/${serviceId}/cellules`),
      api.get(`/services/${serviceId}/specialites`),
      api.get(`/roulements?service_id=${serviceId}`),
    ]).then(([c, s, r]) => {
      setCellules(c);
      setSpecialites(s);
      setRoulements(r);
    }).catch(console.error);
  }, [serviceId]);

  function handleFileChange(file) {
    if (!file || !file.type.startsWith('image/')) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function handleFileDrop(e) {
    e.preventDefault();
    setPhotoDragging(false);
    handleFileChange(e.dataTransfer?.files[0]);
  }

  const isNew = !agent;
  const canSave = nom && matricule && celluleId;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      let agentId;
      if (!isNew) {
        agentId = agent.agent_id;
        await api.put(`/agents/${agentId}`, { nom, prenom, matricule, email, telephone, type_contrat: typeContrat || null });
        await api.put(`/agents/assignments/${agent.id}`, {
          cellule_id: celluleId,
          specialite_id: specialiteId || null,
          roulement_id: roulementId || null,
          date_debut: dateDebut,
          is_active: isActive,
          date_debut_reference: roulementNeedsDateRef ? (dateRefAgent || null) : null,
        });
      } else {
        const created = await api.post('/agents', {
          nom, prenom, matricule, email, telephone, type_contrat: typeContrat || null,
          assignment: serviceId ? {
            service_id: serviceId,
            cellule_id: celluleId,
            specialite_id: specialiteId || null,
            roulement_id: roulementId || null,
            date_debut: dateDebut,
            is_active: isActive,
            date_debut_reference: roulementNeedsDateRef ? (dateRefAgent || null) : null,
          } : undefined,
        });
        agentId = created.id;
      }

      if (photoFile) {
        const base64 = await fileToBase64(photoFile);
        await api.post(`/agents/${agentId}/photo`, { data: base64, mimeType: photoFile.type });
      } else if (!photoPreview && originalPhotoUrl) {
        await api.delete(`/agents/${agentId}/photo`);
      }

      onSaved();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{isNew ? 'Nouvel agent' : 'Modifier agent'}{serviceName ? ` — ${serviceName}` : ''}</span>
          <button className="btn btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">

          {/* ── Photo ── */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
            <div
              onDragOver={e => { e.preventDefault(); setPhotoDragging(true); }}
              onDragLeave={() => setPhotoDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                width: 80, height: 80, borderRadius: '50%', flexShrink: 0,
                border: `2px dashed ${photoDragging ? 'var(--accent)' : 'var(--border)'}`,
                cursor: 'pointer', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: photoDragging ? 'var(--bg-hover)' : 'var(--bg-surface)',
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              {photoPreview
                ? <img src={photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.4, padding: '0 8px' }}>
                    Glisser photo
                  </span>
              }
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 4 }}>
                Photo d'identité
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                Glissez une image ou cliquez sur le cercle
              </div>
              {photoPreview && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={e => { e.stopPropagation(); setPhotoFile(null); setPhotoPreview(null); }}
                  style={{ fontSize: 10 }}
                >
                  Supprimer la photo
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => handleFileChange(e.target.files[0])}
            />
          </div>

          {/* ── Identité ── */}
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>Nom *</label>
              <input value={nom} onChange={e => setNom(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Prénom</label>
              <input value={prenom} onChange={e => setPrenom(e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>Matricule *</label>
              <input value={matricule} onChange={e => setMatricule(e.target.value)}
                style={{ fontFamily: 'var(--font-mono)' }} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Téléphone</label>
              <input type="tel" value={telephone} onChange={e => setTelephone(e.target.value)}
                style={{ fontFamily: 'var(--font-mono)' }} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>Type de contrat</label>
              <select value={typeContrat} onChange={e => setTypeContrat(e.target.value)}>
                <option value="">— Non renseigné —</option>
                <option value="CDI">CDI</option>
                <option value="CDD">CDD</option>
                <option value="CFA">CFA</option>
                <option value="INTERIM">INTERIM</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          </div>

          {/* ── Affectation ── */}
          {serviceId && (
            <>
              <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0 10px', paddingTop: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                  Affectation
                </span>
              </div>
              <div className="form-group">
                <label>Cellule *</label>
                <select value={celluleId} onChange={e => { setCelluleId(e.target.value); setSpecialiteId(''); }}>
                  <option value="">— Choisir une cellule —</option>
                  {cellules.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Spécialité</label>
                  <select value={specialiteId} onChange={e => setSpecialiteId(e.target.value)}>
                    <option value="">— Aucune —</option>
                    {specialites.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Roulement</label>
                  <select value={roulementId} onChange={e => { setRoulementId(e.target.value); setDateRefAgent(''); }}>
                    <option value="">— Aucun —</option>
                    {roulements.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.nom}{r.date_ref_par_agent ? ' ★' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {roulementNeedsDateRef && (
                <div className="form-group">
                  <label>Date de référence du roulement pour cet agent *</label>
                  <input
                    type="date"
                    value={dateRefAgent}
                    onChange={e => setDateRefAgent(e.target.value)}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Ce roulement utilise une date de référence propre à chaque agent (★).
                  </div>
                </div>
              )}
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Date de début d'affectation *</label>
                  <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} />
                </div>
                <div className="form-group" style={{ flex: 1, justifyContent: 'flex-end' }}>
                  <label style={{ visibility: 'hidden' }}>Statut</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '5px 0' }}>
                    <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)}
                      style={{ width: 15, height: 15 }} />
                    <span style={{ fontSize: 12, color: isActive ? 'var(--success)' : 'var(--text-muted)' }}>
                      {isActive ? 'Agent actif' : 'Agent inactif'}
                    </span>
                  </label>
                </div>
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!canSave || saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AssignmentModal({ agent, serviceId, serviceName, api, onClose, onSaved }) {
  const [celluleId, setCelluleId] = useState('');
  const [specialiteId, setSpecialiteId] = useState('');
  const [roulementId, setRoulementId] = useState('');
  const [dateRefAgent, setDateRefAgent] = useState('');
  const [dateDebut, setDateDebut] = useState(() => new Date().toISOString().split('T')[0]);
  const [cellules, setCellules] = useState([]);
  const [specialites, setSpecialites] = useState([]);
  const [roulements, setRoulements] = useState([]);
  const [saving, setSaving] = useState(false);

  const selectedRoulement = useMemo(
    () => roulements.find(r => r.id === roulementId),
    [roulements, roulementId]
  );
  const roulementNeedsDateRef = selectedRoulement?.date_ref_par_agent === true;

  useEffect(() => {
    if (!serviceId) return;
    Promise.all([
      api.get(`/services/${serviceId}/cellules`),
      api.get(`/services/${serviceId}/specialites`),
      api.get(`/roulements?service_id=${serviceId}`),
    ]).then(([c, s, r]) => { setCellules(c); setSpecialites(s); setRoulements(r); })
      .catch(console.error);
  }, [serviceId]);

  async function handleSave() {
    if (!celluleId) return;
    setSaving(true);
    try {
      await api.post(`/agents/${agent.id}/assignments`, {
        service_id: serviceId,
        cellule_id: celluleId,
        specialite_id: specialiteId || null,
        roulement_id: roulementId || null,
        date_debut: dateDebut,
        date_debut_reference: roulementNeedsDateRef ? (dateRefAgent || null) : null,
        is_active: true,
      });
      onSaved();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  const contrat = agent.type_contrat;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Affecter un agent{serviceName ? ` — ${serviceName}` : ''}</span>
          <button className="btn btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">

          {/* Identité — lecture seule */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: 'var(--bg-surface)', borderRadius: 4, marginBottom: 14 }}>
            <AgentAvatar photoUrl={agent.photo_url} nom={agent.nom} prenom={agent.prenom} size={40} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{agent.prenom} {agent.nom}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{agent.matricule}</div>
            </div>
            {contrat && (
              <span style={{
                marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
                background: CONTRAT_COLORS[contrat]?.bg,
                color: CONTRAT_COLORS[contrat]?.text,
                border: `1px solid ${CONTRAT_COLORS[contrat]?.border}`,
              }}>
                {contrat}
              </span>
            )}
          </div>

          {/* Affectation */}
          <div className="form-group">
            <label>Cellule *</label>
            <select value={celluleId} onChange={e => { setCelluleId(e.target.value); setSpecialiteId(''); }}>
              <option value="">— Choisir une cellule —</option>
              {cellules.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>Spécialité</label>
              <select value={specialiteId} onChange={e => setSpecialiteId(e.target.value)}>
                <option value="">— Aucune —</option>
                {specialites.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Roulement</label>
              <select value={roulementId} onChange={e => { setRoulementId(e.target.value); setDateRefAgent(''); }}>
                <option value="">— Aucun —</option>
                {roulements.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.nom}{r.date_ref_par_agent ? ' ★' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {roulementNeedsDateRef && (
            <div className="form-group">
              <label>Date de référence du roulement pour cet agent *</label>
              <input type="date" value={dateRefAgent} onChange={e => setDateRefAgent(e.target.value)} />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Ce roulement utilise une date de référence propre à chaque agent (★).
              </div>
            </div>
          )}
          <div className="form-group">
            <label>Date de début d'affectation *</label>
            <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!celluleId || saving}>
            {saving ? 'Enregistrement…' : 'Affecter'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AgentAvatar({ photoUrl, nom, prenom, size = 32 }) {
  const initials = `${(prenom?.[0] || '').toUpperCase()}${(nom?.[0] || '').toUpperCase()}`;
  const hue = (nom || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt=""
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `hsl(${hue}, 35%, 75%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.36), fontWeight: 700,
      color: `hsl(${hue}, 35%, 28%)`,
      flexShrink: 0, userSelect: 'none',
    }}>
      {initials || '?'}
    </div>
  );
}
