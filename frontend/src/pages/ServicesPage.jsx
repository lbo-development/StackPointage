import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function ServicesPage() {
  const { api, isAdmin, isAdminService } = useAuth();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [expandedServices, setExpandedServices] = useState({});
  const [cellulesMap, setCellulesMap] = useState({});
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editService, setEditService] = useState(null);
  const [showCelluleModal, setShowCelluleModal] = useState(false);
  const [editCellule, setEditCellule] = useState(null);
  const [celluleServiceId, setCelluleServiceId] = useState(null);
  const [ordreServicesModal, setOrdreServicesModal] = useState(false);
  const [ordreCellulesModal, setOrdreCellulesModal] = useState(null); // { service }

  const canEditService = isAdmin;
  const canEditCellule = isAdmin || isAdminService;

  const loadServices = useCallback(() => {
    if (!api) return;
    setLoading(true);
    api.get(`/services?include_inactive=${includeInactive}`)
      .then(data => setServices(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [api, includeInactive]);

  const loadCellules = useCallback((serviceId) => {
    if (!api) return;
    api.get(`/services/${serviceId}/cellules?include_inactive=${includeInactive}`)
      .then(data => setCellulesMap(prev => ({ ...prev, [serviceId]: data })))
      .catch(console.error);
  }, [api, includeInactive]);

  useEffect(() => { loadServices(); }, [loadServices]);

  useEffect(() => {
    Object.keys(expandedServices).forEach(svcId => {
      if (expandedServices[svcId]) loadCellules(svcId);
    });
  }, [includeInactive]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleExpand(serviceId) {
    setExpandedServices(prev => {
      const willExpand = !prev[serviceId];
      if (willExpand) loadCellules(serviceId);
      return { ...prev, [serviceId]: willExpand };
    });
  }

  function onServiceSaved() {
    setShowServiceModal(false);
    loadServices();
    Object.keys(expandedServices).forEach(svcId => {
      if (expandedServices[svcId]) loadCellules(svcId);
    });
  }

  function onCelluleSaved() {
    setShowCelluleModal(false);
    if (celluleServiceId) loadCellules(celluleServiceId);
    loadServices();
  }

  function onOrdreServicesSaved() {
    setOrdreServicesModal(false);
    loadServices();
  }

  function onOrdreCellulesSaved(serviceId) {
    setOrdreCellulesModal(null);
    loadCellules(serviceId);
  }

  return (
    <div className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
      <div style={{ padding: '16px 16px 0', flexShrink: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="page-title">Services &amp; Cellules</h1>
        {canEditService && (
          <button
            className="btn btn-primary"
            onClick={() => { setEditService(null); setShowServiceModal(true); }}
          >
            + Nouveau service
          </button>
        )}
      </div>

      <div className="toolbar" style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={e => setIncludeInactive(e.target.checked)}
            style={{ width: 14, height: 14 }}
          />
          <span style={{ color: 'var(--text-muted)' }}>Inclure inactifs</span>
        </label>
        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
          {services.length} service{services.length !== 1 ? 's' : ''}
        </span>
        {canEditService && services.length > 1 && (
          <button
            className="btn btn-sm"
            onClick={() => setOrdreServicesModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
          >
            ⇅ Ordonner les services
          </button>
        )}
      </div>
      </div>{/* fin padding-wrapper */}

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
      {loading
        ? <div className="loading-overlay"><div className="loading-spinner" /></div>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {services.map(svc => (
              <ServiceCard
                key={svc.id}
                service={svc}
                expanded={!!expandedServices[svc.id]}
                cellules={cellulesMap[svc.id] || []}
                canEditService={canEditService}
                canEditCellule={canEditCellule}
                onToggle={() => toggleExpand(svc.id)}
                onEdit={() => { setEditService(svc); setShowServiceModal(true); }}
                onNewCellule={() => { setEditCellule(null); setCelluleServiceId(svc.id); setShowCelluleModal(true); }}
                onEditCellule={c => { setEditCellule(c); setCelluleServiceId(svc.id); setShowCelluleModal(true); }}
                onOrdreCellules={() => setOrdreCellulesModal({ service: svc })}
              />
            ))}
            {!services.length && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 48 }}>
                Aucun service défini
              </div>
            )}
          </div>
        )
      }
      </div>{/* fin scroll-wrapper */}

      {showServiceModal && (
        <ServiceModal
          service={editService}
          api={api}
          onClose={() => setShowServiceModal(false)}
          onSaved={onServiceSaved}
        />
      )}

      {showCelluleModal && (
        <CelluleModal
          cellule={editCellule}
          serviceId={celluleServiceId}
          api={api}
          onClose={() => setShowCelluleModal(false)}
          onSaved={onCelluleSaved}
        />
      )}

      {ordreServicesModal && (
        <OrdreServicesModal
          services={services}
          api={api}
          onClose={() => setOrdreServicesModal(false)}
          onSaved={onOrdreServicesSaved}
        />
      )}

      {ordreCellulesModal && (
        <OrdreCellulesModal
          service={ordreCellulesModal.service}
          cellules={cellulesMap[ordreCellulesModal.service.id] || []}
          api={api}
          onClose={() => setOrdreCellulesModal(null)}
          onSaved={() => onOrdreCellulesSaved(ordreCellulesModal.service.id)}
        />
      )}
    </div>
  );
}

// ── ServiceCard ─────────────────────────────────────────────────

function ServiceCard({
  service, expanded, cellules,
  canEditService, canEditCellule,
  onToggle, onEdit, onNewCellule, onEditCellule, onOrdreCellules,
}) {
  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      background: 'var(--bg-surface)',
      opacity: !service.is_active ? 0.6 : 1,
    }}>
      {/* En-tête service */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', gap: 10 }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          fontSize: 11,
          padding: '2px 8px',
          borderRadius: 4,
          background: 'rgba(59,130,246,0.15)',
          color: 'var(--accent)',
          border: '1px solid rgba(59,130,246,0.3)',
          flexShrink: 0,
          minWidth: 48,
          textAlign: 'center',
        }}>
          {service.code}
        </span>

        <span
          style={{ fontWeight: 600, color: 'var(--text-primary)', flex: 1, cursor: 'pointer' }}
          onClick={onToggle}
        >
          {service.nom}
          {service.description && (
            <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
              {service.description}
            </span>
          )}
        </span>

        {service.nb_agents > 0 && (
          <span className="badge badge-count" style={{ flexShrink: 0 }}>
            {service.nb_agents} agent{service.nb_agents > 1 ? 's' : ''}
          </span>
        )}

        <span style={{
          fontSize: 10, padding: '2px 8px', borderRadius: 8, flexShrink: 0,
          background: service.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)',
          color: service.is_active ? 'var(--success)' : 'var(--text-muted)',
          border: `1px solid ${service.is_active ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
        }}>
          {service.is_active ? 'Actif' : 'Inactif'}
        </span>

        {canEditService && (
          <button className="btn btn-sm" onClick={e => { e.stopPropagation(); onEdit(); }}>
            Éditer
          </button>
        )}

        <button
          className="btn btn-sm btn-icon"
          onClick={onToggle}
          style={{ fontSize: 12, flexShrink: 0 }}
          title={expanded ? 'Réduire' : 'Développer'}
        >
          {expanded ? '▾' : '▸'}
        </button>
      </div>

      {/* Section cellules */}
      {expanded && (
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '10px 14px',
          background: 'rgba(0,0,0,0.12)',
        }}>
          {/* Toolbar cellules */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
              {cellules.length} cellule{cellules.length !== 1 ? 's' : ''}
            </span>
            {canEditCellule && cellules.length > 1 && (
              <button
                className="btn btn-sm"
                onClick={onOrdreCellules}
                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
              >
                ⇅ Ordonner
              </button>
            )}
            {canEditCellule && (
              <button className="btn btn-sm" onClick={onNewCellule} style={{ marginLeft: 'auto' }}>
                + Nouvelle cellule
              </button>
            )}
          </div>

          {cellules.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '4px 0 6px' }}>
              Aucune cellule pour ce service
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', fontSize: 10, borderBottom: '1px solid var(--border)' }}>
                  <th style={{ width: 36, textAlign: 'center', padding: '4px 0 6px', fontWeight: 500 }}>#</th>
                  <th style={{ width: 90, textAlign: 'left', padding: '4px 8px 6px 0', fontWeight: 500 }}>Code</th>
                  <th style={{ textAlign: 'left', padding: '4px 8px 6px 0', fontWeight: 500 }}>Nom</th>
                  <th style={{ width: 110, textAlign: 'left', padding: '4px 8px 6px 0', fontWeight: 500 }}>Couleur</th>
                  <th style={{ width: 70, textAlign: 'left', padding: '4px 8px 6px 0', fontWeight: 500 }}>Agents</th>
                  <th style={{ width: 80, textAlign: 'left', padding: '4px 8px 6px 0', fontWeight: 500 }}>Statut</th>
                  {canEditCellule && (
                    <th style={{ width: 80, textAlign: 'right', padding: '4px 0 6px', fontWeight: 500 }}>Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {cellules.map((c, ci) => (
                  <tr
                    key={c.id}
                    style={{
                      opacity: !c.is_active ? 0.55 : 1,
                      borderBottom: ci < cellules.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    }}
                  >
                    <td style={{ padding: '6px 0', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                      {ci + 1}
                    </td>
                    <td style={{ padding: '6px 8px 6px 0' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: c.couleur,
                        color: '#fff',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        fontSize: 11,
                      }}>
                        {c.code}
                      </span>
                    </td>
                    <td style={{ padding: '6px 8px 6px 0', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {c.nom}
                    </td>
                    <td style={{ padding: '6px 8px 6px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          width: 14, height: 14, borderRadius: 2,
                          background: c.couleur,
                          border: '1px solid rgba(255,255,255,0.15)',
                          flexShrink: 0,
                        }} />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                          {c.couleur}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '6px 8px 6px 0' }}>
                      {c.nb_agents > 0 && <span className="badge badge-count">{c.nb_agents}</span>}
                    </td>
                    <td style={{ padding: '6px 8px 6px 0' }}>
                      <span style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 8,
                        background: c.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)',
                        color: c.is_active ? 'var(--success)' : 'var(--text-muted)',
                        border: `1px solid ${c.is_active ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
                      }}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {canEditCellule && (
                      <td style={{ padding: '6px 0', textAlign: 'right' }}>
                        <button className="btn btn-sm" onClick={() => onEditCellule(c)}>Éditer</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ── OrdreServicesModal ──────────────────────────────────────────

function OrdreServicesModal({ services, api, onClose, onSaved }) {
  const [liste, setListe] = useState([...services].sort((a, b) => a.num_ordre - b.num_ordre));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const dragIndex = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  function onDragStart(e, index) {
    dragIndex.current = index;
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      const el = document.getElementById(`svc-row-${index}`);
      if (el) el.style.opacity = '0.4';
    }, 0);
  }

  function onDragEnd(index) {
    const el = document.getElementById(`svc-row-${index}`);
    if (el) el.style.opacity = '1';
    setDragOver(null);
    dragIndex.current = null;
  }

  function onDragOver(e, index) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIndex.current === null || dragIndex.current === index) return;
    setDragOver(index);
  }

  function onDrop(e, dropIndex) {
    e.preventDefault();
    const from = dragIndex.current;
    if (from === null || from === dropIndex) return;
    const next = [...liste];
    const [moved] = next.splice(from, 1);
    next.splice(dropIndex, 0, moved);
    setListe(next.map((s, i) => ({ ...s, num_ordre: i + 1 })));
    setDirty(true);
    setDragOver(null);
    dragIndex.current = null;
  }

  function moveUp(index) {
    if (index === 0) return;
    const next = [...liste];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    setListe(next.map((s, i) => ({ ...s, num_ordre: i + 1 })));
    setDirty(true);
  }

  function moveDown(index) {
    if (index === liste.length - 1) return;
    const next = [...liste];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    setListe(next.map((s, i) => ({ ...s, num_ordre: i + 1 })));
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.put('/services/reorder', liste.map(s => ({ id: s.id, num_ordre: s.num_ordre })));
      onSaved();
    } catch (err) {
      alert('Erreur : ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ minWidth: 440, maxWidth: 540 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Ordre d'affichage — Services</span>
          <button className="btn btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ gap: 0, padding: '12px 16px' }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
            Glissez-déposez les lignes ou utilisez les flèches ↑↓.
          </p>
          <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            {liste.map((svc, index) => (
              <div
                key={svc.id}
                id={`svc-row-${index}`}
                draggable
                onDragStart={e => onDragStart(e, index)}
                onDragEnd={() => onDragEnd(index)}
                onDragOver={e => onDragOver(e, index)}
                onDrop={e => onDrop(e, index)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  background: dragOver === index
                    ? 'var(--accent-dim)'
                    : index % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-panel)',
                  borderBottom: '1px solid var(--border)',
                  borderTop: dragOver === index ? '2px solid var(--accent)' : undefined,
                  cursor: 'grab',
                  transition: 'background 0.1s',
                  userSelect: 'none',
                  opacity: !svc.is_active ? 0.5 : 1,
                }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', minWidth: 20, textAlign: 'right' }}>
                  {index + 1}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: 14, cursor: 'grab', lineHeight: 1 }}>⠿</span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11,
                  padding: '2px 7px', borderRadius: 4,
                  background: 'rgba(59,130,246,0.15)', color: 'var(--accent)',
                  border: '1px solid rgba(59,130,246,0.3)',
                }}>
                  {svc.code}
                </span>
                <span style={{ flex: 1, fontWeight: 600, fontSize: 12, color: 'var(--text-primary)' }}>
                  {svc.nom}
                </span>
                <div style={{ display: 'flex', gap: 2 }}>
                  <button className="btn btn-sm btn-icon" onClick={() => moveUp(index)} disabled={index === 0}
                    style={{ opacity: index === 0 ? 0.3 : 1, padding: '2px 5px', fontSize: 11 }} title="Monter">↑</button>
                  <button className="btn btn-sm btn-icon" onClick={() => moveDown(index)} disabled={index === liste.length - 1}
                    style={{ opacity: index === liste.length - 1 ? 0.3 : 1, padding: '2px 5px', fontSize: 11 }} title="Descendre">↓</button>
                </div>
              </div>
            ))}
          </div>
          {dirty && (
            <div className="alert alert-info" style={{ marginTop: 10, fontSize: 11 }}>
              Modifications non sauvegardées — cliquez sur Enregistrer pour appliquer.
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!dirty || saving}>
            {saving
              ? <><span className="loading-spinner" style={{ width: 12, height: 12 }} /> Enregistrement…</>
              : "Enregistrer l'ordre"
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── OrdreCellulesModal ──────────────────────────────────────────

function OrdreCellulesModal({ service, cellules, api, onClose, onSaved }) {
  const [liste, setListe] = useState([...cellules].sort((a, b) => a.ordre - b.ordre));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const dragIndex = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  function onDragStart(e, index) {
    dragIndex.current = index;
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      const el = document.getElementById(`cel-row-${index}`);
      if (el) el.style.opacity = '0.4';
    }, 0);
  }

  function onDragEnd(index) {
    const el = document.getElementById(`cel-row-${index}`);
    if (el) el.style.opacity = '1';
    setDragOver(null);
    dragIndex.current = null;
  }

  function onDragOver(e, index) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIndex.current === null || dragIndex.current === index) return;
    setDragOver(index);
  }

  function onDrop(e, dropIndex) {
    e.preventDefault();
    const from = dragIndex.current;
    if (from === null || from === dropIndex) return;
    const next = [...liste];
    const [moved] = next.splice(from, 1);
    next.splice(dropIndex, 0, moved);
    setListe(next.map((c, i) => ({ ...c, ordre: i + 1 })));
    setDirty(true);
    setDragOver(null);
    dragIndex.current = null;
  }

  function moveUp(index) {
    if (index === 0) return;
    const next = [...liste];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    setListe(next.map((c, i) => ({ ...c, ordre: i + 1 })));
    setDirty(true);
  }

  function moveDown(index) {
    if (index === liste.length - 1) return;
    const next = [...liste];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    setListe(next.map((c, i) => ({ ...c, ordre: i + 1 })));
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.put('/services/cellules/reorder', liste.map(c => ({ id: c.id, ordre: c.ordre })));
      onSaved();
    } catch (err) {
      alert('Erreur : ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ minWidth: 440, maxWidth: 540 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11,
              padding: '2px 7px', borderRadius: 4,
              background: 'rgba(59,130,246,0.15)', color: 'var(--accent)',
              border: '1px solid rgba(59,130,246,0.3)',
            }}>
              {service.code}
            </span>
            <span className="modal-title">Ordre des cellules — {service.nom}</span>
          </div>
          <button className="btn btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ gap: 0, padding: '12px 16px' }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
            Glissez-déposez les lignes ou utilisez les flèches ↑↓.
          </p>
          <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            {liste.map((c, index) => (
              <div
                key={c.id}
                id={`cel-row-${index}`}
                draggable
                onDragStart={e => onDragStart(e, index)}
                onDragEnd={() => onDragEnd(index)}
                onDragOver={e => onDragOver(e, index)}
                onDrop={e => onDrop(e, index)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  background: dragOver === index
                    ? 'var(--accent-dim)'
                    : index % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-panel)',
                  borderBottom: '1px solid var(--border)',
                  borderTop: dragOver === index ? '2px solid var(--accent)' : undefined,
                  cursor: 'grab',
                  transition: 'background 0.1s',
                  userSelect: 'none',
                  opacity: !c.is_active ? 0.5 : 1,
                }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', minWidth: 20, textAlign: 'right' }}>
                  {index + 1}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: 14, cursor: 'grab', lineHeight: 1 }}>⠿</span>
                <span style={{
                  display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                  background: c.couleur, color: '#fff',
                  fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11,
                }}>
                  {c.code}
                </span>
                <span style={{ flex: 1, fontWeight: 600, fontSize: 12, color: 'var(--text-primary)' }}>
                  {c.nom}
                </span>
                {c.nb_agents > 0 && <span className="badge badge-count">{c.nb_agents}</span>}
                <div style={{ display: 'flex', gap: 2 }}>
                  <button className="btn btn-sm btn-icon" onClick={() => moveUp(index)} disabled={index === 0}
                    style={{ opacity: index === 0 ? 0.3 : 1, padding: '2px 5px', fontSize: 11 }} title="Monter">↑</button>
                  <button className="btn btn-sm btn-icon" onClick={() => moveDown(index)} disabled={index === liste.length - 1}
                    style={{ opacity: index === liste.length - 1 ? 0.3 : 1, padding: '2px 5px', fontSize: 11 }} title="Descendre">↓</button>
                </div>
              </div>
            ))}
          </div>
          {dirty && (
            <div className="alert alert-info" style={{ marginTop: 10, fontSize: 11 }}>
              Modifications non sauvegardées — cliquez sur Enregistrer pour appliquer.
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!dirty || saving}>
            {saving
              ? <><span className="loading-spinner" style={{ width: 12, height: 12 }} /> Enregistrement…</>
              : "Enregistrer l'ordre"
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ServiceModal ─────────────────────────────────────────────────

function ServiceModal({ service, api, onClose, onSaved }) {
  const [nom, setNom] = useState(service?.nom || '');
  const [code, setCode] = useState(service?.code || '');
  const [description, setDescription] = useState(service?.description || '');
  const [numOrdre, setNumOrdre] = useState(service?.num_ordre ?? 0);
  const [isActive, setIsActive] = useState(service?.is_active !== false);
  const [saving, setSaving] = useState(false);

  const isNew = !service;
  const canSave = nom.trim() && code.trim();

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        nom: nom.trim(),
        code: code.trim().toUpperCase(),
        description: description.trim() || null,
        num_ordre: parseInt(numOrdre) || 0,
        is_active: isActive,
      };
      if (isNew) {
        await api.post('/services', payload);
      } else {
        await api.put(`/services/${service.id}`, payload);
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
          <span className="modal-title">{isNew ? 'Nouveau service' : `Modifier — ${service.nom}`}</span>
          <button className="btn btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label>Nom *</label>
              <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ex : Bloc A" autoFocus />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Code *</label>
              <input
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="Ex : BLA"
                style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}
                maxLength={10}
              />
            </div>
          </div>
          <div className="form-group">
            <label>Description</label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Description optionnelle"
            />
          </div>
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>Ordre d'affichage</label>
              <input type="number" min={0} value={numOrdre} onChange={e => setNumOrdre(e.target.value)} />
            </div>
            <div className="form-group" style={{ justifyContent: 'flex-end' }}>
              <label style={{ visibility: 'hidden' }}>Statut</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '5px 0' }}>
                <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)}
                  style={{ width: 15, height: 15 }} />
                <span style={{ fontSize: 12, color: isActive ? 'var(--success)' : 'var(--text-muted)' }}>
                  {isActive ? 'Actif' : 'Inactif'}
                </span>
              </label>
            </div>
          </div>
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

// ── CelluleModal ─────────────────────────────────────────────────

function CelluleModal({ cellule, serviceId, api, onClose, onSaved }) {
  const [nom, setNom] = useState(cellule?.nom || '');
  const [code, setCode] = useState(cellule?.code || '');
  const [couleur, setCouleur] = useState(cellule?.couleur || '#4A90D9');
  const [ordre, setOrdre] = useState(cellule?.ordre ?? 0);
  const [isActive, setIsActive] = useState(cellule?.is_active !== false);
  const [saving, setSaving] = useState(false);

  const isNew = !cellule;
  const canSave = nom.trim() && code.trim();

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        nom: nom.trim(),
        code: code.trim().toUpperCase(),
        couleur,
        ordre: parseInt(ordre) || 0,
        is_active: isActive,
      };
      if (isNew) {
        await api.post(`/services/${serviceId}/cellules`, payload);
      } else {
        await api.put(`/services/cellules/${cellule.id}`, payload);
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
          <span className="modal-title">{isNew ? 'Nouvelle cellule' : `Modifier — ${cellule.nom}`}</span>
          <button className="btn btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label>Nom *</label>
              <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ex : Équipe 1" autoFocus />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Code *</label>
              <input
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="Ex : EQ1"
                style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}
                maxLength={10}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Couleur</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="color"
                  value={couleur}
                  onChange={e => setCouleur(e.target.value)}
                  style={{ height: 32, width: 48, padding: 2, cursor: 'pointer' }}
                />
                <span style={{
                  padding: '3px 10px', borderRadius: 4,
                  background: couleur, color: '#fff',
                  fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13,
                }}>
                  {code || 'CODE'}
                </span>
              </div>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Ordre d'affichage</label>
              <input type="number" min={0} value={ordre} onChange={e => setOrdre(e.target.value)} />
            </div>
            <div className="form-group" style={{ justifyContent: 'flex-end' }}>
              <label style={{ visibility: 'hidden' }}>Statut</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '5px 0' }}>
                <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)}
                  style={{ width: 15, height: 15 }} />
                <span style={{ fontSize: 12, color: isActive ? 'var(--success)' : 'var(--text-muted)' }}>
                  {isActive ? 'Active' : 'Inactive'}
                </span>
              </label>
            </div>
          </div>
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
