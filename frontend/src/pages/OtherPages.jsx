// ============ PrevisionsPage.jsx ============
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
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState('');

  const sid = selectedService?.id || profile?.service_id || '';

  useEffect(() => {
    if (!api || !sid) return;
    api.get(`/agents?service_id=${sid}`).then(setAgents).catch(console.error);
    api.get(`/codes?service_id=${sid}`).then(setCodes).catch(console.error);
  }, [api, sid]);

  async function handleSave() {
    if (!selectedAgent || !code || !dateDebut || !dateFin) return;
    setSaving(true);
    try {
      // Saisie jour par jour
      const dates = [];
      let cur = new Date(dateDebut);
      const end = new Date(dateFin);
      while (cur <= end) { dates.push(cur.toISOString().split('T')[0]); cur.setDate(cur.getDate() + 1); }

      const agent = agents.find(a => a.agent_id === selectedAgent);
      for (const date of dates) {
        await api.post('/previsions', {
          agent_id: selectedAgent,
          date, code_pointage: code,
          service_id: sid,
          cellule_id: agent?.cellule_id
        });
      }
      setResult(`✓ ${dates.length} prévision(s) enregistrée(s)`);
    } catch (err) { setResult('Erreur: ' + err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="page-wrapper">
      <h1 className="page-title">Prévisions / Absences planifiées</h1>
      <div style={{ maxWidth: 480, background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 6, padding: 20 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
          Les prévisions alimentent le théorique. Le réel reste prioritaire si saisi.
        </div>
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label>Agent *</label>
          <select value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)} style={{ width: '100%' }}>
            <option value="">— Choisir —</option>
            {agents.map(a => <option key={a.agent_id} value={a.agent_id}>{a.agents?.nom} {a.agents?.prenom}</option>)}
          </select>
        </div>
        <div className="form-row" style={{ marginBottom: 12 }}>
          <div className="form-group" style={{ flex: 1 }}><label>Du</label><input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} /></div>
          <div className="form-group" style={{ flex: 1 }}><label>Au</label><input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} /></div>
        </div>
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label>Code *</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {codes.map(c => (
              <button key={c.code} className={`btn btn-sm ${code === c.code ? 'btn-primary' : ''}`}
                style={{ background: code === c.code ? undefined : c.bg_color, color: code === c.code ? undefined : c.text_color, borderColor: 'transparent' }}
                onClick={() => setCode(c.code)} title={c.libelle}>{c.code}</button>
            ))}
          </div>
        </div>
        {result && <div className={`alert ${result.startsWith('✓') ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 12 }}>{result}</div>}
        <button className="btn btn-primary" onClick={handleSave} disabled={!selectedAgent || !code || saving} style={{ width: '100%', justifyContent: 'center' }}>
          {saving ? 'Enregistrement…' : 'Enregistrer les prévisions'}
        </button>
      </div>
    </div>
  );
}


// ============ MonEspacePage.jsx ============
import { useAuth as useAuth2 } from '../context/AuthContext.jsx';

export function MonEspacePage() {
  const { api, profile } = useAuth2();
  const [pointages, setPointages] = useState([]);
  const [convocations, setConvocations] = useState([]);

  useEffect(() => {
    if (!api || !profile) return;
    if (profile.role === 'agent') {
      // Un agent ne voit que ses propres données via son agent_id
      api.get(`/convocations?agent_id=${profile.id}`).then(setConvocations).catch(console.error);
    }
  }, [api, profile]);

  const ROLE_LABELS = {
    admin_app: 'Administrateur applicatif', admin_service: 'Administrateur de service',
    pointeur: 'Pointeur', assistant_rh: 'Assistant RH', agent: 'Agent'
  };

  return (
    <div className="page-wrapper">
      <h1 className="page-title">Mon Espace</h1>
      <div style={{ maxWidth: 480 }}>
        <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 6, padding: 20, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{profile?.prenom} {profile?.nom}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{profile?.email}</div>
          <div style={{ marginTop: 10 }}>
            <span className="badge badge-blue">{ROLE_LABELS[profile?.role] || profile?.role}</span>
          </div>
        </div>

        {convocations.length > 0 && (
          <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 6, padding: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>Mes convocations</div>
            {convocations.map(c => (
              <div key={c.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                <div style={{ fontWeight: 600 }}>{c.intitule}</div>
                <div style={{ color: 'var(--text-muted)' }}>{c.date} · {c.type}</div>
                {c.commentaire && <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>{c.commentaire}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MonEspacePage;
