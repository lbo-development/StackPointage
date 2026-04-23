import { supabase } from '../supabase.js';

/**
 * CALCUL DU ROULEMENT
 * 
 * Principe :
 *   delta = date_cible - date_debut_reference  (en jours)
 *   index = ((delta % longueur_cycle) + longueur_cycle) % longueur_cycle
 *   code  = cycle[index].code_pointage
 * 
 * Le double modulo gère les dates antérieures à la référence (delta négatif)
 */
export function calculerCodeRoulement(dateStr, roulement, cycles) {
  const dateRef = new Date(roulement.date_debut_reference);
  const dateCible = new Date(dateStr);

  // Différence en jours (UTC pour éviter les décalages DST)
  const msParJour = 24 * 60 * 60 * 1000;
  const delta = Math.round((dateCible - dateRef) / msParJour);

  const longueur = roulement.longueur_cycle;
  const index = ((delta % longueur) + longueur) % longueur;

  const jourCycle = cycles.find(c => c.index_jour === index);
  return jourCycle ? jourCycle.code_pointage : null;
}

/**
 * Génère les codes théoriques pour un agent sur une plage de dates
 */
export async function genererTheorique(agentId, dateDebut, dateFin) {
  // Récupération de l'affectation active
  const { data: assignment, error: errA } = await supabase
    .from('agent_assignments')
    .select('*, roulements(*)')
    .eq('agent_id', agentId)
    .eq('is_active', true)
    .lte('date_debut', dateFin)
    .or(`date_fin.is.null,date_fin.gte.${dateDebut}`)
    .maybeSingle();

  if (errA || !assignment || !assignment.roulement_id) return {};

  const { data: cycles, error: errC } = await supabase
    .from('roulement_cycles')
    .select('*')
    .eq('roulement_id', assignment.roulement_id)
    .order('index_jour');

  if (errC || !cycles?.length) return {};

  const roulement = assignment.roulements;
  const result = {};

  let current = new Date(dateDebut);
  const end = new Date(dateFin);

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    result[dateStr] = calculerCodeRoulement(dateStr, roulement, cycles);
    current.setDate(current.getDate() + 1);
  }

  return result;
}

/**
 * Récupère tous les roulements d'un service avec leurs cycles
 */
// Retourne les roulements du service + les roulements globaux (service_id IS NULL)
export async function getRoulementsByService(serviceId) {
  const { data, error } = await supabase
    .from('roulements')
    .select(`
      *,
      roulement_cycles(*)
    `)
    .or(`service_id.eq.${serviceId},service_id.is.null`)
    .eq('is_active', true)
    .order('nom');

  if (error) throw error;
  return data;
}
