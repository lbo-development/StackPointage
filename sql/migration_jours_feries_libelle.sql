-- Ajoute la colonne libelle à jours_feries si elle n'existe pas
ALTER TABLE jours_feries ADD COLUMN IF NOT EXISTS libelle TEXT;

-- Contrainte unicité sur date pour permettre l'upsert ignoreDuplicates
ALTER TABLE jours_feries ADD CONSTRAINT jours_feries_date_unique UNIQUE (date);
