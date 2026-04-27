import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import { chatLimiter } from '../middlewares/rateLimiter.js';
import { supabase } from '../supabase.js';

const router = Router();
router.use(authMiddleware);
router.use(chatLimiter);

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAX_TOOL_ROUNDS = 5;
const ROWS_LIMIT = 500;

// ── Définition des outils ──────────────────────────────────────
const TOOLS = [
  {
    name: 'get_agents',
    description: "Récupère la liste des agents actifs d'un service avec cellule, spécialité et roulement. Utilise cet outil pour connaître l'effectif, les contrats, les affectations.",
    input_schema: {
      type: 'object',
      properties: {
        service_id: { type: 'string', description: 'ID du service (obligatoire)' },
      },
      required: ['service_id'],
    },
  },
  {
    name: 'get_pointages',
    description: 'Récupère les pointages réels saisis sur une période pour un service. Peut filtrer par agent ou cellule. Limité à 500 lignes.',
    input_schema: {
      type: 'object',
      properties: {
        service_id: { type: 'string', description: 'ID du service (obligatoire)' },
        date_debut: { type: 'string', description: 'Format YYYY-MM-DD' },
        date_fin:   { type: 'string', description: 'Format YYYY-MM-DD' },
        agent_id:   { type: 'string', description: 'Optionnel — filtrer sur un agent spécifique' },
        cellule_id: { type: 'string', description: 'Optionnel — filtrer sur une cellule' },
      },
      required: ['service_id', 'date_debut', 'date_fin'],
    },
  },
  {
    name: 'get_convocations',
    description: 'Récupère les convocations/rendez-vous RH pour un service ou un agent sur une période.',
    input_schema: {
      type: 'object',
      properties: {
        service_id: { type: 'string', description: 'Optionnel' },
        agent_id:   { type: 'string', description: 'Optionnel' },
        date_debut: { type: 'string', description: 'Format YYYY-MM-DD, optionnel' },
        date_fin:   { type: 'string', description: 'Format YYYY-MM-DD, optionnel' },
      },
      required: [],
    },
  },
  {
    name: 'get_codes_pointage',
    description: "Récupère la liste de tous les codes de pointage disponibles (présence, absences, congés, etc.) avec leur libellé et type.",
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

// ── Exécution des outils ───────────────────────────────────────
async function executeTool(name, input) {
  try {
    switch (name) {
      case 'get_agents': {
        const { data, error } = await supabase
          .from('agent_assignments')
          .select('ordre, agents(matricule, nom, prenom, type_contrat), cellules(nom, code), specialites(nom), roulements(nom)')
          .eq('service_id', input.service_id)
          .eq('is_active', true)
          .order('cellule_id')
          .order('ordre');
        if (error) throw error;
        return data ?? [];
      }

      case 'get_pointages': {
        // Résoudre les agent_ids du service (+ filtre optionnel cellule)
        let assignQuery = supabase
          .from('agent_assignments')
          .select('agent_id')
          .eq('service_id', input.service_id)
          .eq('is_active', true);
        if (input.cellule_id) assignQuery = assignQuery.eq('cellule_id', input.cellule_id);

        const { data: assignments, error: errA } = await assignQuery;
        if (errA) throw errA;
        const agentIds = (assignments ?? []).map(a => a.agent_id);
        if (!agentIds.length) return [];

        let query = supabase
          .from('pointages')
          .select('date, code_pointage, commentaire, agent_id, agents(nom, prenom, matricule)')
          .in('agent_id', input.agent_id ? [input.agent_id] : agentIds)
          .gte('date', input.date_debut)
          .lte('date', input.date_fin)
          .order('date')
          .order('agent_id')
          .limit(ROWS_LIMIT);

        const { data, error } = await query;
        if (error) throw error;
        return data ?? [];
      }

      case 'get_convocations': {
        let query = supabase
          .from('convocations')
          .select('date, type, intitule, commentaire, statut, agents(nom, prenom, matricule)')
          .order('date', { ascending: false })
          .limit(ROWS_LIMIT);
        if (input.service_id) query = query.eq('service_id', input.service_id);
        if (input.agent_id)   query = query.eq('agent_id', input.agent_id);
        if (input.date_debut) query = query.gte('date', input.date_debut);
        if (input.date_fin)   query = query.lte('date', input.date_fin);
        const { data, error } = await query;
        if (error) throw error;
        return data ?? [];
      }

      case 'get_codes_pointage': {
        const { data, error } = await supabase
          .from('codes_pointage')
          .select('code, libelle, type, couleur')
          .eq('is_active', true)
          .order('ordre');
        if (error) throw error;
        return data ?? [];
      }

      default:
        return { error: `Outil inconnu : ${name}` };
    }
  } catch (err) {
    console.error(`[chat tool ${name}]`, err);
    return { error: 'Erreur lors de la récupération des données.' };
  }
}

// ── Route principale ───────────────────────────────────────────
router.post('/', requireRole('admin_app', 'admin_service', 'viewer', 'assistant_rh'), async (req, res) => {
  const { messages, context, meta } = req.body;
  if (!messages?.length) return res.status(400).json({ error: 'messages requis' });

  const serviceCtx = meta?.serviceId
    ? `Service actif : ${meta.serviceName || meta.serviceId} (ID : ${meta.serviceId})\nPériode affichée : ${meta.dateDebut || '?'} → ${meta.dateFin || '?'}`
    : '';

  const system = `Tu es un assistant d'analyse intégré à SIPRA (Suivi PRésence Absence), une application de gestion des plannings et pointages du personnel hospitalier ou industriel.

Tu analyses les données de présence et d'absence, identifies des tendances, anomalies et points d'attention.
Réponds en français, de manière concise et professionnelle. Utilise des listes à puces quand c'est pertinent.
Ne reformule pas la question, va directement à l'analyse.

Tu as accès à des outils pour interroger la base de données en temps réel. Utilise-les quand la réponse dépasse les données déjà disponibles ci-dessous.${serviceCtx ? `\n\n${serviceCtx}` : ''}${context ? `\n\n--- MATRICE ACTUELLEMENT AFFICHÉE ---\n${context}\n--- FIN MATRICE ---` : ''}`;

  try {
    const apiMessages = messages.map(m => ({ role: m.role, content: String(m.content) }));
    let round = 0;
    let lastResponse;

    while (round < MAX_TOOL_ROUNDS) {
      lastResponse = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system,
        tools: TOOLS,
        messages: apiMessages,
      });

      if (lastResponse.stop_reason !== 'tool_use') break;

      const toolUseBlocks = lastResponse.content.filter(b => b.type === 'tool_use');
      const toolResults = await Promise.all(
        toolUseBlocks.map(async (b) => ({
          type: 'tool_result',
          tool_use_id: b.id,
          content: JSON.stringify(await executeTool(b.name, b.input)),
        }))
      );

      apiMessages.push({ role: 'assistant', content: lastResponse.content });
      apiMessages.push({ role: 'user', content: toolResults });
      round++;
    }

    const textBlock = lastResponse?.content?.find(b => b.type === 'text');
    res.json({ content: textBlock?.text ?? '' });
  } catch (err) {
    console.error('chat error:', err);
    res.status(500).json({ error: 'Erreur serveur interne.' });
  }
});

export default router;
