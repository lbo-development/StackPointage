import { useState, useMemo, useRef, useEffect } from 'react';

function formatDateFR(str) {
  return new Date(str + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

function countDays(debut, fin) {
  const ms = new Date(fin + 'T00:00:00') - new Date(debut + 'T00:00:00');
  return Math.round(ms / 86400000) + 1;
}

const TYPES = ['Présence','Repos','Congé','Maladie','Absence','Autre absence','Autre présence','Autre'];

function CodeBadge({ codeObj, dim }) {
  if (!codeObj) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 3,
      background: codeObj.bg_color, color: codeObj.text_color,
      fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)',
      opacity: dim ? 0.55 : 1,
    }}>
      {codeObj.code}
    </span>
  );
}

export default function PointageModal({ agent, dateDebut, dateFin, currentCode, currentCommentaire, codes, onSave, onReset, onClose }) {
  const [code, setCode]               = useState(currentCode === '*' ? '' : (currentCode || ''));
  const [commentaire, setCommentaire] = useState(currentCommentaire || '');
  const [saving, setSaving]           = useState(false);
  const [search, setSearch]           = useState('');
  const [filterType, setFilterType]   = useState('');
  const selectedRef                   = useRef(null);

  const isRange = dateDebut !== dateFin;
  const nbJours = isRange ? countDays(dateDebut, dateFin) : 1;

  const types = useMemo(() => {
    const set = new Set(codes.map(c => c.type).filter(Boolean));
    return [...set];
  }, [codes]);

  const filteredCodes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return codes.filter(c => {
      if (filterType && c.type !== filterType) return false;
      if (q) return c.code.toLowerCase().includes(q) || c.libelle.toLowerCase().includes(q);
      return true;
    });
  }, [codes, filterType, search]);

  // Scroll vers la ligne sélectionnée au premier rendu
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [filterType, search]);

  const currentCodeObj  = codes.find(c => c.code === currentCode);
  const selectedCodeObj = codes.find(c => c.code === code);

  async function handleSave() {
    if (!code) return;
    setSaving(true);
    try {
      await onSave({ agentId: agent.id, dateDebut, dateFin, code, commentaire });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ minWidth: 480, maxWidth: 560 }}>

        {/* ── HEADER ── */}
        <div className="modal-header" style={{ gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Nom + codes courant → sélectionné */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="modal-title" style={{ marginRight: 4 }}>
                {agent.prenom} {agent.nom}
              </span>
              {currentCode === '*'
                ? <span style={{ padding: '2px 8px', borderRadius: 3, background: 'var(--bg-surface)', color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'var(--font-mono)', border: '1px solid var(--border)' }}>*</span>
                : currentCodeObj
                  ? <CodeBadge codeObj={currentCodeObj} dim />
                  : <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>sans code</span>
              }
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>→</span>
              {selectedCodeObj
                ? <CodeBadge codeObj={selectedCodeObj} dim={false} />
                : <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>
              }
            </div>
            {/* Date */}
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
              {isRange ? (
                <>
                  Du {formatDateFR(dateDebut)} au {formatDateFR(dateFin)}
                  <span style={{ marginLeft: 8, color: 'var(--accent)', fontWeight: 600 }}>
                    ({nbJours} jour{nbJours > 1 ? 's' : ''})
                  </span>
                </>
              ) : (
                formatDateFR(dateDebut)
              )}
            </div>
          </div>
          <button className="btn btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>

        {/* ── BODY ── */}
        <div className="modal-body">

          {/* Filtres */}
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              placeholder="Rechercher code ou libellé…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ flex: 1 }}
              autoFocus
            />
            {types.length > 0 && (
              <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ minWidth: 130 }}>
                <option value="">Tous les types</option>
                {types.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}
          </div>

          {/* Liste des codes */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            <div style={{ height: 231, overflowY: 'auto' }}>
              {filteredCodes.length === 0 ? (
                <div style={{ padding: 14, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                  Aucun code trouvé
                </div>
              ) : (
                filteredCodes.map(c => {
                  const isSelected = code === c.code;
                  return (
                    <div
                      key={c.code}
                      ref={isSelected ? selectedRef : null}
                      className={`code-list-item${isSelected ? ' selected' : ''}`}
                      onClick={() => setCode(c.code)}
                    >
                      <span style={{
                        width: 14, height: 14, borderRadius: 2, flexShrink: 0,
                        background: c.bg_color,
                        border: '1px solid rgba(255,255,255,0.12)',
                      }} />
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12,
                        color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                        minWidth: 40,
                      }}>
                        {c.code}
                      </span>
                      <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)' }}>
                        {c.libelle}
                      </span>
                      {c.type && (
                        <span style={{
                          fontSize: 9, color: 'var(--text-muted)',
                          background: 'var(--bg-surface)',
                          padding: '1px 5px', borderRadius: 3,
                          fontFamily: 'var(--font-ui)',
                        }}>
                          {c.type}
                        </span>
                      )}
                      {isSelected && (
                        <span style={{ color: 'var(--accent)', fontSize: 13, marginLeft: 4 }}>✓</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Commentaire — masqué pour les plages multi-jours */}
          {!isRange && (
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
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Annuler</button>
          {onReset && (
            <button
              className="btn"
              style={{ color: 'var(--danger, #ef4444)', borderColor: 'var(--danger, #ef4444)' }}
              disabled={saving}
              onClick={() => onReset({ agentId: agent.id, dateDebut, dateFin })}
            >
              ↺ Réinitialiser au théorique
            </button>
          )}
          <button className="btn btn-primary" onClick={handleSave} disabled={!code || saving}>
            {saving
              ? 'Enregistrement…'
              : isRange
                ? `Appliquer sur ${nbJours} jour${nbJours > 1 ? 's' : ''}`
                : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
