-- ============================================================
-- MIGRATION: ordre d'affichage des services
-- À exécuter dans Supabase SQL Editor
-- ============================================================

-- 1. Ajout de la colonne num_ordre dans services
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS num_ordre INT NOT NULL DEFAULT 0;

-- 2. Index pour accélérer le tri
CREATE INDEX IF NOT EXISTS idx_services_num_ordre
  ON services(num_ordre);

-- 3. Initialisation de l'ordre existant par ordre alphabétique (nom)
UPDATE services s
SET num_ordre = sub.rang
FROM (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY nom) - 1 AS rang  -- commence à 0
  FROM services
  WHERE is_active = TRUE
) sub
WHERE s.id = sub.id;
