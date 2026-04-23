-- Migration : remplacement des types de codes_pointage
-- Anciens : matin, apres_midi, nuit, journee, absence, conge, repos, autre
-- Nouveaux : Présence, Repos, Congé, Maladie, Absence, Autre absence, Autre présence, Autre

-- 1. Supprimer l'ancienne contrainte
ALTER TABLE codes_pointage
  DROP CONSTRAINT IF EXISTS codes_pointage_type_check;

-- 2. Mettre à jour les données existantes
UPDATE codes_pointage SET type = 'Présence'       WHERE type IN ('matin','apres_midi','nuit','journee');
UPDATE codes_pointage SET type = 'Absence'        WHERE type = 'absence';
UPDATE codes_pointage SET type = 'Congé'          WHERE type = 'conge';
UPDATE codes_pointage SET type = 'Repos'          WHERE type = 'repos';
UPDATE codes_pointage SET type = 'Autre'          WHERE type = 'autre';

-- 3. Ajouter la nouvelle contrainte
ALTER TABLE codes_pointage
  ADD CONSTRAINT codes_pointage_type_check
  CHECK (type = ANY (ARRAY[
    'Présence'::text,
    'Repos'::text,
    'Congé'::text,
    'Maladie'::text,
    'Absence'::text,
    'Autre absence'::text,
    'Autre présence'::text,
    'Autre'::text
  ]));
