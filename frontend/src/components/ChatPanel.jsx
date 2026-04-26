import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

// ─── Résumé de la matrice envoyé comme contexte au bot ───────────────────────
export function buildMatrixContext(data, selectedService, selectedCellule, dateDebut, dateFin) {
  if (!data?.agents?.length) return null;

  const { agents, dates, cellules, codesMap, cumulsCustom } = data;
  const lines = [];

  lines.push(`Service: ${selectedService?.nom || 'N/A'}`);
  if (selectedCellule) lines.push(`Cellule filtrée: ${selectedCellule.nom}`);
  lines.push(`Période: ${dateDebut} au ${dateFin} (${dates.length} jours)`);
  lines.push(`Effectif affiché: ${agents.length} agent${agents.length > 1 ? 's' : ''}`);
  lines.push('');

  // Regrouper par cellule
  const byCellule = {};
  agents.forEach(ag => {
    const cid = ag.cellule_id;
    if (!byCellule[cid]) byCellule[cid] = [];
    byCellule[cid].push(ag);
  });

  lines.push('=== AGENTS ET POINTAGES ===');
  Object.entries(byCellule).forEach(([cid, cAgents]) => {
    const cellule = cellules.find(c => c.id === cid);
    lines.push(`\nCellule: ${cellule?.nom || cid}`);

    cAgents.forEach(ag => {
      const codeCount = {};
      let joursSansSaisie = 0;
      const dailyCols = [];

      dates.forEach(d => {
        const reel = ag.reel[d];
        const theo = ag.theorique[d];
        const entry = reel || theo;
        if (entry?.code) {
          codeCount[entry.code] = (codeCount[entry.code] || 0) + 1;
          // r = réel saisi, t = théorique seul
          const src = reel ? 'r' : 't';
          const comment = reel?.commentaire ? `*` : '';
          dailyCols.push(`${d.slice(5)}:${entry.code}(${src})${comment}`);
        } else {
          joursSansSaisie++;
          dailyCols.push(`${d.slice(5)}:-`);
        }
      });

      const summary = Object.entries(codeCount)
        .sort((a, b) => b[1] - a[1])
        .map(([code, n]) => `${code}×${n}`)
        .join(', ');
      const noEntry = joursSansSaisie > 0 ? ` | sans saisie: ${joursSansSaisie}j` : '';
      lines.push(`  - ${ag.agent.nom} ${ag.agent.prenom}: ${summary || 'aucun pointage'}${noEntry}`);
      lines.push(`    ${dailyCols.join(' ')}`);
    });
  });

  // Lignes de cumul
  if (cumulsCustom) {
    const cumulsLines = [];
    Object.entries(cumulsCustom).forEach(([cid, cfgs]) => {
      const cellule = cellules.find(c => c.id === cid);
      cfgs.forEach(cfg => {
        const counts = dates.map(d => cfg.dailyCounts?.[d] || 0);
        const max = Math.max(...counts);
        const min = Math.min(...counts);
        const avg = (counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(1);
        const alert = cfg.seuil_alerte != null
          ? ` | alerte si ${cfg.seuil_operateur || '<='} ${cfg.seuil_alerte}`
          : '';
        const spec = cfg.specialites?.nom ? ` [${cfg.specialites.nom}]` : '';
        cumulsLines.push(`  - ${cellule?.nom}${spec} / ${cfg.libelle || cfg.code_pointage} (${cfg.code_pointage}): min=${min} max=${max} moy=${avg}${alert}`);
      });
    });
    if (cumulsLines.length) {
      lines.push('\n=== CUMULS CONFIGURÉS ===');
      lines.push(...cumulsLines);
    }
  }

  // Légende des codes
  const usedCodes = new Set(agents.flatMap(ag =>
    dates.map(d => ag.reel[d]?.code || ag.theorique[d]?.code).filter(Boolean)
  ));
  if (usedCodes.size) {
    lines.push('\n=== CODES UTILISÉS ===');
    [...usedCodes].sort().forEach(code => {
      const c = codesMap[code];
      if (c) lines.push(`  ${code}: ${c.libelle}${c.type ? ` (${c.type})` : ''}`);
    });
  }

  return lines.join('\n');
}

// ─── Composant principal ──────────────────────────────────────────────────────
const SUGGESTIONS = [
  'Qui a le plus d\'absences sur cette période ?',
  'Y a-t-il des anomalies ou irrégularités ?',
  'Fais un résumé des présences par cellule.',
  'Quels agents ont des alertes sur les cumuls ?',
];

export default function ChatPanel({ matrixContext }) {
  const { api } = useAuth();
  const [open, setOpen]       = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const endRef   = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  async function send(text) {
    const content = (text || input).trim();
    if (!content || loading) return;
    setInput('');

    const next = [...messages, { role: 'user', content }];
    setMessages(next);
    setLoading(true);

    try {
      const res = await api.post('/chat', {
        messages: next,
        context: matrixContext,
      });
      setMessages(prev => [...prev, { role: 'assistant', content: res.content }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Bouton flottant */}
      <button
        onClick={() => setOpen(p => !p)}
        title={open ? 'Fermer l\'assistant' : 'Assistant IA — Analyse de la matrice'}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1100,
          width: 48, height: 48, borderRadius: '50%',
          background: open
            ? 'var(--bg-surface)'
            : 'linear-gradient(135deg, #2d6e26 0%, #8dc63f 100%)',
          border: open ? '1px solid var(--border)' : 'none',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.45)',
          fontSize: 20, color: open ? 'var(--text-muted)' : '#fff',
          transition: 'all 0.2s',
        }}
      >
        {open ? '✕' : '✦'}
      </button>

      {/* Panneau chat */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 84, right: 24, zIndex: 1099,
          width: 390, height: 560,
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>

          {/* Header */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--bg-surface)',
            flexShrink: 0,
          }}>
            <span style={{
              fontSize: 15,
              background: 'linear-gradient(135deg, #2d6e26, #8dc63f)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>✦</span>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Assistant SIPRA</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>
              {matrixContext ? 'Matrice chargée' : 'Pas de données'}
            </span>
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                title="Effacer la conversation"
                style={{
                  marginLeft: 'auto', background: 'none', border: 'none',
                  cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11,
                  padding: '2px 6px', borderRadius: 4,
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-panel)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                Effacer
              </button>
            )}
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '12px 14px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {messages.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', marginBottom: 4 }}>
                  {matrixContext
                    ? 'Posez une question sur les données affichées.'
                    : 'Chargez une matrice pour activer l\'analyse.'}
                </div>
                {matrixContext && SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => send(s)}
                    style={{
                      background: 'var(--bg-surface)', border: '1px solid var(--border)',
                      borderRadius: 8, padding: '7px 10px', cursor: 'pointer',
                      fontSize: 11, color: 'var(--text-secondary)', textAlign: 'left',
                      lineHeight: 1.4,
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '88%',
                padding: '8px 11px',
                borderRadius: m.role === 'user'
                  ? '12px 12px 3px 12px'
                  : '12px 12px 12px 3px',
                background: m.role === 'user'
                  ? 'rgba(141,198,63,0.15)'
                  : 'var(--bg-surface)',
                border: `1px solid ${m.role === 'user' ? 'rgba(141,198,63,0.3)' : 'var(--border)'}`,
                fontSize: 12, lineHeight: 1.6,
                color: 'var(--text-primary)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {m.content}
              </div>
            ))}

            {loading && (
              <div style={{
                alignSelf: 'flex-start',
                padding: '8px 11px',
                borderRadius: '12px 12px 12px 3px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                fontSize: 12, color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ animation: 'pulse 1.2s infinite' }}>✦</span>
                Analyse en cours…
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '10px 12px',
            borderTop: '1px solid var(--border)',
            display: 'flex', gap: 6,
            background: 'var(--bg-surface)',
            flexShrink: 0,
          }}>
            <input
              ref={inputRef}
              className="form-control"
              style={{ flex: 1, fontSize: 12, padding: '6px 10px' }}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              placeholder={matrixContext ? 'Posez votre question…' : 'Chargez une matrice d\'abord'}
              disabled={loading || !matrixContext}
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={() => send()}
              disabled={loading || !input.trim() || !matrixContext}
              style={{ flexShrink: 0, padding: '0 12px', fontSize: 14 }}
            >
              ↑
            </button>
          </div>
        </div>
      )}
    </>
  );
}
