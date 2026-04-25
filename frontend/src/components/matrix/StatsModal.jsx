// frontend/src/components/matrix/StatsModal.jsx
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';

// ─── Palette type → couleur ─────────────────────────────────────────────────
const TYPE_COLORS = {
  presence:  { bg: '#22c55e20', border: '#22c55e', text: '#16a34a', label: 'Présence' },
  absence:   { bg: '#ef444420', border: '#ef4444', text: '#dc2626', label: 'Absence'  },
  repos:     { bg: '#3b82f620', border: '#3b82f6', text: '#2563eb', label: 'Repos'    },
  conge:     { bg: '#a855f720', border: '#a855f7', text: '#9333ea', label: 'Congé'    },
  formation: { bg: '#f59e0b20', border: '#f59e0b', text: '#d97706', label: 'Formation'},
  inconnu:   { bg: '#6b728020', border: '#6b7280', text: '#4b5563', label: 'Autre'    },
};

function typeColor(type) {
  return TYPE_COLORS[type] ?? TYPE_COLORS.inconnu;
}

// ─── Mini bar chart inline ───────────────────────────────────────────────────
function BarChart({ data, total, couleurFn }) {
  if (!data.length) return <p style={styles.empty}>Aucune donnée</p>;
  const max = Math.max(...data.map(d => d.count));
  return (
    <div style={styles.barChart}>
      {data.map((d, i) => (
        <div key={i} style={styles.barRow}>
          <span style={{ ...styles.barLabel, color: couleurFn?.(d) ?? '#94a3b8' }}>
            {d.label ?? d.code ?? d.type}
          </span>
          <div style={styles.barTrack}>
            <div
              style={{
                ...styles.barFill,
                width: `${(d.count / max) * 100}%`,
                background: couleurFn?.(d) ?? '#60a5fa',
              }}
            />
          </div>
          <span style={styles.barCount}>{d.count}</span>
          <span style={styles.barPct}>{total ? `${Math.round((d.count / total) * 100)}%` : ''}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Donut chart SVG ────────────────────────────────────────────────────────
function DonutChart({ slices }) {
  if (!slices.length) return <p style={styles.empty}>Aucune donnée</p>;
  const total = slices.reduce((s, d) => s + d.count, 0);
  if (!total) return <p style={styles.empty}>Aucune donnée</p>;

  const r = 70, cx = 90, cy = 90, stroke = 28;
  let cumAngle = -Math.PI / 2;

  const arcs = slices.map(s => {
    const angle = (s.count / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(cumAngle);
    const y1 = cy + r * Math.sin(cumAngle);
    cumAngle += angle;
    const x2 = cx + r * Math.cos(cumAngle);
    const y2 = cy + r * Math.sin(cumAngle);
    return {
      ...s,
      d: `M ${x1} ${y1} A ${r} ${r} 0 ${angle > Math.PI ? 1 : 0} 1 ${x2} ${y2}`,
      pct: Math.round((s.count / total) * 100),
    };
  });

  return (
    <div style={styles.donutWrap}>
      <svg width="180" height="180" viewBox="0 0 180 180">
        {arcs.map((a, i) => (
          <path
            key={i}
            d={a.d}
            fill="none"
            stroke={a.color}
            strokeWidth={stroke}
            opacity={0.85}
          />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" style={{ fontSize: 22, fontWeight: 700, fill: '#f1f5f9' }}>
          {total}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" style={{ fontSize: 11, fill: '#94a3b8' }}>
          total
        </text>
      </svg>
      <div style={styles.donutLegend}>
        {arcs.map((a, i) => (
          <div key={i} style={styles.legendRow}>
            <span style={{ ...styles.legendDot, background: a.color }} />
            <span style={styles.legendLabel}>{a.label}</span>
            <span style={styles.legendCount}>{a.count}</span>
            <span style={styles.legendPct}>{a.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Composant principal ─────────────────────────────────────────────────────
export default function StatsModal({ isOpen, onClose, serviceId, dateDébut, dateFin, agents = [], cellules = [] }) {
  const { api } = useAuth();
  const [tab, setTab] = useState('codes');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // Filtres locaux
  const [filtCellule, setFiltCellule] = useState('');
  const [filtAgents, setFiltAgents] = useState([]);
  const [localDébut, setLocalDébut] = useState(dateDébut ?? '');
  const [localFin, setLocalFin]     = useState(dateFin   ?? '');

  // Sync si les props changent (changement de mois dans la matrice)
  useEffect(() => { if (dateDébut) setLocalDébut(dateDébut); }, [dateDébut]);
  useEffect(() => { if (dateFin)   setLocalFin(dateFin);     }, [dateFin]);

  const fetchStats = useCallback(async () => {
    if (!serviceId || !localDébut || !localFin) return;
    if (localDébut > localFin) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        service_id: serviceId,
        date_debut: localDébut,
        date_fin:   localFin,
      });
      if (filtCellule) params.set('cellule_id', filtCellule);
      if (filtAgents.length) params.set('agent_ids', filtAgents.join(','));

      const res = await api(`/api/stats?${params}`);
      setData(res);
    } catch (e) {
      setError(e.message ?? 'Erreur lors du chargement des statistiques');
    } finally {
      setLoading(false);
    }
  }, [api, serviceId, localDébut, localFin, filtCellule, filtAgents]);

  useEffect(() => {
    if (isOpen) fetchStats();
  }, [isOpen, fetchStats]);

  if (!isOpen) return null;

  // ── Données formatées ──────────────────────────────────────────────────────
  const codesData = data
    ? Object.entries(data.parCode)
        .map(([code, v]) => ({ code, label: v.libelle ?? code, count: v.count, couleur: v.couleur ?? '#60a5fa', type: v.type_code }))
        .sort((a, b) => b.count - a.count)
    : [];

  const typesData = data
    ? Object.entries(data.parType)
        .map(([type, v]) => ({ type, label: typeColor(type).label, count: v.count, color: typeColor(type).border }))
        .sort((a, b) => b.count - a.count)
    : [];

  const agentsData = data
    ? [...data.parAgent].sort((a, b) => b.total - a.total)
    : [];

  const totalPointages = data?.meta.total ?? 0;

  // ── Rendu ──────────────────────────────────────────────────────────────────
  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>

        {/* Header */}
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>📊 Statistiques de pointage</h2>
            {data && (
              <p style={styles.subtitle}>
                {data.meta.nbJours} jours · {data.meta.nbAgents} agents · {data.meta.total} pointages
              </p>
            )}
          </div>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Filtres */}
        <div style={styles.filters}>
          {/* Période modifiable */}
          <div style={styles.periodGroup}>
            <label style={styles.periodLabel}>Du</label>
            <input
              type="date"
              style={styles.dateInput}
              value={localDébut}
              max={localFin}
              onChange={e => setLocalDébut(e.target.value)}
            />
            <label style={styles.periodLabel}>au</label>
            <input
              type="date"
              style={styles.dateInput}
              value={localFin}
              min={localDébut}
              onChange={e => setLocalFin(e.target.value)}
            />
          </div>

          <select
            style={styles.select}
            value={filtCellule}
            onChange={e => setFiltCellule(e.target.value)}
          >
            <option value="">Toutes les cellules</option>
            {cellules.map(c => (
              <option key={c.id} value={c.id}>{c.nom}</option>
            ))}
          </select>

          <select
            style={styles.select}
            multiple
            value={filtAgents}
            onChange={e => setFiltAgents([...e.target.selectedOptions].map(o => o.value))}
            size={1}
          >
            {agents.map(a => (
              <option key={a.id} value={a.id}>{a.prenom} {a.nom}</option>
            ))}
          </select>

          <button style={styles.refreshBtn} onClick={fetchStats} disabled={loading}>
            {loading ? '⏳' : '🔄'} Actualiser
          </button>
        </div>

        {/* Onglets */}
        <div style={styles.tabs}>
          {[
            { key: 'codes', label: '📋 Par code' },
            { key: 'types', label: '🏷️ Par type' },
            { key: 'agents', label: '👤 Par agent' },
          ].map(t => (
            <button
              key={t.key}
              style={{ ...styles.tab, ...(tab === t.key ? styles.tabActive : {}) }}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Contenu */}
        <div style={styles.content}>
          {loading && (
            <div style={styles.loader}>
              <div style={styles.spinner} />
              <span>Chargement…</span>
            </div>
          )}

          {error && <div style={styles.errorBox}>⚠️ {error}</div>}

          {!loading && !error && data && (
            <>
              {/* ── Onglet codes ── */}
              {tab === 'codes' && (
                <div>
                  <h3 style={styles.sectionTitle}>Nombre de jours par code de pointage</h3>
                  <BarChart
                    data={codesData}
                    total={totalPointages}
                    couleurFn={d => d.couleur}
                  />
                </div>
              )}

              {/* ── Onglet types ── */}
              {tab === 'types' && (
                <div>
                  <h3 style={styles.sectionTitle}>Répartition par type de code</h3>
                  <DonutChart slices={typesData} />

                  <div style={styles.typeCards}>
                    {typesData.map(t => {
                      const col = typeColor(t.type);
                      return (
                        <div key={t.type} style={{ ...styles.typeCard, borderColor: col.border, background: col.bg }}>
                          <span style={{ ...styles.typeLabel, color: col.text }}>{col.label}</span>
                          <span style={{ ...styles.typeCount, color: col.text }}>{t.count}</span>
                          <span style={styles.typePct}>
                            {totalPointages ? `${Math.round((t.count / totalPointages) * 100)}%` : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Onglet agents ── */}
              {tab === 'agents' && (
                <div>
                  <h3 style={styles.sectionTitle}>Détail par agent</h3>
                  <div style={styles.agentTable}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Agent</th>
                          <th style={styles.th}>Matricule</th>
                          <th style={styles.th}>Total</th>
                          {codesData.slice(0, 8).map(c => (
                            <th key={c.code} style={{ ...styles.th, color: c.couleur }}>{c.code}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {agentsData.map(a => (
                          <tr key={a.agent_id} style={styles.tr}>
                            <td style={styles.td}>{a.prenom} {a.nom}</td>
                            <td style={{ ...styles.td, color: '#94a3b8' }}>{a.matricule}</td>
                            <td style={{ ...styles.td, fontWeight: 600 }}>{a.total}</td>
                            {codesData.slice(0, 8).map(c => (
                              <td key={c.code} style={{ ...styles.td, color: c.couleur }}>
                                {a.parCode[c.code] ?? '—'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {!loading && !error && !data && (
            <p style={styles.empty}>Aucune donnée à afficher.</p>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: '16px',
  },
  modal: {
    background: '#0f172a', border: '1px solid #1e293b',
    borderRadius: '16px', width: '100%', maxWidth: '860px',
    maxHeight: '90vh', display: 'flex', flexDirection: 'column',
    boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
    fontFamily: "'IBM Plex Sans', sans-serif",
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '20px 24px 12px', borderBottom: '1px solid #1e293b',
  },
  title: { margin: 0, fontSize: '18px', fontWeight: 700, color: '#f1f5f9' },
  subtitle: { margin: '4px 0 0', fontSize: '12px', color: '#64748b' },
  closeBtn: {
    background: 'none', border: 'none', color: '#64748b',
    fontSize: '18px', cursor: 'pointer', padding: '4px 8px',
    borderRadius: '6px', lineHeight: 1,
  },
  filters: {
    display: 'flex', gap: '8px', padding: '12px 24px',
    borderBottom: '1px solid #1e293b', flexWrap: 'wrap', alignItems: 'center',
  },
  periodGroup: {
    display: 'flex', alignItems: 'center', gap: '6px',
    background: '#1e293b', borderRadius: '8px', padding: '4px 10px',
    border: '1px solid #334155',
  },
  periodLabel: { fontSize: '12px', color: '#64748b', userSelect: 'none' },
  dateInput: {
    background: 'transparent', border: 'none', color: '#cbd5e1',
    fontSize: '13px', outline: 'none', cursor: 'pointer',
    colorScheme: 'dark',
  },
  select: {
    background: '#1e293b', border: '1px solid #334155',
    color: '#cbd5e1', borderRadius: '8px',
    padding: '6px 10px', fontSize: '13px', flex: 1, minWidth: '150px',
  },
  refreshBtn: {
    background: '#1e40af', border: 'none', color: '#fff',
    borderRadius: '8px', padding: '6px 14px', fontSize: '13px',
    cursor: 'pointer', whiteSpace: 'nowrap',
  },
  tabs: {
    display: 'flex', gap: '4px', padding: '12px 24px 0',
    borderBottom: '1px solid #1e293b',
  },
  tab: {
    background: 'none', border: 'none', color: '#64748b',
    padding: '8px 16px', fontSize: '13px', cursor: 'pointer',
    borderRadius: '8px 8px 0 0', fontWeight: 500,
    borderBottom: '2px solid transparent',
  },
  tabActive: {
    color: '#60a5fa', borderBottom: '2px solid #60a5fa',
    background: '#60a5fa10',
  },
  content: {
    padding: '20px 24px', overflowY: 'auto', flex: 1,
  },
  sectionTitle: { margin: '0 0 16px', fontSize: '14px', color: '#94a3b8', fontWeight: 600 },
  loader: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: '12px', padding: '40px', color: '#64748b',
  },
  spinner: {
    width: '32px', height: '32px', border: '3px solid #1e293b',
    borderTop: '3px solid #60a5fa', borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  errorBox: {
    background: '#450a0a', border: '1px solid #7f1d1d',
    color: '#fca5a5', borderRadius: '8px', padding: '12px 16px', fontSize: '13px',
  },
  empty: { color: '#475569', textAlign: 'center', padding: '32px', fontSize: '14px' },

  // Bar chart
  barChart: { display: 'flex', flexDirection: 'column', gap: '8px' },
  barRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  barLabel: { width: '60px', fontSize: '12px', fontWeight: 600, textAlign: 'right', flexShrink: 0 },
  barTrack: { flex: 1, height: '10px', background: '#1e293b', borderRadius: '99px', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: '99px', transition: 'width 0.4s ease' },
  barCount: { width: '36px', textAlign: 'right', fontSize: '12px', color: '#e2e8f0', fontWeight: 600 },
  barPct: { width: '36px', textAlign: 'right', fontSize: '11px', color: '#475569' },

  // Donut
  donutWrap: { display: 'flex', alignItems: 'center', gap: '32px', flexWrap: 'wrap', marginBottom: '20px' },
  donutLegend: { display: 'flex', flexDirection: 'column', gap: '8px' },
  legendRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  legendDot: { width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0 },
  legendLabel: { fontSize: '13px', color: '#cbd5e1', flex: 1 },
  legendCount: { fontSize: '13px', color: '#f1f5f9', fontWeight: 600, minWidth: '32px', textAlign: 'right' },
  legendPct: { fontSize: '11px', color: '#64748b', minWidth: '36px', textAlign: 'right' },

  // Type cards
  typeCards: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '8px' },
  typeCard: {
    border: '1px solid', borderRadius: '10px', padding: '12px 16px',
    display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '100px',
  },
  typeLabel: { fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' },
  typeCount: { fontSize: '24px', fontWeight: 700 },
  typePct: { fontSize: '12px', color: '#64748b' },

  // Table
  agentTable: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: {
    padding: '8px 12px', textAlign: 'left', background: '#1e293b',
    color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap',
    borderBottom: '1px solid #334155',
  },
  td: { padding: '8px 12px', color: '#cbd5e1', borderBottom: '1px solid #1e293b' },
  tr: { transition: 'background 0.15s' },
};
