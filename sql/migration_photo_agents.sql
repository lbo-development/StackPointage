-- Migration: ajout de la colonne photo_url dans la table agents

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS photo_url TEXT;
