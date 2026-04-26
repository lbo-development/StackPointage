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
