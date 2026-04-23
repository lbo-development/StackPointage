import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function SpecialitesPage() {
  const { api, isAdmin, isAdminService } = useAuth();
  const { selectedService } = useOutletContext();
  const [specialites, setSpecialites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editSpec, setEditSpec] = useState(null);
  const [ordreModal, setOrdreModal] = useState(false);

  const canEdit = isAdmin || isAdminService;

  function load() {
    if (!api || !selectedService) return;
    setLoading(true);
    api.get(`/services/${selectedService.id}/specialites`)
      .then(setSpecialites)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(load, [api, selectedService]);

  if (!selectedService) {
    return (
      <div className="page-wrapper">
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>
          Sélectionnez un service dans la barre latérale
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="page-title">
          Spécialités — {selectedService.nom}
        </h1>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => { setEditSpec(null); setShowModal(true); }}>
            + Nouvelle spécialité
          </button>
        )}
      </div>

      <div className="toolbar" style={{ marginBottom: 16 }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
          {specialites.length} spécialité{specialites.length !== 1 ? 's' : ''}
        </span>
        {canEdit && specialites.length > 1 && (
          <button
            className="btn btn-sm"
            onClick={() => setOrdreModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
          >
            ⇅ Ordonner les spécialités
          </button>
        )}
      </div>

      {loading
        ? <div className="loading-overlay"><div className="loading-spinner" /></div>
        : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>Ordre</th>
                <th style={{ width: 60 }}>Code</th>
                <th>Nom</th>
                <th style={{ width: 80 }}>Couleur</th>
                <th style={{ width: 80 }}>Statut</th>
                <th style={{ width: 80 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {specialites.map(s => (
                <tr key={s.id} style={!s.is_active ? { opacity: 0.45 } : undefined}>
                  <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    {s.ordre}
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: s.couleur,
                      color: '#fff',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      fontSize: 11,
                    }}>
                      {s.code}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.nom}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 18, height: 18, borderRadius: 3, background: s.couleur, border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{s.couleur}</span>
                    </div>
                  </td>
                  <td>
                    <span style={{
                      fontSize: 10, padding: '2px 7px', borderRadius: 8,
                      background: s.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)',
                      color: s.is_active ? 'var(--success)' : 'var(--text-muted)',
                      border: `1px solid ${s.is_active ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
                    }}>
                      {s.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-sm" onClick={() => { setEditSpec(s); setShowModal(true); }}>
                      Éditer
                    </button>
                  </td>
                </tr>
              ))}
              {!specialites.length && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
                    Aucune spécialité définie pour ce service
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )
      }

      {showModal && (
        <SpecialiteModal
          spec={editSpec}
          serviceId={selectedService.id}
          api={api}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}

      {ordreModal && (
        <OrdreSpecialitesModal
          service={selectedService}
          specialites={specialites}
          api={api}
          onClose={() => setOrdreModal(false)}
          onSaved={() => { setOrdreModal(false); load(); }}
        />
      )}
    </div>
  );
}

function OrdreSpecialitesModal({ service, specialites, api, onClose, onSaved }) {
  const [liste, setListe] = useState([...specialites].sort((a, b) => a.ordre - b.ordre));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const dragIndex = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  function onDragStart(e, index) {
    dragIndex.current = index;
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      const el = document.getElementById(`spec-row-${index}`);
      if (el) el.style.opacity = '0.4';
    }, 0);
  }

  function onDragEnd(index) {
    const el = document.getElementById(`spec-row-${index}`);
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
    setListe(next.map((s, i) => ({ ...s, ordre: i + 1 })));
    setDirty(true);
    setDragOver(null);
    dragIndex.current = null;
  }

  function moveUp(index) {
    if (index === 0) return;
    const next = [...liste];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    setListe(next.map((s, i) => ({ ...s, ordre: i + 1 })));
    setDirty(true);
  }

  function moveDown(index) {
    if (index === liste.length - 1) return;
    const next = [...liste];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    setListe(next.map((s, i) => ({ ...s, ordre: i + 1 })));
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.put('/services/specialites/reorder', liste.map(s => ({ id: s.id, ordre: s.ordre })));
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
          <span className="modal-title">Ordre d'affichage — Spécialités {service.nom}</span>
          <button className="btn btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ gap: 0, padding: '12px 16px' }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
            Glissez-déposez les lignes ou utilisez les flèches ↑↓.
          </p>
          <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            {liste.map((s, index) => (
              <div
                key={s.id}
                id={`spec-row-${index}`}
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
                  opacity: !s.is_active ? 0.5 : 1,
                }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', minWidth: 20, textAlign: 'right' }}>
                  {index + 1}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: 14, cursor: 'grab', lineHeight: 1 }}>⠿</span>
                <span style={{
                  display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                  background: s.couleur, color: '#fff',
                  fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11,
                }}>
                  {s.code}
                </span>
                <span style={{ flex: 1, fontWeight: 600, fontSize: 12, color: 'var(--text-primary)' }}>
                  {s.nom}
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

function SpecialiteModal({ spec, serviceId, api, onClose, onSaved }) {
  const [nom, setNom] = useState(spec?.nom || '');
  const [code, setCode] = useState(spec?.code || '');
  const [couleur, setCouleur] = useState(spec?.couleur || '#7B68EE');
  const [ordre, setOrdre] = useState(spec?.ordre ?? 0);
  const [isActive, setIsActive] = useState(spec?.is_active !== false);
  const [saving, setSaving] = useState(false);

  const isNew = !spec;
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
        await api.post(`/services/${serviceId}/specialites`, payload);
      } else {
        await api.put(`/services/specialites/${spec.id}`, payload);
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
          <span className="modal-title">{isNew ? 'Nouvelle spécialité' : 'Modifier spécialité'}</span>
          <button className="btn btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label>Nom *</label>
              <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ex : Chef d'atelier" />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Code *</label>
              <input
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="Ex : CA"
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
              <input
                type="number"
                min={0}
                value={ordre}
                onChange={e => setOrdre(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ justifyContent: 'flex-end' }}>
              <label style={{ visibility: 'hidden' }}>Statut</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '5px 0' }}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={e => setIsActive(e.target.checked)}
                  style={{ width: 15, height: 15 }}
                />
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
