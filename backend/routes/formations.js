import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import { supabase } from '../supabase.js';

const router = Router();
router.use(authMiddleware);

const DOC_MAX_BYTES = 10 * 1024 * 1024; // 10 Mo

// ── Catalogue ──────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('formations')
      .select('*, formation_documents(*)')
      .order('libelle');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

router.post('/', requireRole('admin_app', 'admin_service', 'assistant_rh'), async (req, res) => {
  try {
    const { libelle, description, frequence_recyclage_mois } = req.body;
    if (!libelle?.trim()) return res.status(400).json({ error: 'Le libellé est requis.' });
    const { data, error } = await supabase
      .from('formations')
      .insert({ libelle: libelle.trim(), description, frequence_recyclage_mois: frequence_recyclage_mois || null })
      .select('*, formation_documents(*)')
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

router.put('/:id', requireRole('admin_app', 'admin_service', 'assistant_rh'), async (req, res) => {
  try {
    const { libelle, description, frequence_recyclage_mois, is_active } = req.body;
    if (!libelle?.trim()) return res.status(400).json({ error: 'Le libellé est requis.' });
    const { data, error } = await supabase
      .from('formations')
      .update({ libelle: libelle.trim(), description, frequence_recyclage_mois: frequence_recyclage_mois || null, is_active })
      .eq('id', req.params.id)
      .select('*, formation_documents(*)')
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

router.delete('/:id', requireRole('admin_app', 'assistant_rh'), async (req, res) => {
  try {
    const { error } = await supabase.from('formations').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

// ── Documents associés à une formation ────────────────────────────────────

router.post('/:id/documents', requireRole('admin_app', 'admin_service', 'assistant_rh'), async (req, res) => {
  try {
    const { id } = req.params;
    const { libelle, data: base64 } = req.body;
    if (!libelle?.trim() || !base64) return res.status(400).json({ error: 'libelle et data (base64) requis.' });

    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length > DOC_MAX_BYTES) return res.status(400).json({ error: 'Document trop volumineux (max 10 Mo).' });

    if (buffer[0] !== 0x25 || buffer[1] !== 0x50 || buffer[2] !== 0x44 || buffer[3] !== 0x46) {
      return res.status(400).json({ error: 'Seuls les fichiers PDF sont acceptés.' });
    }

    const docId = crypto.randomUUID();
    const storagePath = `formations/${id}/${docId}`;
    const { error: upErr } = await supabase.storage
      .from('Documents')
      .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: false });
    if (upErr) return res.status(500).json({ error: `Erreur upload : ${upErr.message}` });

    const { data: { publicUrl } } = supabase.storage.from('Documents').getPublicUrl(storagePath);

    const { data, error } = await supabase
      .from('formation_documents')
      .insert({ formation_id: id, libelle: libelle.trim(), document_url: publicUrl })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

router.delete('/:id/documents/:docId', requireRole('admin_app', 'admin_service', 'assistant_rh'), async (req, res) => {
  try {
    const { id, docId } = req.params;
    const { data: doc } = await supabase.from('formation_documents').select('document_url').eq('id', docId).single();
    if (doc?.document_url) {
      const path = doc.document_url.split('/Documents/')[1];
      if (path) await supabase.storage.from('Documents').remove([path]);
    }
    const { error } = await supabase.from('formation_documents').delete().eq('id', docId).eq('formation_id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

export default router;
