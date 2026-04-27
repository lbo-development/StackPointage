const REQUIRED = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'ANTHROPIC_API_KEY',
];

const missing = REQUIRED.filter((k) => !process.env[k]);

if (missing.length) {
  console.error(
    `[startup] Variables d'environnement manquantes :\n  ${missing.join('\n  ')}\n` +
    'Arrêt du serveur.',
  );
  process.exit(1);
}
