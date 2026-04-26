-- Migration : ajout du rôle 'viewer' dans la table profiles
-- Le rôle viewer donne accès à toutes les données en consultation seule.

-- 1. Supprimer l'ancien CHECK constraint (nom auto-généré par PostgreSQL)
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. Ajouter le nouveau CHECK constraint incluant 'viewer'
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin_app', 'admin_service', 'pointeur', 'assistant_rh', 'agent', 'viewer'));
