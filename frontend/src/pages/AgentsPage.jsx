import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import OrdreAgentsModal from '../components/matrix/OrdreAgentsModal.jsx';

export default function AgentsPage() {
  const { api, can } = useAuth();
  const { selectedService } = useOutletContext();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editAgent, setEditAgent] = useState(null);
  const [search, setSearch] = useState('');
  const [ordreModal, setOrdreModal] = useState(null); // { cellule, agents[] }

  function load() {
    if (!api) return;
    setLoading(true);
    const sid = selectedService?.id || '';
    api.get(`/agents?service_id=${sid}`)
      .then(setAgents)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(load, [api, selectedService]);

  const filtered = agents.filter(a =>
    !search || `${a.agents?.nom} ${a.agents?.prenom} ${a.agents?.matricule}`
      .toLowerCase().includes(search.toLowerCase())
  );

  // Grouper par cellule pour afficher les boutons "Ordre" par cellule
  const parCellule = useMemo(() => {
    const map = {};
    agents.forEach(a => {
      const cid = a.cellule_id;
      if (!map[cid]) map[cid] = { cellule: a.cellules, agents: [] };
      map[cid].agents.push(a);
    });
    return map;
  }, [agents]);

  return (
    <div className="page-wrapper">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="page-title">Agents {selectedService ? `— ${selectedService.nom}` : ''}</h1>
        {can('edit_agents') && (
          <button className="btn btn-primary" onClick={() => { setEditAgent(null); setShowModal(true); }}>
            + Nouvel agent
          </button>
        )}
      </div>

      <div className="toolbar" style={{ marginBottom: 12 }}>
        <input
          placeholder="Rechercher nom, prénom, matricule…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 280 }}
        />
        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{filtered.length} agent(s)</span>

        {/* Boutons ordre par cellule */}
        {can('edit_agents') && Object.values(parCellule).map(({ cellule, agents: ca }) => (
          cellule && (
            <button
              key={cellule.id}
              className="btn btn-sm"
              onClick={() => setOrdreModal({ cellule, agents: ca })}
              title={`Réordonner les agents de ${cellule.nom}`}
              style={{ display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: cellule.couleur }} />
              ⇅ {cellule.nom}
            </button>
          )
        ))}
      </div>

      {loading
        ? <div className="loading-overlay"><div className="loading-spinner" /></div>
        : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 36, textAlign: 'center' }}>#</th>
                <th>Matricule</th>
                <th>Nom</th>
                <th>Prénom</th>
                <th>Cellule</th>
                <th>Spécialité</th>
                <th>Roulement</th>
                <th>Depuis</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id}>
                  {/* Numéro d'ordre dans la cellule */}
                  <td style={{
                    textAlign: 'center',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--text-muted)'
                  }}>
                    {a.ordre + 1}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{a.agents?.matricule}</td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{a.agents?.nom}</td>
                  <td>{a.agents?.prenom}</td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.cellules?.couleur }} />
                      {a.cellules?.nom}
                    </span>
                  </td>
                  <td>{a.specialites?.nom || '—'}</td>
                  <td>{a.roulements?.nom || '—'}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{a.date_debut}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    {can('edit_agents') && (
                      <button className="btn btn-sm" onClick={() => { setEditAgent(a); setShowModal(true); }}>
                        Éditer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }

      {/* Modal édition agent */}
      {showModal && (
        <AgentModal
          agent={editAgent}
          serviceId={selectedService?.id}
          api={api}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}

      {/* Modal réordonnancement */}
      {ordreModal && (
        <OrdreAgentsModal
          cellule={ordreModal.cellule}
          agents={ordreModal.agents}
          api={api}
          onClose={() => setOrdreModal(null)}
          onSaved={() => { setOrdreModal(null); load(); }}
        />
      )}
    </div>
  );
}

function AgentModal({ agent, serviceId, api, onClose, onSaved }) {
  const [nom, setNom] = useState(agent?.agents?.nom || '');
  const [prenom, setPrenom] = useState(agent?.agents?.prenom || '');
  const [matricule, setMatricule] = useState(agent?.agents?.matricule || '');
  const [email, setEmail] = useState(agent?.agents?.email || '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!nom || !matricule) return;
    setSaving(true);
    try {
      if (agent) {
        await api.put(`/agents/${agent.agent_id}`, { nom, prenom, matricule, email });
      } else {
        await api.post('/agents', {
          nom, prenom, matricule, email,
          assignment: serviceId
            ? { service_id: serviceId, cellule_id: null, date_debut: new Date().toISOString().split('T')[0] }
            : undefined
        });
      }
      onSaved();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{agent ? 'Modifier agent' : 'Nouvel agent'}</span>
          <button className="btn btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>Nom *</label>
              <input value={nom} onChange={e => setNom(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Prénom</label>
              <input value={prenom} onChange={e => setPrenom(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Matricule *</label>
            <input value={matricule} onChange={e => setMatricule(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Annuler</button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!nom || !matricule || saving}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
