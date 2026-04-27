-- Migration : catalogue d'exports paramétrables
CREATE TABLE IF NOT EXISTS export_catalogues (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom         TEXT NOT NULL,
  service_id  UUID REFERENCES services(id) ON DELETE CASCADE,
  cellule_id  UUID REFERENCES cellules(id) ON DELETE SET NULL,
  date_debut  DATE NOT NULL,
  date_fin    DATE NOT NULL,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION set_updated_at_export_catalogues()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_updated_at_export_catalogues
  BEFORE UPDATE ON export_catalogues
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_export_catalogues();
