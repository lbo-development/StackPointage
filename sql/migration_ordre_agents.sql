-- ============================================================
-- MIGRATION: ordre d'affichage des agents par cellule
-- À exécuter dans Supabase SQL Editor
-- ============================================================

-- 1. Ajout de la colonne ordre dans agent_assignments
ALTER TABLE agent_assignments
  ADD COLUMN IF NOT EXISTS ordre INT NOT NULL DEFAULT 0;

-- 2. Index pour accélérer le tri dans la matrice
CREATE INDEX IF NOT EXISTS idx_agent_assignments_cellule_ordre
  ON agent_assignments(cellule_id, ordre);

-- 3. Initialisation de l'ordre existant par ordre alphabétique (nom, prénom)
--    pour ne pas tout mettre à 0 d'un coup
UPDATE agent_assignments aa
SET ordre = sub.rang
FROM (
  SELECT
    aa2.id,
    ROW_NUMBER() OVER (
      PARTITION BY aa2.cellule_id
      ORDER BY a.nom, a.prenom
    ) - 1 AS rang   -- commence à 0
  FROM agent_assignments aa2
  JOIN agents a ON a.id = aa2.agent_id
  WHERE aa2.is_active = TRUE
) sub
WHERE aa.id = sub.id;
