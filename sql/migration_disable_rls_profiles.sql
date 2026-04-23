-- ============================================================
-- Migration : désactivation RLS sur la table profiles
--
-- La table profiles était absente de migration_disable_rls_backend_tables.sql,
-- ce qui bloquait les INSERT via le backend (service_role non reconnu).
-- Le backend contrôle déjà l'accès via authMiddleware + requireRole.
-- ============================================================

ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
