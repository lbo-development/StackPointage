import { useState } from 'react';

export default function PointageModal({ agent, date, currentCode, codes, onSave, onClose }) {
  const [code, setCode] = useState(currentCode || '');
  const [commentaire, setCommentaire] = useState('');
  const [saving, setSaving] = useState(false);

  const formatDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  async function handleSave() {
    if (!code) return;
    setSaving(true);
    try {
      await onSave({ agentId: agent.id, date, code, commentaire });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Saisie pointage</span>
          <button className="btn btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ background: 'var(--bg-surface)', borderRadius: 4, padding: '10px 12px' }}>
            <div style={{ fontWeight: 600 }}>{agent.prenom} {agent.nom}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{agent.matricule}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{formatDate(date)}</div>
          </div>
          <div className="form-group">
            <label>Code de pointage *</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {codes.map(c => (
                <button key={c.code} className={`btn btn-sm ${code === c.code ? 'btn-primary' : ''}`}
                  style={{ background: code === c.code ? undefined : c.bg_color, color: code === c.code ? undefined : c.text_color, borderColor: 'transparent', minWidth: 60 }}
                  onClick={() => setCode(c.code)} title={c.libelle}>
                  <strong>{c.code}</strong>
                </button>
              ))}
            </div>
          </div>
          {code && <div style={{ padding: '6px 10px', background: 'var(--bg-surface)', borderRadius: 4, fontSize: 12 }}>
            <strong style={{ fontFamily: 'var(--font-mono)' }}>{code}</strong> — {codes.find(c => c.code === code)?.libelle}
          </div>}
          <div className="form-group">
            <label>Commentaire (optionnel)</label>
            <textarea value={commentaire} onChange={e => setCommentaire(e.target.value)} rows={2} placeholder="Observations…" style={{ width: '100%', resize: 'vertical' }} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!code || saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
