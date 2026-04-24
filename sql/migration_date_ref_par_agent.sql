-- ============================================================
-- MIGRATION : date de référence par agent sur l'affectation
-- ============================================================
-- Certains roulements n'ont pas de date de référence partagée :
-- chaque agent porte sa propre date de référence via agent_assignments.

-- Flag sur le roulement : quand TRUE, c'est l'affectation qui porte la date
ALTER TABLE roulements
  ADD COLUMN IF NOT EXISTS date_ref_par_agent BOOLEAN NOT NULL DEFAULT FALSE;

-- Date de référence propre à chaque affectation (nullable)
-- Quand renseignée, elle remplace roulements.date_debut_reference pour cet agent
ALTER TABLE agent_assignments
  ADD COLUMN IF NOT EXISTS date_debut_reference DATE NULL;

COMMENT ON COLUMN roulements.date_ref_par_agent IS
  'Si TRUE, la date de référence du cycle est portée par chaque agent_assignment (date_debut_reference) et non par le roulement lui-même.';

COMMENT ON COLUMN agent_assignments.date_debut_reference IS
  'Date de début de référence du cycle pour cet agent. Prioritaire sur roulements.date_debut_reference quand renseignée.';
