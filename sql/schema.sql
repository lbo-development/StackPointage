-- ============================================================
-- SCHÉMA COMPLET - APPLICATION POINTAGE AGENTS
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLE: profiles (liée à auth.users de Supabase)
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin_app','admin_service','pointeur','assistant_rh','agent')),
  service_id UUID,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: services
-- ============================================================
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  num_ordre INT NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: cellules
-- ============================================================
CREATE TABLE cellules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  code TEXT NOT NULL,
  couleur TEXT DEFAULT '#4A90D9',
  ordre INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(service_id, code)
);

-- ============================================================
-- TABLE: specialites
-- ============================================================
CREATE TABLE specialites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  code TEXT NOT NULL,
  couleur TEXT DEFAULT '#7B68EE',
  ordre INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(service_id, code)
);

-- ============================================================
-- TABLE: roulements
-- ============================================================
CREATE TABLE roulements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  nom TEXT NOT NULL,
  description TEXT,
  longueur_cycle INT NOT NULL CHECK (longueur_cycle > 0),
  date_debut_reference DATE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: roulement_cycles (chaque jour du cycle)
-- ============================================================
CREATE TABLE roulement_cycles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  roulement_id UUID NOT NULL REFERENCES roulements(id) ON DELETE CASCADE,
  index_jour INT NOT NULL CHECK (index_jour >= 0),
  code_pointage TEXT NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(roulement_id, index_jour)
);

-- ============================================================
-- TABLE: agents
-- ============================================================
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  matricule TEXT NOT NULL UNIQUE,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  email TEXT,
  telephone TEXT,
  date_naissance DATE,
  date_embauche DATE,
  type_contrat TEXT CHECK (type_contrat IN ('CDI', 'CDD', 'CFA', 'INTERIM')),
  photo_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: agent_assignments (affectations avec historique)
-- ============================================================
CREATE TABLE agent_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id),
  cellule_id UUID NOT NULL REFERENCES cellules(id),
  specialite_id UUID REFERENCES specialites(id),
  roulement_id UUID REFERENCES roulements(id),
  date_debut DATE NOT NULL,
  date_fin DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Contrainte : une seule affectation active par agent à une date donnée
  -- (enforced via trigger)
  CONSTRAINT check_dates CHECK (date_fin IS NULL OR date_fin >= date_debut)
);

-- ============================================================
-- TABLE: codes_pointage
-- ============================================================
CREATE TABLE codes_pointage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID REFERENCES services(id),
  code TEXT NOT NULL,
  libelle TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type = ANY (ARRAY['Présence'::text, 'Repos'::text, 'Congé'::text, 'Maladie'::text, 'Absence'::text, 'Autre absence'::text, 'Autre présence'::text, 'Autre'::text])),
  bg_color TEXT DEFAULT '#FFFFFF',
  text_color TEXT DEFAULT '#000000',
  is_locked BOOLEAN DEFAULT FALSE,
  is_absence BOOLEAN DEFAULT FALSE,
  is_global BOOLEAN DEFAULT FALSE,
  ordre INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(service_id, code),
  UNIQUE NULLS NOT DISTINCT (service_id, code)
);

-- ============================================================
-- TABLE: pointages (RÉELS)
-- ============================================================
CREATE TABLE pointages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id),
  cellule_id UUID NOT NULL REFERENCES cellules(id),
  date DATE NOT NULL,
  code_pointage TEXT NOT NULL,
  commentaire TEXT,
  is_locked BOOLEAN DEFAULT FALSE,
  saisi_par UUID REFERENCES profiles(id),
  saisi_le TIMESTAMPTZ DEFAULT NOW(),
  modifie_par UUID REFERENCES profiles(id),
  modifie_le TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, date)
);

-- ============================================================
-- TABLE: previsions_absence (THÉORIQUES)
-- ============================================================
CREATE TABLE previsions_absence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id),
  cellule_id UUID NOT NULL REFERENCES cellules(id),
  date DATE NOT NULL,
  code_pointage TEXT NOT NULL,
  commentaire TEXT,
  is_locked BOOLEAN DEFAULT FALSE,
  saisi_par UUID REFERENCES profiles(id),
  saisi_le TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, date)
);

-- ============================================================
-- TABLE: jours_feries
-- ============================================================
CREATE TABLE jours_feries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL UNIQUE,
  libelle TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: convocations
-- ============================================================
CREATE TABLE convocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id),
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('disciplinaire','information','formation','medical','autre')),
  intitule TEXT NOT NULL,
  commentaire TEXT,
  statut TEXT DEFAULT 'planifiee' CHECK (statut IN ('planifiee','realisee','annulee')),
  cree_par UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_pointages_agent_date ON pointages(agent_id, date);
CREATE INDEX idx_pointages_cellule_date ON pointages(cellule_id, date);
CREATE INDEX idx_pointages_service_date ON pointages(service_id, date);
CREATE INDEX idx_previsions_agent_date ON previsions_absence(agent_id, date);
CREATE INDEX idx_agent_assignments_agent ON agent_assignments(agent_id);
CREATE INDEX idx_agent_assignments_service ON agent_assignments(service_id);
CREATE INDEX idx_agent_assignments_active ON agent_assignments(is_active, date_debut, date_fin);
CREATE INDEX idx_convocations_agent ON convocations(agent_id, date);
CREATE INDEX idx_convocations_service ON convocations(service_id, date);
CREATE INDEX idx_roulement_cycles_roulement ON roulement_cycles(roulement_id, index_jour);

-- ============================================================
-- TRIGGER: updated_at automatique
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_services_updated_at BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_cellules_updated_at BEFORE UPDATE ON cellules FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_specialites_updated_at BEFORE UPDATE ON specialites FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_agents_updated_at BEFORE UPDATE ON agents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_agent_assignments_updated_at BEFORE UPDATE ON agent_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_pointages_updated_at BEFORE UPDATE ON pointages FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_previsions_updated_at BEFORE UPDATE ON previsions_absence FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_convocations_updated_at BEFORE UPDATE ON convocations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TRIGGER: unicité affectation active par agent
-- ============================================================
CREATE OR REPLACE FUNCTION check_unique_active_assignment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = TRUE THEN
    UPDATE agent_assignments
    SET is_active = FALSE, date_fin = NEW.date_debut - INTERVAL '1 day'
    WHERE agent_id = NEW.agent_id
      AND is_active = TRUE
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_unique_active_assignment
  BEFORE INSERT OR UPDATE ON agent_assignments
  FOR EACH ROW EXECUTE FUNCTION check_unique_active_assignment();

-- ============================================================
-- RLS (Row Level Security) - bases
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE cellules ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE pointages ENABLE ROW LEVEL SECURITY;
ALTER TABLE previsions_absence ENABLE ROW LEVEL SECURITY;
ALTER TABLE convocations ENABLE ROW LEVEL SECURITY;

-- Policy: lecture pour tous les utilisateurs authentifiés (contrôle fin côté app)
CREATE POLICY "auth_read_all" ON profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_services" ON services FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_cellules" ON cellules FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_agents" ON agents FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_pointages" ON pointages FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_previsions" ON previsions_absence FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_convocations" ON convocations FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================
-- DONNÉES INITIALES
-- ============================================================
INSERT INTO jours_feries (date, libelle) VALUES
  ('2025-01-01','Jour de l''An'),
  ('2025-04-21','Lundi de Pâques'),
  ('2025-05-01','Fête du Travail'),
  ('2025-05-08','Victoire 1945'),
  ('2025-05-29','Ascension'),
  ('2025-06-09','Lundi de Pentecôte'),
  ('2025-07-14','Fête Nationale'),
  ('2025-08-15','Assomption'),
  ('2025-11-01','Toussaint'),
  ('2025-11-11','Armistice'),
  ('2025-12-25','Noël');

INSERT INTO codes_pointage (code, libelle, type, bg_color, text_color, is_global, is_locked, ordre) VALUES
  ('M','Matin','matin','#DBEAFE','#1E40AF',TRUE,FALSE,1),
  ('AM','Après-midi','apres_midi','#D1FAE5','#065F46',TRUE,FALSE,2),
  ('N','Nuit','nuit','#1E1B4B','#E0E7FF',TRUE,FALSE,3),
  ('J','Journée','journee','#FEF3C7','#92400E',TRUE,FALSE,4),
  ('R','Repos','repos','#F3F4F6','#6B7280',TRUE,FALSE,5),
  ('CP','Congé Payé','conge','#FDE68A','#B45309',TRUE,TRUE,6),
  ('CA','Congé Annuel','conge','#FCD34D','#92400E',TRUE,TRUE,7),
  ('AT','Accident Travail','absence','#FEE2E2','#991B1B',TRUE,TRUE,8),
  ('MA','Maladie','absence','#FCE7F3','#9D174D',TRUE,TRUE,9),
  ('FJ','Férié Travaillé','journee','#EDE9FE','#5B21B6',TRUE,TRUE,10);
