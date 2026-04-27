import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

// Clé par utilisateur authentifié, sinon IP normalisée via le helper officiel
const userKey = (req) => req.profile?.id || ipKeyGenerator(req);

export const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  keyGenerator: userKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes IA. Réessayez dans 15 minutes.' },
});

export const exportLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10,
  keyGenerator: userKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop d\'exports. Réessayez dans 5 minutes.' },
});
