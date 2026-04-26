import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';

const router = Router();
router.use(authMiddleware);

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

router.post('/', requireRole('admin_app', 'admin_service', 'viewer', 'assistant_rh'), async (req, res) => {
  const { messages, context } = req.body;
  if (!messages?.length) return res.status(400).json({ error: 'messages requis' });

  const system = `Tu es un assistant d'analyse intégré à SIPRA (Suivi PRésence Absence), une application de gestion des plannings et pointages du personnel hospitalier ou industriel.

Tu analyses les données de présence et d'absence, identifies des tendances, anomalies et points d'attention.
Réponds en français, de manière concise et professionnelle. Utilise des listes à puces quand c'est pertinent.
Ne reformule pas la question, va directement à l'analyse.

${context ? `--- DONNÉES DE LA MATRICE COURANTE ---\n${context}\n--- FIN DES DONNÉES ---` : 'Aucune donnée de matrice disponible pour le moment.'}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system,
      messages: messages.map(m => ({ role: m.role, content: String(m.content) })),
    });
    res.json({ content: response.content[0].text });
  } catch (err) {
    console.error('chat error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
