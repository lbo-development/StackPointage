-- Ajout de la pièce jointe PDF aux convocations
-- Documents stockés dans le bucket Supabase Storage : Documents/convocation/{convocation_id}

ALTER TABLE convocations ADD COLUMN IF NOT EXISTS document_url TEXT;
