import { supabase } from '../supabase.js';
import { calculerCodeRoulement } from './roulementService.js';

/**
 * Construit la matrice complète pour un service sur une plage de dates
 * Retourne : dates[], cellules[], agents[], pointages (réel + théorique), cumuls
 */
export async function buildMatrix(serviceId, dateDebut, dateFin, mode = 'reel') {
  // 1. Dates de la plage
  const dates = generateDateRange(dateDebut, dateFin);

  // 2. Jours fériés dans la plage
  const { data: feries } = await supabase
    .from('jours_feries')
    .select('date')
    .gte('date', dateDebut)
    .lte('date', dateFin)
    .eq('is_active', true);
  const feriesSet = new Set((feries || []).map(f => f.date));

  // 3. Cellules du service
  const { data: cellules, error: errC } = await supabase
    .from('cellules')
    .select('*')
    .eq('service_id', serviceId)
    .eq('is_active', true)
    .order('ordre');
  if (errC) throw errC;

  // 4. Spécialités du service
  const { data: specialites } = await supabase
    .from('specialites')
    .select('*')
    .eq('service_id', serviceId)
    .eq('is_active', true)
    .order('ordre');

  // 5. Agents avec affectations actives dans la plage
  const { data: assignments, error: errA } = await supabase
    .from('agent_assignments')
    .select(`
      *,
      agents(*),
      roulements(*, roulement_cycles(*))
    `)
    .eq('service_id', serviceId)
    .eq('is_active', true)
    .lte('date_debut', dateFin)
    .or(`date_fin.is.null,date_fin.gte.${dateDebut}`);
  if (errA) throw errA;

  if (!assignments?.length) {
    return { dates, cellules, specialites, agents: [], cumuls: {}, feries: [...feriesSet] };
  }

  const agentIds = assignments.map(a => a.agent_id);

  // 6. Pointages réels
  const { data: pointages } = await supabase
    .from('pointages')
    .select('id, agent_id, date, code_pointage, commentaire, is_locked')
    .in('agent_id', agentIds)
    .gte('date', dateDebut)
    .lte('date', dateFin);

  // 7. Prévisions (théoriques saisis manuellement)
  const { data: previsions } = await supabase
    .from('previsions_absence')
    .select('agent_id, date, code_pointage, commentaire, is_locked')
    .in('agent_id', agentIds)
    .gte('date', dateDebut)
    .lte('date', dateFin);

  // 8. Convocations
  const { data: convocations } = await supabase
    .from('convocations')
    .select('agent_id, date, type, intitule')
    .in('agent_id', agentIds)
    .gte('date', dateDebut)
    .lte('date', dateFin);

  // 9. Codes de pointage pour les couleurs
  const { data: codes } = await supabase
    .from('codes_pointage')
    .select('code, bg_color, text_color, type, libelle, is_locked')
    .or(`service_id.eq.${serviceId},is_global.eq.true`);
  const codesMap = {};
  (codes || []).forEach(c => { codesMap[c.code] = c; });

  // Index des données
  const rPointages = {}; // agentId -> date -> {code, commentaire, is_locked}
  (pointages || []).forEach(p => {
    if (!rPointages[p.agent_id]) rPointages[p.agent_id] = {};
    rPointages[p.agent_id][p.date] = { id: p.id, code: p.code_pointage, commentaire: p.commentaire, is_locked: p.is_locked, source: 'reel' };
  });

  const rPrevisions = {};
  (previsions || []).forEach(p => {
    if (!rPrevisions[p.agent_id]) rPrevisions[p.agent_id] = {};
    rPrevisions[p.agent_id][p.date] = { code: p.code_pointage, commentaire: p.commentaire, is_locked: p.is_locked, source: 'prevision' };
  });

  const rConvocations = {};
  (convocations || []).forEach(c => {
    if (!rConvocations[c.agent_id]) rConvocations[c.agent_id] = {};
    if (!rConvocations[c.agent_id][c.date]) rConvocations[c.agent_id][c.date] = [];
    rConvocations[c.agent_id][c.date].push(c);
  });

  // 10. Construction de la matrice agents
  const agentsMatrix = assignments.map(assignment => {
    const agent = assignment.agents;
    const roulement = assignment.roulements;
    const cycles = roulement?.roulement_cycles || [];

    const ligneReel = {};
    const ligneTheorique = {};

    dates.forEach(dateStr => {
      // Code réel (saisi)
      const reel = rPointages[agent.id]?.[dateStr] || null;

      // Code théorique : prévision manuelle OU roulement calculé
      const prevision = rPrevisions[agent.id]?.[dateStr] || null;
      let theorique = null;
      if (prevision) {
        theorique = prevision;
      } else if (roulement && cycles.length) {
        const code = calculerCodeRoulement(dateStr, roulement, cycles);
        if (code) theorique = { code, source: 'roulement' };
      }

      // Entrée réelle synthétique : jour férié + roulement feries_non_travailles + pas de saisie réelle
      let effectiveReel = reel;
      if (!reel && feriesSet.has(dateStr) && roulement?.feries_non_travailles) {
        effectiveReel = { code: 'FE', source: 'ferie-auto', is_locked: false };
      }

      ligneReel[dateStr] = effectiveReel;
      ligneTheorique[dateStr] = theorique;
    });

    return {
      agent: {
        id: agent.id,
        matricule: agent.matricule,
        nom: agent.nom,
        prenom: agent.prenom
      },
      cellule_id: assignment.cellule_id,
      specialite_id: assignment.specialite_id,
      roulement_id: assignment.roulement_id,
      assignment_id: assignment.id,
      ordre: assignment.ordre ?? 0,       // ← champ ordre exposé
      reel: ligneReel,
      theorique: ligneTheorique,
      convocations: rConvocations[agent.id] || {}
    };
  });

  // 11. Cumuls par cellule + spécialité + type
  const cumuls = computeCumuls(agentsMatrix, dates, codesMap);

  return {
    dates,
    cellules,
    specialites: specialites || [],
    agents: agentsMatrix,
    cumuls,
    feries: [...feriesSet],
    codesMap
  };
}

/**
 * Calcule les cumuls par cellule, spécialité et type de code (matin/am/nuit/journée)
 * Priorité : réel sinon théorique
 */
function computeCumuls(agents, dates, codesMap) {
  const cumuls = {}; // cellule_id -> date -> { matin: 0, apres_midi: 0, nuit: 0, journee: 0 }

  agents.forEach(ag => {
    const cid = ag.cellule_id;
    if (!cumuls[cid]) cumuls[cid] = {};

    dates.forEach(date => {
      if (!cumuls[cid][date]) {
        cumuls[cid][date] = { matin: 0, apres_midi: 0, nuit: 0, journee: 0 };
      }

      // Priorité réel sinon théorique
      const entry = ag.reel[date] || ag.theorique[date];
      if (!entry?.code) return;

      const code = codesMap[entry.code];
      if (!code) return;

      if (code.type === 'matin') cumuls[cid][date].matin++;
      else if (code.type === 'apres_midi') cumuls[cid][date].apres_midi++;
      else if (code.type === 'nuit') cumuls[cid][date].nuit++;
      else if (code.type === 'journee') cumuls[cid][date].journee++;
    });
  });

  return cumuls;
}

function generateDateRange(dateDebut, dateFin) {
  const dates = [];
  let current = new Date(dateDebut);
  const end = new Date(dateFin);
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}
