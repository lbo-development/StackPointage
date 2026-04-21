// ============ ContextMenu.jsx ============
import { useEffect, useRef } from 'react';

export default function ContextMenu({ x, y, agent, date, currentCode, codes, convocations, canEdit, onSelectCode, onClose, onOpenModal }) {
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Ajuster position pour ne pas dépasser l'écran
  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - 300);

  const formatDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div ref={ref} className="context-menu" style={{ left: adjustedX, top: adjustedY }}>
      <div className="context-menu-header">
        <div className="agent-name">{agent.prenom} {agent.nom}</div>
        <div className="agent-meta">{agent.matricule} · {formatDate(date)}</div>
      </div>

      {canEdit && (
        <div className="context-menu-section">
          <div className="context-menu-label">Saisir un code</div>
          {codes.map(code => (
            <div
              key={code.code}
              className="context-menu-item"
              onClick={() => onSelectCode(code.code)}
              style={{ backgroundColor: currentCode === code.code ? 'var(--bg-active)' : undefined }}
            >
              <span
                className="code-badge"
                style={{ background: code.bg_color, color: code.text_color }}
              >
                {code.code}
              </span>
              <span>{code.libelle}</span>
              {currentCode === code.code && <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: 10 }}>✓</span>}
            </div>
          ))}
          <div className="context-menu-item" onClick={onOpenModal} style={{ color: 'var(--accent)' }}>
            ✏️ Saisie avec commentaire…
          </div>
        </div>
      )}

      {convocations?.length > 0 && (
        <div className="context-menu-section">
          <div className="context-menu-label">Convocations</div>
          {convocations.map((c, i) => (
            <div key={i} className="context-menu-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
              <span style={{ fontWeight: 600 }}>{c.intitule}</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{c.type}</span>
            </div>
          ))}
        </div>
      )}

      <div className="context-menu-section">
        <div className="context-menu-item" onClick={onClose} style={{ color: 'var(--text-muted)' }}>
          ✕ Fermer
        </div>
      </div>
    </div>
  );
}
