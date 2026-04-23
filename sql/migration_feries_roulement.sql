-- ============================================================
-- MIGRATION: gestion des jours fériés par roulement
-- À exécuter dans Supabase SQL Editor
-- ============================================================

-- 1. Flag sur les roulements : fériés non travaillés
ALTER TABLE roulements
  ADD COLUMN IF NOT EXISTS feries_non_travailles BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Code FE — Férié non travaillé (repos imposé par le jour férié)
INSERT INTO codes_pointage (code, libelle, type, bg_color, text_color, is_global, is_locked, ordre)
VALUES ('FE', 'Férié non travaillé', 'Repos', '#FEE2E2', '#991B1B', TRUE, TRUE, 11)
ON CONFLICT (service_id, code) DO NOTHING;
