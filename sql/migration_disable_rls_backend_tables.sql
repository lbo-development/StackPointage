-- ============================================================
-- Migration : désactivation RLS sur les tables gérées par le backend
--
-- Contexte : le backend Express utilise la clé service_role Supabase
-- au nouveau format (sb_secret_...) non reconnu par supabase-js < 2.65.
-- Comme le backend applique déjà son propre contrôle d'accès
-- (authMiddleware + requireRole + requireServiceScope), le RLS
-- ne fournit pas de protection supplémentaire côté serveur.
-- ============================================================

ALTER TABLE public.agents                DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_assignments     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pointages             DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.codes_pointage        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.roulements            DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.roulement_cycles      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cellules              DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.specialites           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.convocations          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.previsions_absence    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.jours_feries          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.services              DISABLE ROW LEVEL SECURITY;
