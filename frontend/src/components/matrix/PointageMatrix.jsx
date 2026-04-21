import { useMemo } from 'react';

const TODAY = new Date().toISOString().split('T')[0];

function getDayInfo(dateStr, feriesSet) {
  const d = new Date(dateStr + 'T00:00:00');
  const dow = d.getDay(); // 0=dim, 6=sam
  return {
    isSam: dow === 6,
    isDim: dow === 0,
    isWeekend: dow === 0 || dow === 6,
    isFerie: feriesSet.has(dateStr),
    isToday: dateStr === TODAY,
    label: d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'numeric' })
  };
}

export default function PointageMatrix({ data, mode, canEdit, onCellClick, onCellContextMenu }) {
  const { dates, cellules, specialites, agents, cumuls, feries, codesMap } = data;
  const feriesSet = useMemo(() => new Set(feries || []), [feries]);

  // Grouper agents par cellule → spécialité
  // Tri : ordre (champ agent_assignments.ordre) puis nom en fallback
  const grouped = useMemo(() => {
    const map = {};
    cellules.forEach(c => { map[c.id] = { cellule: c, specialites: {}, agentsDirect: [] }; });

    // Trier les agents par ordre avant de les grouper
    const sorted = [...agents].sort((a, b) => {
      if (a.ordre !== b.ordre) return a.ordre - b.ordre;
      // Fallback alphabétique si même ordre
      return (a.agent.nom + a.agent.prenom).localeCompare(b.agent.nom + b.agent.prenom);
    });

    sorted.forEach(ag => {
      const cid = ag.cellule_id;
      if (!map[cid]) return;
      const sid = ag.specialite_id;
      if (sid) {
        if (!map[cid].specialites[sid]) map[cid].specialites[sid] = [];
        map[cid].specialites[sid].push(ag);
      } else {
        map[cid].agentsDirect.push(ag);
      }
    });
    return map;
  }, [cellules, agents]);

  const specialitesMap = useMemo(() => {
    const m = {};
    (specialites || []).forEach(s => { m[s.id] = s; });
    return m;
  }, [specialites]);

  if (!agents.length) {
    return (
      <div className="loading-overlay" style={{ flex: 1 }}>
        <span style={{ color: 'var(--text-muted)' }}>Aucun agent sur cette période</span>
      </div>
    );
  }

  // Construire les lignes dans l'ordre cellule > spécialité > agent
  const rows = [];

  cellules.forEach(cellule => {
    const group = grouped[cellule.id];
    if (!group) return;

    // En-tête cellule
    rows.push({ type: 'cellule-header', cellule });

    // Agents par spécialité
    Object.entries(group.specialites).forEach(([sid, sAgents]) => {
      const spec = specialitesMap[sid];
      rows.push({ type: 'specialite-header', spec, cellule_id: cellule.id });
      sAgents.forEach(ag => rows.push({ type: 'agent', ag, spec }));
    });

    // Agents sans spécialité
    group.agentsDirect.forEach(ag => rows.push({ type: 'agent', ag, spec: null }));

    // Ligne cumuls cellule
    rows.push({ type: 'cumuls', cellule });
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div className="matrix-container">
        <table className="matrix-table">
          <thead>
            <tr>
              {/* Colonnes fixes */}
              <th className="col-sticky" style={{ minWidth: 70 }}>Cellule</th>
              <th className="col-sticky col-sticky-2" style={{ minWidth: 90 }}>Nom</th>
              <th className="col-sticky col-sticky-3" style={{ minWidth: 70 }}>Prénom</th>
              <th className="col-sticky col-sticky-4" style={{ minWidth: 70, fontFamily: 'var(--font-mono)', fontSize: 10 }}>Matricule</th>

              {/* Dates */}
              {dates.map(dateStr => {
                const { isSam, isDim, isFerie, isToday, label } = getDayInfo(dateStr, feriesSet);
                let cls = 'date-header';
                if (isFerie) cls += ' ferie';
                else if (isDim) cls += ' dimanche';
                else if (isSam) cls += ' weekend';
                if (isToday) cls += ' today';
                return (
                  <th key={dateStr} className={cls} title={dateStr}>
                    {label}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, i) => {
              if (row.type === 'cellule-header') {
                return (
                  <tr key={`ch-${row.cellule.id}`} className="row-cellule-header">
                    <td colSpan={4 + dates.length}>
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: row.cellule.couleur, marginRight: 6 }} />
                      {row.cellule.nom}
                    </td>
                  </tr>
                );
              }

              if (row.type === 'specialite-header') {
                const spec = row.spec;
                return (
                  <tr key={`sh-${row.cellule_id}-${spec?.id}`}>
                    <td colSpan={4 + dates.length} style={{
                      background: spec?.couleur ? `${spec.couleur}22` : 'transparent',
                      padding: '2px 12px',
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      fontStyle: 'italic'
                    }}>
                      ↳ {spec?.nom}
                    </td>
                  </tr>
                );
              }

              if (row.type === 'cumuls') {
                const cellCumuls = cumuls[row.cellule.id] || {};
                return (
                  <tr key={`cum-${row.cellule.id}`} className="cumuls-row">
                    <td colSpan={4} style={{ textAlign: 'right', paddingRight: 8, fontStyle: 'italic' }}>Cumuls ›</td>
                    {dates.map(dateStr => {
                      const c = cellCumuls[dateStr] || {};
                      const parts = [];
                      if (c.matin) parts.push(`M${c.matin}`);
                      if (c.apres_midi) parts.push(`A${c.apres_midi}`);
                      if (c.nuit) parts.push(`N${c.nuit}`);
                      if (c.journee) parts.push(`J${c.journee}`);
                      return (
                        <td key={dateStr} title={`M:${c.matin||0} AM:${c.apres_midi||0} N:${c.nuit||0} J:${c.journee||0}`}>
                          {parts.join(' ')}
                        </td>
                      );
                    })}
                  </tr>
                );
              }

              // Type 'agent'
              const { ag } = row;
              const agent = ag.agent;

              return (
                <tr key={`ag-${agent.id}`}>
                  <td className="agent-cell col-sticky" style={{ borderLeft: row.spec ? `3px solid ${row.spec.couleur || 'transparent'}` : undefined }}>
                    —
                  </td>
                  <td className="agent-cell nom col-sticky col-sticky-2">{agent.nom}</td>
                  <td className="agent-cell prenom col-sticky col-sticky-3">{agent.prenom}</td>
                  <td className="agent-cell matricule col-sticky col-sticky-4">{agent.matricule}</td>

                  {dates.map(dateStr => {
                    const reel = ag.reel[dateStr];
                    const theorique = ag.theorique[dateStr];
                    const entry = mode === 'theorique' ? (theorique || reel) : (reel || theorique);
                    const isTheorique = !reel && !!theorique;
                    const code = codesMap[entry?.code];
                    const hasComment = !!entry?.commentaire;
                    const hasConvoc = !!ag.convocations?.[dateStr]?.length;
                    const isLocked = reel?.is_locked || false;

                    const { isSam, isDim, isFerie, isToday } = getDayInfo(dateStr, feriesSet);
                    let cellBg = code?.bg_color || 'transparent';
                    if (!code && isFerie) cellBg = 'rgba(239,68,68,0.1)';
                    else if (!code && isDim) cellBg = 'rgba(139,92,246,0.1)';
                    else if (!code && isSam) cellBg = 'rgba(99,102,241,0.1)';
                    if (isToday && !code) cellBg = 'rgba(59,130,246,0.1)';

                    let cls = 'pointage-cell';
                    if (isTheorique) cls += ' theorique';
                    if (hasComment) cls += ' has-comment';
                    if (hasConvoc) cls += ' has-convoc';

                    const title = [
                      code ? `${entry.code} — ${code.libelle}` : '',
                      isTheorique ? '(théorique)' : '',
                      isLocked ? '🔒 Verrouillé' : '',
                      hasComment ? `💬 ${entry.commentaire}` : '',
                      ...(ag.convocations?.[dateStr] || []).map(c => `📋 ${c.intitule}`)
                    ].filter(Boolean).join('\n');

                    return (
                      <td
                        key={dateStr}
                        className={cls}
                        style={{ background: cellBg, color: code?.text_color || 'inherit' }}
                        title={title}
                        onClick={() => canEdit && !isLocked && onCellClick(agent, dateStr, entry?.code, isLocked)}
                        onContextMenu={e => onCellContextMenu(e, agent, dateStr, entry?.code)}
                      >
                        <span className="code-text">
                          {entry?.code || (isFerie ? 'F' : '')}
                          {isLocked && <span style={{ fontSize: 7 }}>🔒</span>}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* LÉGENDE */}
      <Legend codesMap={codesMap} />
    </div>
  );
}

function Legend({ codesMap }) {
  return (
    <div className="legend">
      <div className="legend-item">
        <div className="legend-swatch" style={{ background: 'var(--col-sat)' }} />
        <span>Samedi</span>
      </div>
      <div className="legend-item">
        <div className="legend-swatch" style={{ background: 'var(--col-dim)' }} />
        <span>Dimanche</span>
      </div>
      <div className="legend-item">
        <div className="legend-swatch" style={{ background: 'var(--col-ferie)' }} />
        <span>Férié</span>
      </div>
      <div className="legend-item">
        <div className="legend-swatch" style={{ background: 'var(--col-today)' }} />
        <span>Aujourd'hui</span>
      </div>
      <span style={{ color: 'var(--border)', margin: '0 4px' }}>|</span>
      {Object.values(codesMap).slice(0, 10).map(code => (
        <div key={code.code} className="legend-item">
          <div className="legend-swatch" style={{ background: code.bg_color, border: '1px solid rgba(255,255,255,0.2)' }} />
          <span style={{ color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{code.code}</strong> {code.libelle}
          </span>
        </div>
      ))}
      <div className="legend-item">
        <span style={{ fontSize: 9, opacity: 0.5, fontStyle: 'italic' }}>Italique = théorique · 🔒 = verrouillé · ● = commentaire · — — = convocation</span>
      </div>
    </div>
  );
}
