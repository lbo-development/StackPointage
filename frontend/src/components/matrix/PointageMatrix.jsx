import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';

const TODAY    = new Date().toISOString().split('T')[0];
const _vw      = window.innerWidth;
const COL_W    = {
  indicator: 32,
  nom:    _vw < 1100 ? 105 : 130,
  prenom: _vw < 1100 ?  75 : 100,
  date:   36,
};
const FROZEN_W = COL_W.indicator + COL_W.nom + COL_W.prenom;
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

export default function PointageMatrix({ data, mode, canEdit, onRightClick, serviceId, dateDebut, dateFin }) {
  const { dates, cellules, specialites, agents, cumuls, feries, codesMap } = data;
  const feriesSet = useMemo(() => new Set(feries || []), [feries]);

  const [drag, setDrag]           = useState(null);
  const [selection, setSelection] = useState(null);
  const [statsModal, setStatsModal] = useState(null); // { cellule }
  const [spacerH, setSpacerH]     = useState(0);

  const leftBodyRef    = useRef(null);
  const rightHeaderRef = useRef(null);
  const rightBodyRef   = useRef(null);
  const longPressTimer  = useRef(null);
  const touchStartPos   = useRef(null);
  const touchDragStart  = useRef(null);
  const dragRef         = useRef(null);

  function handleRightScroll() {
    if (leftBodyRef.current && rightBodyRef.current) {
      leftBodyRef.current.scrollTop = rightBodyRef.current.scrollTop;
    }
    if (rightHeaderRef.current && rightBodyRef.current) {
      rightHeaderRef.current.scrollLeft = rightBodyRef.current.scrollLeft;
    }
  }

  useEffect(() => { dragRef.current = drag; }, [drag]);

  useEffect(() => {
    if (!rightBodyRef.current) return;
    const ro = new ResizeObserver(([e]) => setSpacerH(e.contentRect.height));
    ro.observe(rightBodyRef.current);
    return () => ro.disconnect();
  }, []);

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
          <div style={{ flex: 1, fontWeight: 700, fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', overflow: 'hidden', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4, paddingRight: 4 }}>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.cellule.nom}</span>
            <button
              title="Statistiques de la cellule"
              onClick={e => { e.stopPropagation(); setStatsModal(row.cellule); }}
              style={{
                flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
                padding: '1px 3px', borderRadius: 3, color: '#8dc63f',
                display: 'flex', alignItems: 'center',
                lineHeight: 1, opacity: 0.75,
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'rgba(141,198,63,0.12)'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '0.75'; e.currentTarget.style.background = 'none'; }}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
                <rect x="0" y="7" width="3" height="6" rx="1" />
                <rect x="5" y="4" width="3" height="9" rx="1" />
                <rect x="10" y="1" width="3" height="12" rx="1" />
              </svg>
            </button>
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
      <div key={`L-ag-${agent.id}`} style={{ ...base, background: 'var(--bg-app)', boxShadow: 'inset 0 -1px 0 var(--border-grid)' }}>
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
  return (<>
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minWidth: 0, userSelect: drag ? 'none' : undefined }}>

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
          <div style={{ height: spacerH, flexShrink: 0 }} />
        </div>
      </div>

      {/* ══════════════ PANNEAU DROIT ══════════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* En-tête figé — même table/colgroup que le corps pour alignement pixel-perfect */}
        <div ref={rightHeaderRef} style={{ flexShrink: 0, overflowX: 'hidden' }}>
          <table style={{ tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0, width: dates.length * COL_W.date }}>
            <colgroup>
              {dates.map(d => <col key={d} style={{ width: COL_W.date }} />)}
            </colgroup>
            <thead>
              <tr style={{ height: HEAD_H1 }}>
                {monthGroups.map((g, i) => (
                  <th key={g.key} colSpan={g.count} style={{
                    background: 'var(--bg-panel)',
                    borderBottom: '1px solid var(--border)',
                    borderLeft: i === 0 ? 'none' : '2px solid var(--border-light)',
                    color: 'var(--text-primary)', fontWeight: 700, fontSize: 11,
                    textAlign: 'center', textTransform: 'capitalize',
                    padding: 0, height: HEAD_H1,
                  }}>
                    {g.label}
                  </th>
                ))}
              </tr>
              <tr style={{ height: HEAD_H2 }}>
                {dates.map(dateStr => {
                  const { isSam, isDim, isFerie, isToday, weekday, day, month } = getDayInfo(dateStr, feriesSet);
                  const isFirst = new Date(dateStr + 'T00:00:00').getDate() === 1;
                  let cls = 'date-header';
                  if (isFerie) cls += ' ferie';
                  else if (isDim) cls += ' dimanche';
                  else if (isSam) cls += ' weekend';
                  if (isToday) cls += ' today';
                  return (
                    <th key={dateStr} className={cls} title={dateStr} style={{
                      height: HEAD_H2,
                      padding: 0,
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
          </table>
        </div>

        {/* Corps scrollable */}
        <div
          ref={rightBodyRef}
          className="matrix-scroll-panel"
          style={{ flex: 1, minHeight: 0, overflowX: 'scroll', overflowY: 'auto' }}
          onScroll={handleRightScroll}
          onClick={e => { if (!e.target.closest('.pointage-cell')) setSelection(null); }}
        >
          <table style={{ tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0, width: dates.length * COL_W.date }}>
            <colgroup>
              {dates.map(d => <col key={d} style={{ width: COL_W.date }} />)}
            </colgroup>
            <tbody>
              {rows.map(row => renderRightRow(row))}
              <tr aria-hidden="true">
                <td colSpan={dates.length} style={{ height: spacerH, padding: 0, border: 'none' }} />
              </tr>
            </tbody>
          </table>
        </div>

      </div>

    </div>

    {statsModal && (
      <StatsModal
        cellule={statsModal}
        agents={agents}
        serviceId={serviceId}
        dateDebut={dateDebut}
        dateFin={dateFin}
        onClose={() => setStatsModal(null)}
      />
    )}
  </>);
}

// ─── Donut chart ─────────────────────────────────────────────────────────────
function PieChart({ slices }) {
  const total = slices.reduce((s, d) => s + d.count, 0);
  if (!total) return <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Aucun code sur cette période</div>;

  const r = 58, cx = 75, cy = 75, sw = 26;
  let angle = -Math.PI / 2;

  const arcs = slices.map(s => {
    const a = (s.count / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += a;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    return { ...s, path: `M ${x1} ${y1} A ${r} ${r} 0 ${a > Math.PI ? 1 : 0} 1 ${x2} ${y2}`, pct: Math.round((s.count / total) * 100) };
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      <svg width="150" height="150" viewBox="0 0 150 150" style={{ flexShrink: 0 }}>
        {arcs.map((a, i) => (
          <path key={i} d={a.path} fill="none" stroke={a.color} strokeWidth={sw} opacity={0.9} />
        ))}
        <text x={cx} y={cy - 5} textAnchor="middle" style={{ fontSize: 20, fontWeight: 700, fill: '#f1f5f9' }}>{total}</text>
        <text x={cx} y={cy + 13} textAnchor="middle" style={{ fontSize: 10, fill: '#64748b' }}>entrées</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {arcs.map((a, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: a.color, flexShrink: 0, display: 'inline-block' }} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1, minWidth: 70 }}>{a.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', minWidth: 28, textAlign: 'right' }}>{a.count}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 36, textAlign: 'right' }}>{a.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Modale statistiques d'une cellule ─────────────────────────────────────────
const TYPE_COLORS = {
  'Présence':       '#22c55e',
  'Repos':          '#3b82f6',
  'Congé':          '#a855f7',
  'Maladie':        '#ef4444',
  'Absence':        '#f97316',
  'Autre absence':  '#64748b',
  'Autre présence': '#10b981',
  'Autre':          '#94a3b8',
};

function StatsModal({ cellule, agents, serviceId, dateDebut, dateFin, onClose }) {
  const { api } = useAuth();
  const celluleAgents = agents.filter(ag => ag.cellule_id === cellule.id);

  const [filtAgent, setFiltAgent] = useState('');
  const [filtDébut, setFiltDébut] = useState(dateDebut ?? '');
  const [filtFin,   setFiltFin]   = useState(dateFin   ?? '');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [statsData, setStatsData] = useState(null);

  const fetchStats = useCallback(async () => {
    if (!serviceId || !filtDébut || !filtFin) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        service_id: serviceId,
        date_debut: filtDébut,
        date_fin:   filtFin,
        cellule_id: cellule.id,
      });
      if (filtAgent) params.set('agent_ids', filtAgent);
      const res = await api.get(`/stats?${params}`);
      setStatsData(res);
    } catch (e) {
      setError(e.message ?? 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [api, serviceId, filtDébut, filtFin, cellule.id, filtAgent]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const fmtDate = d => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

  const totalEntries = statsData?.meta.total ?? 0;

  const allCodes = statsData
    ? Object.entries(statsData.parCode)
        .map(([code, v]) => ({ code, count: v.count, couleur: v.couleur, libelle: v.libelle }))
        .sort((a, b) => b.count - a.count)
    : [];
  const maxCodeCount = allCodes[0]?.count || 1;

  const typeConfig = statsData
    ? Object.entries(statsData.parType)
        .filter(([, v]) => v.count > 0)
        .map(([type, v]) => ({
          key:   type,
          label: type,
          color: TYPE_COLORS[type] ?? '#94a3b8',
          count: v.count,
        }))
        .sort((a, b) => b.count - a.count)
    : [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 500, width: '95vw' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: cellule.couleur, flexShrink: 0 }} />
            Statistiques — {cellule.nom}
          </span>
          <button className="btn btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Filtres */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              value={filtAgent}
              onChange={e => setFiltAgent(e.target.value)}
              style={{
                flex: 1, minWidth: 160,
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', borderRadius: 6,
                padding: '5px 8px', fontSize: 12, cursor: 'pointer',
              }}
            >
              <option value="">Tous les agents ({celluleAgents.length})</option>
              {celluleAgents.map(ag => (
                <option key={ag.agent.id} value={String(ag.agent.id)}>
                  {ag.agent.prenom} {ag.agent.nom}
                </option>
              ))}
            </select>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '4px 8px',
            }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', userSelect: 'none' }}>Du</span>
              <input
                type="date"
                value={filtDébut}
                max={filtFin || undefined}
                onChange={e => setFiltDébut(e.target.value)}
                style={{
                  background: 'transparent', border: 'none', outline: 'none',
                  color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer',
                  colorScheme: 'dark',
                }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', userSelect: 'none' }}>au</span>
              <input
                type="date"
                value={filtFin}
                min={filtDébut || undefined}
                onChange={e => setFiltFin(e.target.value)}
                style={{
                  background: 'transparent', border: 'none', outline: 'none',
                  color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer',
                  colorScheme: 'dark',
                }}
              />
            </div>
          </div>

          {/* État chargement / erreur */}
          {loading && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: '8px 0' }}>
              Chargement…
            </div>
          )}
          {error && (
            <div style={{ fontSize: 12, color: '#f87171', background: '#450a0a', borderRadius: 6, padding: '8px 12px' }}>
              ⚠️ {error}
            </div>
          )}

          {!loading && !error && statsData && (
            <>
              {/* Résumé */}
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.8 }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 18 }}>{statsData.meta.nbAgents}</span>
                <span> agent{statsData.meta.nbAgents > 1 ? 's' : ''} &nbsp;·&nbsp; </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{fmtDate(filtDébut)} → {fmtDate(filtFin)}</span>
                <span> &nbsp;·&nbsp; </span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{totalEntries}</span>
                <span> entrées</span>
              </div>

              {/* Répartition par type */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                  Répartition par type
                </div>
                <PieChart slices={typeConfig} />
              </div>

              {/* Top codes */}
              {allCodes.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                    Codes de pointage
                  </div>
                  <div style={{ maxHeight: 125, overflowY: 'auto', paddingRight: 8 }}>
                  {allCodes.map(({ code, count, couleur, libelle }) => (
                    <div key={code} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                      <div style={{
                        width: 32, height: 20, borderRadius: 3, flexShrink: 0,
                        background: couleur || 'var(--bg-surface)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)',
                        color: '#000',
                      }}>
                        {code}
                      </div>
                      <div style={{ width: 110, fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flexShrink: 0 }}>
                        {libelle || '—'}
                      </div>
                      <div style={{ flex: 1, height: 10, background: 'var(--bg-surface)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(count / maxCodeCount) * 100}%`, background: couleur || 'var(--border)', borderRadius: 3 }} />
                      </div>
                      <div style={{ width: 32, fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', textAlign: 'right', flexShrink: 0 }}>{count}</div>
                    </div>
                  ))}
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}
