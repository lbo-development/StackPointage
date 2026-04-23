-- Migration : politiques RLS pour l'upload de photos dans le bucket Documents
--
-- Supabase Storage utilise FORCE ROW LEVEL SECURITY sur storage.objects.
-- Même avec la clé service_role, des politiques explicites sont nécessaires
-- pour les opérations d'écriture (INSERT / UPDATE / DELETE).

DROP POLICY IF EXISTS "documents_photo_insert" ON storage.objects;
CREATE POLICY "documents_photo_insert"
  ON storage.objects
  FOR INSERT
  TO service_role, authenticated
  WITH CHECK (
    bucket_id = 'Documents'
    AND (storage.foldername(name))[1] = 'photo'
  );

DROP POLICY IF EXISTS "documents_photo_update" ON storage.objects;
CREATE POLICY "documents_photo_update"
  ON storage.objects
  FOR UPDATE
  TO service_role, authenticated
  USING  (bucket_id = 'Documents' AND (storage.foldername(name))[1] = 'photo')
  WITH CHECK (bucket_id = 'Documents' AND (storage.foldername(name))[1] = 'photo');

DROP POLICY IF EXISTS "documents_photo_delete" ON storage.objects;
CREATE POLICY "documents_photo_delete"
  ON storage.objects
  FOR DELETE
  TO service_role, authenticated
  USING (bucket_id = 'Documents' AND (storage.foldername(name))[1] = 'photo');

DROP POLICY IF EXISTS "documents_photo_select" ON storage.objects;
CREATE POLICY "documents_photo_select"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'Documents' AND (storage.foldername(name))[1] = 'photo');
