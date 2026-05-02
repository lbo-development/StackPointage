import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import { supabase } from '../supabase.js';

const router = Router();
router.use(authMiddleware);

const PDF_MAX_BYTES = 10 * 1024 * 1024; // 10 Mo

router.get('/', async (req, res) => {
  try {
    const { service_id, agent_id, date_debut, date_fin } = req.query;
    let query = supabase
      .from('convocations')
      .select('*, agents(nom, prenom, matricule)')
      .order('date', { ascending: false });
    if (service_id) query = query.eq('service_id', service_id);
    if (agent_id)   query = query.eq('agent_id', agent_id);
    if (date_debut) query = query.gte('date', date_debut);
    if (date_fin)   query = query.lte('date', date_fin);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

router.post('/', requireRole('admin_app', 'admin_service', 'pointeur', 'assistant_rh'), async (req, res) => {
  try {
    const { agent_id, date, type, intitule, commentaire, statut, service_id } = req.body;
    if (!agent_id || !intitule?.trim() || !date) {
      return res.status(400).json({ error: 'agent_id, date et intitule sont requis' });
    }
    const { data, error } = await supabase
      .from('convocations')
      .insert({ agent_id, date, type, intitule: intitule.trim(), commentaire, statut, service_id, cree_par: req.profile.id })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

router.put('/:id', requireRole('admin_app', 'admin_service', 'pointeur', 'assistant_rh'), async (req, res) => {
  try {
    const { agent_id, date, type, intitule, commentaire, statut, service_id } = req.body;
    if (!agent_id || !intitule?.trim() || !date) {
      return res.status(400).json({ error: 'agent_id, date et intitule sont requis' });
    }
    const { data, error } = await supabase
      .from('convocations')
      .update({ agent_id, date, type, intitule: intitule.trim(), commentaire, statut, service_id })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

router.delete('/:id', requireRole('admin_app', 'admin_service', 'assistant_rh'), async (req, res) => {
  try {
    // Supprimer le document associé s'il existe
    await supabase.storage.from('Documents').remove([`convocation/${req.params.id}`]);
    const { error } = await supabase.from('convocations').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

// POST /api/convocations/:id/document — upload PDF (base64)
router.post('/:id/document', requireRole('admin_app', 'admin_service', 'pointeur', 'assistant_rh'), async (req, res) => {
  try {
    const { id } = req.params;
    const { data: base64 } = req.body;
    if (!base64) return res.status(400).json({ error: 'data (base64) requis' });

    const buffer = Buffer.from(base64, 'base64');

    if (buffer.length > PDF_MAX_BYTES) {
      return res.status(400).json({ error: 'Document trop volumineux (max 10 Mo)' });
    }

    // Vérification magic bytes PDF : %PDF = 0x25 0x50 0x44 0x46
    if (buffer[0] !== 0x25 || buffer[1] !== 0x50 || buffer[2] !== 0x44 || buffer[3] !== 0x46) {
      return res.status(400).json({ error: 'Format non supporté. Seuls les fichiers PDF sont acceptés.' });
    }

    const storagePath = `convocation/${id}`;
    const { error: upErr } = await supabase.storage
      .from('Documents')
      .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: true });
    if (upErr) {
      console.error('Storage upload error:', upErr);
      return res.status(500).json({ error: `Erreur upload : ${upErr.message}` });
    }

    const { data: { publicUrl } } = supabase.storage
      .from('Documents')
      .getPublicUrl(storagePath);

    const { error: dbErr } = await supabase
      .from('convocations')
      .update({ document_url: publicUrl })
      .eq('id', id);
    if (dbErr) {
      console.error('DB update error:', dbErr);
      return res.status(500).json({ error: `Erreur base de données : ${dbErr.message}` });
    }

    res.json({ document_url: publicUrl });
  } catch (err) {
    console.error('Document upload exception:', err);
    res.status(500).json({ error: err.message || 'Erreur serveur interne.' });
  }
});

// DELETE /api/convocations/:id/document — supprimer le document
router.delete('/:id/document', requireRole('admin_app', 'admin_service', 'pointeur', 'assistant_rh'), async (req, res) => {
  try {
    const { id } = req.params;
    await supabase.storage.from('Documents').remove([`convocation/${id}`]);
    await supabase.from('convocations').update({ document_url: null }).eq('id', id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

export default router;
