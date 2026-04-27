import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // clé SERVICE (pas anon) pour le backend

// Variables garanties présentes par validateEnv.js au démarrage

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});
