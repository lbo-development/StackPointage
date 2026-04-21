import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.js';
import agentsRoutes from './routes/agents.js';
import servicesRoutes from './routes/services.js';
import pointagesRoutes from './routes/pointages.js';
import roulementsRoutes from './routes/roulements.js';
import codesRoutes from './routes/codes.js';
import convocationsRoutes from './routes/convocations.js';
import previsionsRoutes from './routes/previsions.js';
import exportRoutes from './routes/export.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/agents', agentsRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/pointages', pointagesRoutes);
app.use('/api/roulements', roulementsRoutes);
app.use('/api/codes', codesRoutes);
app.use('/api/convocations', convocationsRoutes);
app.use('/api/previsions', previsionsRoutes);
app.use('/api/export', exportRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Erreur serveur' });
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});
