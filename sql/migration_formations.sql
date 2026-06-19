-- ============================================================
-- MIGRATION : MODULE FORMATIONS
-- ============================================================

-- ============================================================
-- TABLE: formations (catalogue)
-- ============================================================
CREATE TABLE formations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  libelle TEXT NOT NULL,
  description TEXT,
  frequence_recyclage_mois INT CHECK (frequence_recyclage_mois > 0),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: formation_documents
-- Plusieurs documents par formation (programme, texte réglementaire…)
-- ============================================================
CREATE TABLE formation_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  formation_id UUID NOT NULL REFERENCES formations(id) ON DELETE CASCADE,
  libelle TEXT NOT NULL,
  document_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: profils_formation
-- ============================================================
CREATE TABLE profils_formation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  libelle TEXT NOT NULL,
  description TEXT,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: profil_formation_items
-- Formation dans un profil avec statut d'obligation et fréquence
-- surchargeable (NULL = hérite de la formation)
-- ============================================================
CREATE TABLE profil_formation_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profil_id UUID NOT NULL REFERENCES profils_formation(id) ON DELETE CASCADE,
  formation_id UUID NOT NULL REFERENCES formations(id) ON DELETE CASCADE,
  statut_obligation TEXT NOT NULL CHECK (statut_obligation IN ('obligatoire_gpmm', 'obligatoire_service', 'optionnel_service')),
  frequence_recyclage_mois INT CHECK (frequence_recyclage_mois > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profil_id, formation_id)
);

-- ============================================================
-- TABLE: agent_profil_formation
-- Un seul profil actif par agent (UNIQUE sur agent_id)
-- ============================================================
CREATE TABLE agent_profil_formation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL UNIQUE REFERENCES agents(id) ON DELETE CASCADE,
  profil_id UUID NOT NULL REFERENCES profils_formation(id) ON DELETE RESTRICT,
  date_affectation DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: agent_formations (historique complet des réalisations)
-- Pas de UNIQUE : un agent peut avoir plusieurs entrées par formation
-- (historique + nouvelles réalisations)
-- is_historique distingue les imports Excel des saisies applicatives
-- ============================================================
CREATE TABLE agent_formations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  formation_id UUID NOT NULL REFERENCES formations(id) ON DELETE CASCADE,
  date_prevue DATE,
  date_realisee DATE,
  statut TEXT NOT NULL DEFAULT 'planifiee' CHECK (statut IN ('planifiee', 'realisee', 'annulee')),
  commentaire TEXT,
  document_url TEXT,
  is_historique BOOLEAN DEFAULT FALSE,
  saisi_par UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_formation_documents_formation ON formation_documents(formation_id);
CREATE INDEX idx_profil_formation_items_profil ON profil_formation_items(profil_id);
CREATE INDEX idx_profil_formation_items_formation ON profil_formation_items(formation_id);
CREATE INDEX idx_agent_formations_agent ON agent_formations(agent_id);
CREATE INDEX idx_agent_formations_formation ON agent_formations(formation_id);
-- Pour retrouver rapidement la dernière réalisation par agent/formation
CREATE INDEX idx_agent_formations_agent_formation_date ON agent_formations(agent_id, formation_id, date_realisee DESC NULLS LAST);

-- ============================================================
-- TRIGGERS updated_at
-- ============================================================
CREATE TRIGGER trg_formations_updated_at
  BEFORE UPDATE ON formations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_profils_formation_updated_at
  BEFORE UPDATE ON profils_formation FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_agent_profil_formation_updated_at
  BEFORE UPDATE ON agent_profil_formation FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_agent_formations_updated_at
  BEFORE UPDATE ON agent_formations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE formations ENABLE ROW LEVEL SECURITY;
ALTER TABLE formation_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE profils_formation ENABLE ROW LEVEL SECURITY;
ALTER TABLE profil_formation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_profil_formation ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_formations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_formations" ON formations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_formation_documents" ON formation_documents FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_profils_formation" ON profils_formation FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_profil_formation_items" ON profil_formation_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_agent_profil_formation" ON agent_profil_formation FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_agent_formations" ON agent_formations FOR SELECT USING (auth.role() = 'authenticated');
