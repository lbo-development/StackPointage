-- ============================================================
-- Migration: roulements communs (service_id nullable)
-- Permet de créer des roulements globaux (communs à tous les services)
-- en rendant service_id optionnel.
--
-- service_id = NULL  → roulement commun à tous les services
-- service_id = UUID  → roulement spécifique à un service
-- ============================================================

-- 1. Supprimer la contrainte NOT NULL sur service_id
ALTER TABLE roulements ALTER COLUMN service_id DROP NOT NULL;

-- 2. Remplacer la contrainte FK (ON DELETE CASCADE → ON DELETE SET NULL)
--    Si un service est supprimé, ses roulements deviennent globaux plutôt qu'être supprimés.
ALTER TABLE roulements DROP CONSTRAINT IF EXISTS roulements_service_id_fkey;
ALTER TABLE roulements ADD CONSTRAINT roulements_service_id_fkey
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL;
