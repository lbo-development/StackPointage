import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { fmtDate } from '../utils/date.js';

export default function ExportCataloguePage() {
  const { api, isAdmin, isAdminService } = useAuth();
  const [entries, setEntries]       = useState([]);
  const [showModal, setShowModal]   = useState(false);
  const [editEntry, setEditEntry]   = useState(null);
  const [downloading, setDownloading] = useState(null);

  function load() {
    if (!api) return;
    api.get('/export-catalogue').then(setEntries).catch(console.error);
  }

  useEffect(load, [api]);

  async function handleDelete(id) {
    if (!confirm('Supprimer cet état ?')) return;
    await api.delete(`/export-catalogue/${id}`);
    load();
  }

  async function handleDownload(entry) {
    setDownloading(entry.id);
    try {
      const params = {
        service_id:  entry.service_id,
        date_debut:  entry.date_debut,
        date_fin:    entry.date_fin,
      };
      if (entry.cellule_id)    params.cellule_id    = entry.cellule_id;
      if (entry.template_path) params.template_path = entry.template_path;
      await api.downloadExcel(params);
    } catch (err) {
      alert('Export échoué : ' + err.message);
    } finally {
      setDownloading(null);
    }
  }

  const canEdit = isAdmin || isAdminService;

  return (
    <div className="page-wrapper">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="page-title">Catalogue d'exports</h1>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => { setEditEntry(null); setShowModal(true); }}>
            + Nouvel état
          </button>
        )}
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Nom</th>
            <th>Service</th>
            <th>Cellule</th>
            <th>Date début</th>
            <th>Date fin</th>
            <th>Template</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 && (
            <tr>
              <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
                Aucun état configuré
              </td>
            </tr>
          )}
          {entries.map(e => (
            <tr key={e.id}>
              <td style={{ fontWeight: 500 }}>{e.nom}</td>
              <td>{e.services?.nom || '—'}</td>
              <td>{e.cellules?.nom || <span style={{ color: 'var(--text-muted)' }}>Toutes</span>}</td>
              <td style={{ fontFamily: 'var(--font-mono)' }}>{fmtDate(e.date_debut)}</td>
              <td style={{ fontFamily: 'var(--font-mono)' }}>{fmtDate(e.date_fin)}</td>
              <td>
                {e.template_path
                  ? <span style={{ fontSize: 11, color: 'var(--accent)' }}>
                      {e.template_path.replace('template/', '')}
                    </span>
                  : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Standard</span>
                }
              </td>
              <td>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button
                    className="btn btn-sm btn-icon"
                    title="Télécharger (Excel)"
                    disabled={downloading === e.id}
                    onClick={() => handleDownload(e)}
                  >
                    {downloading === e.id ? '…' : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                    )}
                  </button>
                  {canEdit && (
                    <>
                      <button className="btn btn-sm" onClick={() => { setEditEntry(e); setShowModal(true); }}>
                        Modifier
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(e.id)}>
                        Supprimer
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showModal && (
        <CatalogueModal
          entry={editEntry}
          api={api}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

function CatalogueModal({ entry, api, onClose, onSaved }) {
  const [form, setForm] = useState({
    nom:           entry?.nom           || '',
    service_id:    entry?.service_id    || '',
    cellule_id:    entry?.cellule_id    || '',
    date_debut:    entry?.date_debut    || '',
    date_fin:      entry?.date_fin      || '',
    template_path: entry?.template_path || '',
  });
  const [services,  setServices]  = useState([]);
  const [cellules,  setCellules]  = useState([]);
  const [templates, setTemplates] = useState([]);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');

  useEffect(() => {
    api.get('/services').then(setServices).catch(console.error);
    api.get('/export/templates').then(setTemplates).catch(() => setTemplates([]));
  }, [api]);

  useEffect(() => {
    if (!form.service_id) { setCellules([]); return; }
    api.get(`/services/${form.service_id}/cellules`).then(setCellules).catch(console.error);
  }, [api, form.service_id]);

  function set(field, value) {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'service_id') next.cellule_id = '';
      return next;
    });
  }

  async function handleSave() {
    if (!form.nom || !form.service_id || !form.date_debut || !form.date_fin) {
      setError('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (entry) {
        await api.put(`/export-catalogue/${entry.id}`, form);
      } else {
        await api.post('/export-catalogue', form);
      }
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{entry ? "Modifier l'état" : "Nouvel état d'export"}</span>
          <button className="btn btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8 }}>{error}</div>}

          <div className="form-group">
            <label>Nom *</label>
            <input
              type="text"
              value={form.nom}
              onChange={e => set('nom', e.target.value)}
              placeholder="Ex : Pointage BT Juin 2026"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Service *</label>
            <select value={form.service_id} onChange={e => set('service_id', e.target.value)}>
              <option value="">— Choisir un service —</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Cellule <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optionnel)</span></label>
            <select value={form.cellule_id} onChange={e => set('cellule_id', e.target.value)} disabled={!form.service_id}>
              <option value="">— Toutes les cellules —</option>
              {cellules.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>Date début *</label>
              <input type="date" value={form.date_debut} onChange={e => set('date_debut', e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Date fin *</label>
              <input type="date" value={form.date_fin} onChange={e => set('date_fin', e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label>
              Template Excel
              <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>(optionnel)</span>
            </label>
            <select value={form.template_path} onChange={e => set('template_path', e.target.value)}>
              <option value="">— Export standard (sans template) —</option>
              {templates.map(t => (
                <option key={t.path} value={t.path}>{t.nom}</option>
              ))}
            </select>
            {templates.length === 0 && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                Aucun template dans le bucket documents/template
              </span>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
