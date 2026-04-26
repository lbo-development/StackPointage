import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { fmtDate as fmtShortDate } from '../utils/date.js';

const CURRENT_YEAR = new Date().getFullYear();

const YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => CURRENT_YEAR - 2 + i);

function fmtDate(str) {
  if (!str) return '';
  return new Date(str + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });
}

export default function JoursFeriesPage() {
  const { api, isViewer } = useAuth();
  const [annee, setAnnee]       = useState(CURRENT_YEAR);
  const [feries, setFeries]     = useState([]);
  const [loading, setLoading]   = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editModal, setEditModal]   = useState(null); // null | { ferie } | { ferie: null } pour ajout
  const [error, setError]           = useState('');

  async function load() {
    if (!api) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.get(`/jours-feries?annee=${annee}`);
      setFeries(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [api, annee]);

  async function handleGenerer() {
    if (!confirm(`Générer les 11 jours fériés français pour ${annee} ?\nLes jours déjà existants ne seront pas écrasés.`)) return;
    setGenerating(true);
    setError('');
    try {
      const res = await api.post('/jours-feries/generer', { annee });
      await load();
      alert(`${res.inserted} jour(s) férié(s) ajouté(s) pour ${annee}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleToggleActif(ferie) {
    try {
      await api.put(`/jours-feries/${ferie.id}`, { ...ferie, is_active: !ferie.is_active });
      setFeries(prev => prev.map(f => f.id === ferie.id ? { ...f, is_active: !f.is_active } : f));
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleDelete(ferie) {
    if (!confirm(`Supprimer « ${ferie.libelle || ferie.date} » ?\nCette action est irréversible.`)) return;
    try {
      await api.delete(`/jours-feries/${ferie.id}`);
      setFeries(prev => prev.filter(f => f.id !== ferie.id));
    } catch (err) {
      alert(err.message);
    }
  }

  const actifs   = useMemo(() => feries.filter(f => f.is_active).length, [feries]);
  const inactifs = feries.length - actifs;

  return (
    <div className="page-wrapper">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="page-title">Jours Fériés</h1>
        <button className="btn btn-primary" onClick={() => setEditModal({ ferie: null })}>
          + Ajouter
        </button>
      </div>

      <div className="toolbar" style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          Année
          <select
            value={annee}
            onChange={e => setAnnee(Number(e.target.value))}
            style={{ width: 100 }}
          >
            {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>

        {!isViewer && (
          <button
            className="btn btn-sm"
            onClick={handleGenerer}
            disabled={generating}
            title={`Calculer et insérer les 11 jours fériés français pour ${annee}`}
          >
            {generating ? '…' : '⚙'} Générer {annee}
          </button>
        )}

        {feries.length > 0 && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
            <strong style={{ color: 'var(--text-primary)' }}>{feries.length}</strong> jour{feries.length > 1 ? 's' : ''} férié{feries.length > 1 ? 's' : ''}
            {inactifs > 0 && <span> · <span style={{ color: 'var(--text-muted)' }}>{inactifs} inactif{inactifs > 1 ? 's' : ''}</span></span>}
          </span>
        )}
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

      {loading
        ? <div className="loading-overlay"><div className="loading-spinner" /></div>
        : feries.length === 0
          ? (
            <div className="loading-overlay" style={{ flex: 'none', height: 200, border: '1px dashed var(--border)', borderRadius: 8 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: 12 }}>
                  Aucun jour férié pour {annee}
                </div>
                {!isViewer && (
                  <button className="btn btn-primary" onClick={handleGenerer} disabled={generating}>
                    {generating ? '…' : '⚙'} Générer les jours fériés {annee}
                  </button>
                )}
              </div>
            </div>
          )
          : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Libellé</th>
                  <th style={{ textAlign: 'center', width: 90 }}>Actif</th>
                  <th style={{ width: 110 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {feries.map(f => (
                  <tr key={f.id} style={!f.is_active ? { opacity: 0.45 } : undefined}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 600 }}>{fmtShortDate(f.date)}</span>
                      <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                        {new Date(f.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long' })}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{f.libelle || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => !isViewer && handleToggleActif(f)}
                        disabled={isViewer}
                        style={{
                          background: 'none', border: 'none', cursor: isViewer ? 'default' : 'pointer',
                          fontSize: 16, lineHeight: 1, padding: 2,
                        }}
                        title={isViewer ? '' : (f.is_active ? 'Désactiver' : 'Activer')}
                      >
                        {f.is_active
                          ? <span style={{ color: '#22c55e' }}>●</span>
                          : <span style={{ color: 'var(--border)' }}>○</span>}
                      </button>
                    </td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      {!isViewer && <>
                        <button className="btn btn-sm" onClick={() => setEditModal({ ferie: f })}>
                          Éditer
                        </button>
                        <button
                          className="btn btn-sm"
                          style={{ color: 'var(--color-danger, #ef4444)' }}
                          onClick={() => handleDelete(f)}
                        >
                          ✕
                        </button>
                      </>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
      }

      {editModal && (
        <FerieModal
          ferie={editModal.ferie}
          defaultAnnee={annee}
          api={api}
          onClose={() => setEditModal(null)}
          onSaved={() => { setEditModal(null); load(); }}
        />
      )}
    </div>
  );
}

function FerieModal({ ferie, defaultAnnee, api, onClose, onSaved }) {
  const isNew = !ferie;
  const [date, setDate]         = useState(ferie?.date || `${defaultAnnee}-01-01`);
  const [libelle, setLibelle]   = useState(ferie?.libelle || '');
  const [isActive, setIsActive] = useState(ferie?.is_active !== false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  async function handleSave() {
    if (!date) return;
    setSaving(true);
    setError('');
    try {
      if (isNew) {
        await api.post('/jours-feries', { date, libelle, is_active: isActive });
      } else {
        await api.put(`/jours-feries/${ferie.id}`, { date, libelle, is_active: isActive });
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{isNew ? 'Ajouter un jour férié' : 'Modifier le jour férié'}</span>
          <button className="btn btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-group">
            <label>Date <span style={{ color: 'var(--color-danger, #ef4444)' }}>*</span></label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: '100%' }} />
            {date && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, textTransform: 'capitalize' }}>
                {fmtDate(date)}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Libellé</label>
            <input
              type="text"
              value={libelle}
              onChange={e => setLibelle(e.target.value)}
              placeholder="ex : Lundi de Pâques"
              style={{ width: '100%' }}
              autoFocus={isNew}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
            Actif (pris en compte dans les calculs)
          </label>

        </div>
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-sm" onClick={onClose}>Annuler</button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            disabled={saving || !date}
          >
            {saving ? 'Enregistrement…' : isNew ? 'Ajouter' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
