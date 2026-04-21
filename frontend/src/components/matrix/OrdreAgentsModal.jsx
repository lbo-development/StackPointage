import { useState, useRef } from 'react';

/**
 * Modal de réordonnancement des agents d'une cellule
 * Drag & drop natif HTML5 — zéro dépendance
 *
 * Props:
 *   cellule        : { id, nom, couleur }
 *   agents         : AgentAssignment[] triés par ordre courant
 *   api            : client API
 *   onClose        : () => void
 *   onSaved        : () => void  — appelé après sauvegarde
 */
export default function OrdreAgentsModal({ cellule, agents, api, onClose, onSaved }) {
  // Liste locale réordonnée (on travaille sur une copie)
  const [liste, setListe] = useState(
    [...agents].sort((a, b) => a.ordre - b.ordre)
  );
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Drag & drop state
  const dragIndex = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  // ── Drag handlers ──────────────────────────────────────────
  function onDragStart(e, index) {
    dragIndex.current = index;
    e.dataTransfer.effectAllowed = 'move';
    // Petit délai pour que le ghost soit rendu avant le style
    setTimeout(() => {
      const el = document.getElementById(`ordre-row-${index}`);
      if (el) el.style.opacity = '0.4';
    }, 0);
  }

  function onDragEnd(index) {
    const el = document.getElementById(`ordre-row-${index}`);
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

    // Réécriture des ordres 0-based
    const reindexed = next.map((a, i) => ({ ...a, ordre: i }));
    setListe(reindexed);
    setDirty(true);
    setDragOver(null);
    dragIndex.current = null;
  }

  // ── Boutons ↑ ↓ (accessibilité / mobile) ──────────────────
  function moveUp(index) {
    if (index === 0) return;
    const next = [...liste];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    setListe(next.map((a, i) => ({ ...a, ordre: i })));
    setDirty(true);
  }

  function moveDown(index) {
    if (index === liste.length - 1) return;
    const next = [...liste];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    setListe(next.map((a, i) => ({ ...a, ordre: i })));
    setDirty(true);
  }

  // ── Sauvegarde ─────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    try {
      const ordres = liste.map((a, i) => ({
        assignment_id: a.id,   // id de l'agent_assignment
        ordre: i
      }));
      await api.post('/agents/assignments/reorder', { ordres });
      onSaved();
    } catch (err) {
      alert('Erreur: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ minWidth: 420, maxWidth: 520 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 12, height: 12, borderRadius: '50%',
                background: cellule.couleur, flexShrink: 0
              }}
            />
            <span className="modal-title">
              Ordre d'affichage — {cellule.nom}
            </span>
          </div>
          <button className="btn btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>

        {/* Corps */}
        <div className="modal-body" style={{ gap: 0, padding: '12px 16px' }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
            Glissez-déposez les lignes ou utilisez les flèches ↑↓.
            L'ordre sera respecté dans la matrice de pointage.
          </p>

          <div style={{
            border: '1px solid var(--border)',
            borderRadius: 4,
            overflow: 'hidden'
          }}>
            {liste.map((ag, index) => (
              <div
                key={ag.id}
                id={`ordre-row-${index}`}
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
                    : index % 2 === 0
                      ? 'var(--bg-surface)'
                      : 'var(--bg-panel)',
                  borderBottom: '1px solid var(--border)',
                  borderTop: dragOver === index ? '2px solid var(--accent)' : undefined,
                  cursor: 'grab',
                  transition: 'background 0.1s',
                  userSelect: 'none'
                }}
              >
                {/* Numéro d'ordre */}
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  minWidth: 20,
                  textAlign: 'right'
                }}>
                  {index + 1}
                </span>

                {/* Icône drag */}
                <span style={{
                  color: 'var(--text-muted)',
                  fontSize: 14,
                  cursor: 'grab',
                  lineHeight: 1
                }}>
                  ⠿
                </span>

                {/* Nom agent */}
                <span style={{
                  flex: 1,
                  fontWeight: 600,
                  fontSize: 12,
                  color: 'var(--text-primary)'
                }}>
                  {ag.agents?.nom} {ag.agents?.prenom}
                </span>
                <span style={{
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-muted)'
                }}>
                  {ag.agents?.matricule}
                </span>

                {/* Flèches */}
                <div style={{ display: 'flex', gap: 2 }}>
                  <button
                    className="btn btn-sm btn-icon"
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    title="Monter"
                    style={{ opacity: index === 0 ? 0.3 : 1, padding: '2px 5px', fontSize: 11 }}
                  >
                    ↑
                  </button>
                  <button
                    className="btn btn-sm btn-icon"
                    onClick={() => moveDown(index)}
                    disabled={index === liste.length - 1}
                    title="Descendre"
                    style={{ opacity: index === liste.length - 1 ? 0.3 : 1, padding: '2px 5px', fontSize: 11 }}
                  >
                    ↓
                  </button>
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

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Annuler</button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!dirty || saving}
          >
            {saving
              ? <><span className="loading-spinner" style={{ width: 12, height: 12 }} /> Enregistrement…</>
              : `Enregistrer l'ordre`
            }
          </button>
        </div>
      </div>
    </div>
  );
}
