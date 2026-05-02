-- ============================================================
-- Historique des roulements par affectation agent
-- Remplace la relation 1-1 agent_assignments.roulement_id
-- par un historique daté permettant N changements de roulement
-- ============================================================

-- 1. Table historique
CREATE TABLE IF NOT EXISTS assignment_roulements (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id       UUID        NOT NULL REFERENCES agent_assignments(id) ON DELETE CASCADE,
  roulement_id        UUID        NOT NULL REFERENCES roulements(id),
  date_debut          DATE        NOT NULL,
  date_fin            DATE,
  date_debut_reference DATE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT check_ar_dates CHECK (date_fin IS NULL OR date_fin >= date_debut)
);

CREATE INDEX IF NOT EXISTS idx_ar_assignment ON assignment_roulements(assignment_id);
CREATE INDEX IF NOT EXISTS idx_ar_dates      ON assignment_roulements(date_debut, date_fin);

-- 2. Migration des données existantes :
--    chaque affectation active avec un roulement devient la première entrée d'historique
INSERT INTO assignment_roulements (assignment_id, roulement_id, date_debut, date_fin, date_debut_reference)
SELECT
  id,
  roulement_id,
  date_debut,
  NULL,
  date_debut_reference
FROM agent_assignments
WHERE roulement_id IS NOT NULL
ON CONFLICT DO NOTHING;
