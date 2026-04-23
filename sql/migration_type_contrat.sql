-- Migration: ajout du champ type_contrat dans la table agents
-- À exécuter sur la base existante

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS type_contrat TEXT
    CHECK (type_contrat IN ('CDI', 'CDD', 'CFA', 'INTERIM'));
