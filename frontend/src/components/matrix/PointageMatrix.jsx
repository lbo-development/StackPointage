import { useMemo, useState, useEffect, useRef } from 'react';

const TODAY    = new Date().toISOString().split('T')[0];
const COL_W    = { indicator: 32, nom: 130, prenom: 100, date: 36 };
const FROZEN_W = COL_W.indicator + COL_W.nom + COL_W.prenom; // 262px
const HEAD_H1  = 24;  // ligne mois
const HEAD_H2  = 50;  // ligne dates
const ROW_H    = { 'cellule-header': 27, 'specialite-header': 22, agent: 26, cumuls: 22 };

function getDayInfo(dateStr, feriesSet) {
  const d = new Date(dateStr + 'T00:00:00');
  const dow = d.getDay();
  return {
    isSam: dow === 6, isDim: dow === 0,
    isFerie: feriesSet.has(dateStr), isToday: dateStr === TODAY,
    weekday: d.toLocaleDateString('fr-FR', { weekday: 'short' }),
    day: d.getDate(),
    month: d.toLocaleDateString('fr-FR', { month: 'short' }),
  };
}

function normalizeRange(s) {
  if (!s) return null;
  return s.startDate <= s.endDate
    ? { agentId: s.agentId, startDate: s.startDate, endDate: s.endDate }
    : { agentId: s.agentId, startDate: s.endDate,   endDate: s.startDate };
}

export default function PointageMatrix({ data, mode, canEdit, onRightClick }) {
  const { dates, cellules, specialites, agents, cumuls, feries, codesMap } = data;
  const feriesSet = useMemo(() => new Set(feries || []), [feries]);

  const [drag, setDrag]           = useState(null);
  const [selection, setSelection] = useState(null);

  const leftBodyRef    = useRef(null);
  const rightPanelRef  = useRef(null);
  const longPressTimer  = useRef(null);
  const touchStartPos   = useRef(null);
  const touchDragStart  = useRef(null);
  const dragRef         = useRef(null);

  function handleRightScroll() {
    if (leftBodyRef.current && rightPanelRef.current) {
      leftBodyRef.current.scrollTop = rightPanelRef.current.scrollTop;
    }
  }

  useEffect(() => { dragRef.current = drag; }, [drag]);

  useEffect(() => {
    function handleMouseUp() {
      if (!dragRef.current) return;
      setSelection(normalizeRange(dragRef.current));
      setDrag(null);
    }
    function preventScrollDuringDrag(e) {
      if (dragRef.current) e.preventDefault();
    }
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', preventScrollDuringDrag, { passive: false });
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', preventScrollDuringDrag);
    };
  }, []);

  const monthGroups = useMemo(() => {
    const groups = [];
    let cur = null;
    dates.forEach(d => {
      const [y, m] = d.split('-');
      const key = `${y}-${m}`;
      if (!cur || cur.key !== key) {
        cur = { key, label: new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }), count: 0 };
        groups.push(cur);
      }
      cur.count++;
    });
    return groups;
  }, [dates]);

  const grouped = useMemo(() => {
    const map = {};
    cellules.forEach(c => { map[c.id] = { cellule: c, specialites: {}, agentsDirect: [] }; });
    const sorted = [...agents].sort((a, b) => {
      if (a.ordre !== b.ordre) return a.ordre - b.ordre;
      return (a.agent.nom + a.agent.prenom).localeCompare(b.agent.nom + b.agent.prenom);
    });
    sorted.forEach(ag => {
      const cid = ag.cellule_id;
      if (!map[cid]) return;
      if (ag.specialite_id) {
        if (!map[cid].specialites[ag.specialite_id]) map[cid].specialites[ag.specialite_id] = [];
        map[cid].specialites[ag.specialite_id].push(ag);
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

  const rows = [];
  cellules.forEach(cellule => {
    const group = grouped[cellule.id];
    if (!group) return;
    rows.push({ type: 'cellule-header', cellule });
    Object.entries(group.specialites).forEach(([sid, sAgents]) => {
      rows.push({ type: 'specialite-header', spec: specialitesMap[sid], cellule_id: cellule.id });
      sAgents.forEach(ag => rows.push({ type: 'agent', ag, spec: specialitesMap[sid] }));
    });
    group.agentsDirect.forEach(ag => rows.push({ type: 'agent', ag, spec: null }));
    rows.push({ type: 'cumuls', cellule });
  });

  function isHighlighted(agentId, dateStr) {
    const s = normalizeRange(drag) || selection;
    if (!s || s.agentId !== agentId) return false;
    return dateStr >= s.startDate && dateStr <= s.endDate;
  }

  function startLongPress(ag, dateStr, isLocked, e) {
    if (!canEdit || isLocked) return;
    const touch = e.touches[0];
    touchStartPos.current  = { x: touch.clientX, y: touch.clientY };
    touchDragStart.current = { ag, dateStr };
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      touchDragStart.current = null;
      handleContextMenu({ preventDefault: () => {} }, ag, dateStr, isLocked);
    }, 600);
  }

  function cancelLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function handleTouchMove(e) {
    if (!touchStartPos.current) return;
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - touchStartPos.current.x);
    const dy = Math.abs(t.clientY - touchStartPos.current.y);
    if (dx <= 10 && dy <= 10) return;

    cancelLongPress();
    const start = touchDragStart.current;
    if (!start) return;

    if (!dragRef.current) {
      setSelection(null);
      setDrag({ agentId: start.ag.agent.id, startDate: start.dateStr, endDate: start.dateStr });
    }

    const el = document.elementFromPoint(t.clientX, t.clientY);
    const cell = el?.closest('td[data-date]');
    if (cell && cell.dataset.agentid === String(start.ag.agent.id)) {
      setDrag(prev => prev ? { ...prev, endDate: cell.dataset.date } : null);
    }
  }

  function handleTouchEnd() {
    cancelLongPress();
    touchDragStart.current = null;
    if (dragRef.current) {
      setSelection(normalizeRange(dragRef.current));
      setDrag(null);
    }
  }

  function handleContextMenu(e, ag, dateStr, isLocked) {
    e.preventDefault();
    if (!canEdit || isLocked) return;
    const agent = ag.agent;
    const sel = selection;
    if (sel && sel.agentId === agent.id && sel.startDate !== sel.endDate && dateStr >= sel.startDate && dateStr <= sel.endDate) {
      onRightClick(agent, sel.startDate, sel.endDate, '*', '');
    } else {
      const reelEntry      = ag.reel[dateStr];
      const theoriqueEntry = ag.theorique[dateStr];
      const displayCode    = reelEntry?.code || theoriqueEntry?.code || null;
      const displayComment = reelEntry?.commentaire || '';
      onRightClick(agent, dateStr, dateStr, displayCode, displayComment);
    }
  }

  const thBase = {
    background: 'var(--bg-panel)',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    fontWeight: 600,
    fontSize: 10,
    padding: '4px 6px',
  };

  // ─── Panneau gauche : divs avec hauteurs exactes ───────────────────────────
  function renderLeftRow(row) {
    const h = ROW_H[row.type];
    const base = {
      height: h, minHeight: h, maxHeight: h,
      display: 'flex', alignItems: 'center',
      flexShrink: 0, overflow: 'hidden', width: FROZEN_W,
    };

    if (row.type === 'cellule-header') {
      return (
        <div key={`L-ch-${row.cellule.id}`} style={{ ...base, background: 'var(--bg-panel)' }}>
          <div style={{ width: COL_W.indicator, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: row.cellule.couleur }} />
          </div>
          <div style={{ flex: 1, fontWeight: 700, fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', overflow: 'hidden', whiteSpace: 'nowrap', paddingRight: 6 }}>
            {row.cellule.nom}
          </div>
        </div>
      );
    }

    if (row.type === 'specialite-header') {
      const spec = row.spec;
      return (
        <div key={`L-sh-${row.cellule_id}-${spec?.id}`} style={{ ...base, background: 'var(--bg-app)' }}>
          <div style={{ width: COL_W.indicator, flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', padding: '0 4px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            ↳ {spec?.nom}
          </div>
        </div>
      );
    }

    if (row.type === 'cumuls') {
      return (
        <div key={`L-cum-${row.cellule.id}`} style={{ ...base, background: 'var(--bg-surface)', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 10, fontStyle: 'italic', color: 'var(--text-muted)', padding: '0 8px' }}>Cumuls ›</span>
        </div>
      );
    }

    // agent
    const { ag, spec } = row;
    const agent = ag.agent;
    return (
      <div key={`L-ag-${agent.id}`} style={{ ...base, background: 'var(--bg-app)' }}>
        <div style={{ width: COL_W.indicator, flexShrink: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 11, color: 'var(--text-muted)' }}>
          {spec?.couleur && (
            <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: spec.couleur }} />
          )}
          —
        </div>
        <div style={{ width: COL_W.nom, flexShrink: 0, padding: '0 0 0 10px', fontWeight: 600, fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {agent.nom}
        </div>
        <div style={{ width: COL_W.prenom, flexShrink: 0, padding: '0 0 0 10px', fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {agent.prenom}
        </div>
      </div>
    );
  }

  // ─── Panneau droit : table avec thead sticky ───────────────────────────────
  function renderRightRow(row) {
    const h = ROW_H[row.type];

    if (row.type === 'cellule-header') {
      return (
        <tr key={`R-ch-${row.cellule.id}`} style={{ height: h }}>
          {dates.map(dateStr => (
            <td key={dateStr} style={{ background: 'var(--bg-panel)', height: h, maxHeight: h }} />
          ))}
        </tr>
      );
    }

    if (row.type === 'specialite-header') {
      return (
        <tr key={`R-sh-${row.cellule_id}-${row.spec?.id}`} style={{ height: h }}>
          {dates.map(dateStr => (
            <td key={dateStr} style={{ background: 'var(--bg-app)', height: h, maxHeight: h }} />
          ))}
        </tr>
      );
    }

    if (row.type === 'cumuls') {
      const cellCumuls = cumuls[row.cellule.id] || {};
      return (
        <tr key={`R-cum-${row.cellule.id}`} style={{ height: h }}>
          {dates.map(dateStr => {
            const c = cellCumuls[dateStr] || {};
            const parts = [];
            if (c.matin)      parts.push(`M${c.matin}`);
            if (c.apres_midi) parts.push(`A${c.apres_midi}`);
            if (c.nuit)       parts.push(`N${c.nuit}`);
            if (c.journee)    parts.push(`J${c.journee}`);
            return (
              <td key={dateStr} style={{ background: 'var(--bg-surface)', fontSize: 10, textAlign: 'center', color: 'var(--text-muted)', padding: '0 2px', height: h, maxHeight: h }}
                title={`M:${c.matin||0} AM:${c.apres_midi||0} N:${c.nuit||0} J:${c.journee||0}`}>
                {parts.join(' ')}
              </td>
            );
          })}
        </tr>
      );
    }

    // agent
    const { ag } = row;
    const agent = ag.agent;
    return (
      <tr key={`R-ag-${agent.id}`} style={{ height: h }}>
        {dates.map(dateStr => {
          const reel      = ag.reel[dateStr];
          const theorique = ag.theorique[dateStr];
          const entry     = mode === 'theorique' ? (theorique || reel) : (reel || theorique);
          const isTheorique = !reel && !!theorique;
          const code      = codesMap[entry?.code];
          const hasComment = !!entry?.commentaire;
          const hasConvoc  = !!ag.convocations?.[dateStr]?.length;
          const isLocked   = reel?.is_locked || false;
          const highlighted = isHighlighted(agent.id, dateStr);

          const { isSam, isDim, isFerie, isToday } = getDayInfo(dateStr, feriesSet);
          let cellBg = code?.bg_color || 'transparent';
          if (!code && isFerie) cellBg = 'rgba(239,68,68,0.1)';
          else if (!code && isDim) cellBg = 'rgba(139,92,246,0.1)';
          else if (!code && isSam) cellBg = 'rgba(99,102,241,0.1)';
          if (isToday && !code) cellBg = 'rgba(59,130,246,0.1)';

          let cls = 'pointage-cell';
          if (isTheorique)  cls += ' theorique';
          if (hasComment)   cls += ' has-comment';
          if (hasConvoc)    cls += ' has-convoc';
          if (highlighted)  cls += ' drag-selected';

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
              style={{
                background: highlighted ? undefined : cellBg,
                color: highlighted ? undefined : (code?.text_color || 'inherit'),
                cursor: canEdit && !isLocked ? 'cell' : 'default',
                height: h, maxHeight: h,
              }}
              title={title}
              onMouseDown={e => {
                if (e.button !== 0 || !canEdit || isLocked) return;
                e.preventDefault();
                setSelection(null);
                setDrag({ agentId: agent.id, startDate: dateStr, endDate: dateStr });
              }}
              onMouseEnter={() => {
                if (drag && drag.agentId === agent.id) {
                  setDrag(prev => ({ ...prev, endDate: dateStr }));
                }
              }}
              data-date={dateStr}
              data-agentid={String(agent.id)}
              onContextMenu={e => handleContextMenu(e, ag, dateStr, isLocked)}
              onTouchStart={e => startLongPress(ag, dateStr, isLocked, e)}
              onTouchEnd={handleTouchEnd}
              onTouchMove={handleTouchMove}
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
  }

  // ─── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', userSelect: drag ? 'none' : undefined }}>

      {/* ══════════════ PANNEAU GAUCHE FIGÉ ══════════════ */}
      <div style={{
        flexShrink: 0, width: FROZEN_W,
        display: 'flex', flexDirection: 'column',
        borderRight: '2px solid var(--border-light)',
        zIndex: 1,
      }}>
        {/* En-tête — divs avec hauteurs exactes pour correspondre au thead du panneau droit */}
        <div style={{ height: HEAD_H1, flexShrink: 0, background: 'var(--bg-panel)' }} />
        <div style={{ height: HEAD_H2, flexShrink: 0, display: 'flex', alignItems: 'center', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: COL_W.indicator, flexShrink: 0 }} />
          <div style={{ width: COL_W.nom, flexShrink: 0, fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', paddingLeft: 10 }}>Nom</div>
          <div style={{ width: COL_W.prenom, flexShrink: 0, fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', paddingLeft: 10 }}>Prénom</div>
        </div>

        {/* Corps — divs pour hauteurs de lignes strictement identiques au panneau droit */}
        <div
          ref={leftBodyRef}
          className="matrix-left-body"
          style={{ overflowY: 'scroll', flex: 1, scrollbarWidth: 'none' }}
        >
          {rows.map(row => renderLeftRow(row))}
        </div>
      </div>

      {/* ══════════════ PANNEAU DROIT SCROLLABLE ══════════════ */}
      <div
        ref={rightPanelRef}
        className="matrix-scroll-panel"
        style={{ flex: 1, overflow: 'auto' }}
        onScroll={handleRightScroll}
      >
        <table style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
          <colgroup>
            {dates.map(d => <col key={d} style={{ width: COL_W.date }} />)}
          </colgroup>
          <thead>
            <tr style={{ height: HEAD_H1 }}>
              {monthGroups.map(g => (
                <th key={g.key} colSpan={g.count} style={{
                  ...thBase,
                  position: 'sticky', top: 0, zIndex: 3,
                  textAlign: 'center', textTransform: 'capitalize',
                  fontWeight: 700, fontSize: 11,
                  color: 'var(--text-primary)',
                  borderLeft: '2px solid var(--border-light)',
                  borderBottom: 'none',
                  height: HEAD_H1,
                }}>
                  {g.label}
                </th>
              ))}
            </tr>
            <tr style={{ height: HEAD_H2 }}>
              {dates.map(dateStr => {
                const { isSam, isDim, isFerie, isToday, weekday, day, month } = getDayInfo(dateStr, feriesSet);
                let cls = 'date-header';
                if (isFerie) cls += ' ferie';
                else if (isDim) cls += ' dimanche';
                else if (isSam) cls += ' weekend';
                if (isToday) cls += ' today';
                const isFirst = new Date(dateStr + 'T00:00:00').getDate() === 1;
                return (
                  <th key={dateStr} className={cls} title={dateStr} style={{
                    position: 'sticky', top: HEAD_H1, zIndex: 3,
                    height: HEAD_H2,
                    ...(isFirst ? { borderLeft: '2px solid var(--border-light)' } : {}),
                  }}>
                    <div style={{ lineHeight: 1.2 }}>
                      <div style={{ fontSize: 8, opacity: 0.65, fontFamily: 'var(--font-ui)' }}>{weekday}</div>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{day}</div>
                      <div style={{ fontSize: 8, opacity: 0.65, fontFamily: 'var(--font-ui)' }}>{month}</div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => renderRightRow(row))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
