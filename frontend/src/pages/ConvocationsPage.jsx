// ============ ConvocationsPage.jsx ============
import { useState, useEffect, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { fmtDate } from "../utils/date.js";

const PDF_MAX_SIZE = 10 * 1024 * 1024; // 10 Mo

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ConvocationsPage() {
  const { api, can, profile } = useAuth();
  const { selectedService } = useOutletContext();
  const [convocations, setConvocations] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editConvoc, setEditConvoc] = useState(null);
  const [agents, setAgents] = useState([]);

  function load() {
    if (!api) return;
    const sid = selectedService?.id || profile?.service_id || "";
    api
      .get(`/convocations?service_id=${sid}`)
      .then(setConvocations)
      .catch(console.error);
    api.get(`/agents?service_id=${sid}`).then(setAgents).catch(console.error);
  }

  useEffect(load, [api, selectedService]);

  async function handleDelete(id) {
    if (!confirm("Supprimer cette convocation ?")) return;
    await api.delete(`/convocations/${id}`);
    load();
  }

  return (
    <div className="page-wrapper">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h1 className="page-title">Convocations</h1>
        {can("edit_convocations") && (
          <button
            className="btn btn-primary"
            onClick={() => {
              setEditConvoc(null);
              setShowModal(true);
            }}
          >
            + Nouvelle convocation
          </button>
        )}
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Agent</th>
            <th>Type</th>
            <th>Intitulé</th>
            <th>Statut</th>
            <th>Doc.</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {convocations.map((c) => (
            <tr key={c.id}>
              <td style={{ fontFamily: "var(--font-mono)" }}>{fmtDate(c.date)}</td>
              <td>
                {c.agents?.nom} {c.agents?.prenom}
              </td>
              <td>
                <span className="badge badge-blue">{c.type}</span>
              </td>
              <td>{c.intitule}</td>
              <td>
                <span
                  className={`badge ${c.statut === "realisee" ? "badge-green" : c.statut === "annulee" ? "badge-red" : "badge-yellow"}`}
                >
                  {c.statut}
                </span>
              </td>
              <td style={{ textAlign: 'center' }}>
                {c.document_url && (
                  <a
                    href={c.document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Ouvrir le document PDF"
                    style={{ color: 'var(--accent)', lineHeight: 1 }}
                  >
                    <PdfIcon />
                  </a>
                )}
              </td>
              <td style={{ display: "flex", gap: 6 }}>
                {can("edit_convocations") && (
                  <>
                    <button
                      className="btn btn-sm"
                      onClick={() => {
                        setEditConvoc(c);
                        setShowModal(true);
                      }}
                    >
                      Éditer
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(c.id)}
                    >
                      ✕
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showModal && (
        <ConvocModal
          convoc={editConvoc}
          agents={agents}
          serviceId={selectedService?.id || profile?.service_id}
          api={api}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function PdfIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}

function ConvocModal({ convoc, agents, serviceId, api, onClose, onSaved }) {
  const TYPES = [
    "disciplinaire",
    "information",
    "formation",
    "medical",
    "autre",
  ];
  const [form, setForm] = useState({
    agent_id: convoc?.agent_id || "",
    date: convoc?.date || new Date().toISOString().split("T")[0],
    type: convoc?.type || "information",
    intitule: convoc?.intitule || "",
    commentaire: convoc?.commentaire || "",
    statut: convoc?.statut || "planifiee",
  });
  const [saving, setSaving] = useState(false);

  // ── PDF ──
  const existingDocUrl = convoc?.document_url || null;
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfDragging, setPdfDragging] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [pdfRemoved, setPdfRemoved] = useState(false);
  const pdfRef = useRef(null);

  function set(k, v) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function handlePdfFile(file) {
    if (!file) return;
    setPdfError('');
    if (file.type !== 'application/pdf') {
      setPdfError('Seuls les fichiers PDF sont acceptés.');
      return;
    }
    if (file.size > PDF_MAX_SIZE) {
      setPdfError('Le document ne doit pas dépasser 10 Mo.');
      return;
    }
    setPdfFile(file);
    setPdfRemoved(false);
  }

  function handlePdfDrop(e) {
    e.preventDefault();
    setPdfDragging(false);
    handlePdfFile(e.dataTransfer?.files[0]);
  }

  function removePdf() {
    setPdfFile(null);
    setPdfRemoved(true);
    setPdfError('');
    if (pdfRef.current) pdfRef.current.value = '';
  }

  async function handleSave() {
    if (!form.agent_id || !form.intitule) return;
    setSaving(true);
    try {
      let convocId;
      const payload = { ...form, service_id: serviceId };
      if (convoc) {
        await api.put(`/convocations/${convoc.id}`, payload);
        convocId = convoc.id;
      } else {
        const created = await api.post("/convocations", payload);
        convocId = created.id;
      }

      if (pdfFile) {
        const base64 = await fileToBase64(pdfFile);
        await api.post(`/convocations/${convocId}/document`, { data: base64 });
      } else if (pdfRemoved && existingDocUrl) {
        await api.delete(`/convocations/${convocId}/document`);
      }

      onSaved();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  const showDropZone = !pdfFile && (pdfRemoved || !existingDocUrl);
  const showExisting = !pdfFile && !pdfRemoved && existingDocUrl;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">
            {convoc ? "Modifier convocation" : "Nouvelle convocation"}
          </span>
          <button className="btn btn-sm btn-icon" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Agent *</label>
            <select
              value={form.agent_id}
              onChange={(e) => set("agent_id", e.target.value)}
              style={{ width: "100%" }}
            >
              <option value="">— Choisir —</option>
              {agents.map((a) => (
                <option key={a.agent_id} value={a.agent_id}>
                  {a.agents?.nom} {a.agents?.prenom} ({a.agents?.matricule})
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Type</label>
              <select
                value={form.type}
                onChange={(e) => set("type", e.target.value)}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Intitulé *</label>
            <input
              value={form.intitule}
              onChange={(e) => set("intitule", e.target.value)}
              style={{ width: "100%" }}
            />
          </div>
          <div className="form-group">
            <label>Commentaire</label>
            <textarea
              value={form.commentaire}
              onChange={(e) => set("commentaire", e.target.value)}
              rows={2}
              style={{ width: "100%" }}
            />
          </div>
          <div className="form-group">
            <label>Statut</label>
            <select
              value={form.statut}
              onChange={(e) => set("statut", e.target.value)}
            >
              {["planifiee", "realisee", "annulee"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* ── Zone document PDF ── */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Document PDF</label>

            {/* Document existant en base */}
            {showExisting && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 4,
              }}>
                <span style={{ color: 'var(--accent)', flexShrink: 0 }}><PdfIcon /></span>
                <a
                  href={existingDocUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ flex: 1, fontSize: 12, color: 'var(--accent)', wordBreak: 'break-all' }}
                >
                  Ouvrir le document
                </a>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={removePdf}
                  style={{ fontSize: 10, padding: '2px 8px', flexShrink: 0 }}
                >
                  Retirer
                </button>
              </div>
            )}

            {/* Nouveau fichier sélectionné */}
            {pdfFile && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--accent)',
                borderRadius: 4,
              }}>
                <span style={{ color: 'var(--accent)', flexShrink: 0 }}><PdfIcon /></span>
                <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pdfFile.name}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {(pdfFile.size / 1024).toFixed(0)} Ko
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={removePdf}
                  style={{ fontSize: 10, padding: '2px 8px', flexShrink: 0 }}
                >
                  Retirer
                </button>
              </div>
            )}

            {/* Zone de dépôt */}
            {showDropZone && (
              <div
                onDragOver={e => { e.preventDefault(); setPdfDragging(true); }}
                onDragLeave={() => setPdfDragging(false)}
                onDrop={handlePdfDrop}
                onClick={() => pdfRef.current?.click()}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 6,
                  padding: '20px 16px',
                  border: `2px dashed ${pdfDragging ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 4,
                  background: pdfDragging ? 'var(--bg-hover)' : 'var(--bg-surface)',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, background 0.15s',
                  textAlign: 'center',
                }}
              >
                <span style={{ color: pdfDragging ? 'var(--accent)' : 'var(--text-muted)' }}>
                  <PdfIcon />
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Glisser un PDF ici ou <span style={{ color: 'var(--accent)', textDecoration: 'underline' }}>parcourir</span>
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>PDF · max 10 Mo</span>
              </div>
            )}

            <input
              ref={pdfRef}
              type="file"
              accept="application/pdf"
              style={{ display: 'none' }}
              onChange={e => handlePdfFile(e.target.files[0])}
            />
            {pdfError && (
              <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{pdfError}</div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>
            Annuler
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !form.agent_id || !form.intitule}
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
