import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function PrevisionsPage() {
  const { api, profile } = useAuth();
  const { selectedService } = useOutletContext();
  const [agents, setAgents] = useState([]);
  const [codes, setCodes] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [dateDebut, setDateDebut] = useState(() => new Date().toISOString().split('T')[0]);
  const [dateFin, setDateFin] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [code, setCode] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState('');
  const [previsions, setPrevisions] = useState([]);

  const sid = selectedService?.id || profile?.service_id || '';

  useEffect(() => {
    if (!api || !sid) return;
    api.get(`/agents?service_id=${sid}`).then(setAgents).catch(console.error);
    api.get(`/codes?service_id=${sid}`).then(setCodes).catch(console.error);
  }, [api, sid]);

  useEffect(() => {
    if (!api || !selectedAgent) return;
    api.get(`/previsions?agent_id=${selectedAgent}&date_debut=${dateDebut}&date_fin=${dateFin}`)
      .then(setPrevisions).catch(console.error);
  }, [api, selectedAgent, dateDebut, dateFin]);

  async function handleSave() {
    if (!selectedAgent || !code || !dateDebut || !dateFin) return;
    setSaving(true);
    setResult('');
    try {
      const dates = [];
      let cur = new Date(dateDebut);
      const end = new Date(dateFin);
      while (cur <= end) {
        dates.push(cur.toISOString().split('T')[0]);
        cur.setDate(cur.getDate() + 1);
      }
      const agent = agents.find(a => a.agent_id === selectedAgent);
      let count = 0;
      for (const date of dates) {
        try {
          await api.post('/previsions', {
            agent_id: selectedAgent,
            date,
            code_pointage: code,
            commentaire,
            service_id: sid,
            cellule_id: agent?.cellule_id
          });
          count++;
        } catch (e) {
          // Ignorer les verrouillés
          if (!e.message.includes('verrouill')) throw e;
        }
      }
      setResult(`✓ ${count} prévision(s) enregistrée(s)`);
      // Recharger
      api.get(`/previsions?agent_id=${selectedAgent}&date_debut=${dateDebut}&date_fin=${dateFin}`)
        .then(setPrevisions);
    } catch (err) {
      setResult('Erreur: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  const codeInfo = codes.find(c => c.code === code);

  return (
    <div className="page-wrapper">
      <h1 className="page-title">Prévisions / Absences planifiées</h1>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {/* Formulaire saisie */}
        <div style={{ flex: '0 0 420px', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 6, padding: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
            Les prévisions alimentent la colonne <strong style={{ color: 'var(--text-primary)' }}>théorique</strong> de la matrice.
            Le réel reste prioritaire si saisi. Les prévisions <strong style={{ color: 'var(--text-primary)' }}>verrouillées</strong> ne sont pas écrasées.
          </div>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label>Agent *</label>
            <select value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)} style={{ width: '100%' }}>
              <option value="">— Choisir un agent —</option>
              {agents.map(a => (
                <option key={a.agent_id} value={a.agent_id}>
                  {a.agents?.nom} {a.agents?.prenom} — {a.agents?.matricule}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row" style={{ marginBottom: 12 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Du *</label>
              <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Au *</label>
              <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label>Code de pointage *</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
              {codes.map(c => (
                <button
                  key={c.code}
                  className={`btn btn-sm ${code === c.code ? 'btn-primary' : ''}`}
                  style={{
                    background: code === c.code ? undefined : c.bg_color,
                    color: code === c.code ? undefined : c.text_color,
                    borderColor: code === c.code ? undefined : 'transparent',
                    minWidth: 48,
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700
                  }}
                  onClick={() => setCode(c.code)}
                  title={c.libelle}
                >
                  {c.code}
                </button>
              ))}
            </div>
            {codeInfo && (
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                {codeInfo.libelle} · {codeInfo.type}
              </div>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label>Commentaire</label>
            <textarea
              value={commentaire}
              onChange={e => setCommentaire(e.target.value)}
              rows={2}
              placeholder="Motif, précisions…"
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          {result && (
            <div className={`alert ${result.startsWith('✓') ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 12 }}>
              {result}
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!selectedAgent || !code || !dateDebut || !dateFin || saving}
            style={{ width: '100%', justifyContent: 'center', padding: 8 }}
          >
            {saving ? <><span className="loading-spinner" style={{ width: 12, height: 12 }} /> Enregistrement…</> : 'Enregistrer les prévisions'}
          </button>
        </div>

        {/* Liste des prévisions existantes */}
        {selectedAgent && previsions.length > 0 && (
          <div style={{ flex: 1, minWidth: 300 }}>
            <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13 }}>
              Prévisions existantes ({previsions.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 400, overflowY: 'auto' }}>
              {previsions.sort((a, b) => a.date.localeCompare(b.date)).map(p => {
                const ci = codes.find(c => c.code === p.code_pointage);
                return (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '5px 10px', background: 'var(--bg-panel)',
                    border: '1px solid var(--border)', borderRadius: 4
                  }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', minWidth: 80 }}>{p.date}</span>
                    <span className="code-badge" style={{ background: ci?.bg_color, color: ci?.text_color }}>
                      {p.code_pointage}
                    </span>
                    {p.commentaire && (
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.commentaire}
                      </span>
                    )}
                    {p.is_locked && <span style={{ fontSize: 10, color: 'var(--warning)' }}>🔒</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
