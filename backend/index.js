import "dotenv/config";
import "./validateEnv.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendDist = join(__dirname, "../frontend/dist");

import authRoutes from "./routes/auth.js";
import agentsRoutes from "./routes/agents.js";
import servicesRoutes from "./routes/services.js";
import pointagesRoutes from "./routes/pointages.js";
import roulementsRoutes from "./routes/roulements.js";
import codesRoutes from "./routes/codes.js";
import convocationsRoutes from "./routes/convocations.js";
import celluleCumulsRoutes from "./routes/cellule-cumuls.js";
import chatRoutes from "./routes/chat.js";
import previsionsRoutes from "./routes/previsions.js";
import exportRoutes from "./routes/export.js";
import exportCatalogueRoutes from "./routes/export-catalogue.js";
import profilesRoutes from "./routes/profiles.js";
import joursFeriesRoutes from "./routes/jours-feries.js";
import statsRoutes from "./routes/stats.js";

const app = express();
const PORT = process.env.PORT || 3001;

// Headers de sécurité HTTP (API JSON pure : CSP et COEP désactivés)
app.use(
  helmet({
    contentSecurityPolicy: false,      // Pas de HTML servi
    crossOriginEmbedderPolicy: false,  // Pas nécessaire pour une API
  }),
);

// CORS restreint aux origines autorisées (FRONTEND_URL en prod, localhost en dev)
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((u) => u.trim());

// En prod (FRONTEND_URL non-localhost), on exige un Origin explicite
const isProd = allowedOrigins.every((o) => !o.includes("localhost"));

app.use(
  cors({
    origin: (origin, callback) => {
      // Pas d'Origin : health check Railway, requête interne ou même domaine
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origine CORS non autorisée : ${origin}`));
      }
    },
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/agents", agentsRoutes);
app.use("/api/services", servicesRoutes);
app.use("/api/pointages", pointagesRoutes);
app.use("/api/roulements", roulementsRoutes);
app.use("/api/codes", codesRoutes);
app.use("/api/convocations", convocationsRoutes);
app.use("/api/cellule-cumuls", celluleCumulsRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/previsions", previsionsRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/export-catalogue", exportCatalogueRoutes);
app.use("/api/profiles", profilesRoutes);
app.use("/api/jours-feries", joursFeriesRoutes);
app.use("/api/stats", statsRoutes);

app.get("/api/health", (req, res) =>
  res.json({ status: "ok", timestamp: new Date() }),
);

// Serve frontend React (prod : même service que le backend)
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("*", (_req, res) => {
    res.sendFile(join(frontendDist, "index.html"));
  });
}

app.use((err, req, res, _next) => {
  console.error(err.stack);
  const status = err.status || 500;
  const message = status < 500 ? err.message : "Erreur serveur interne.";
  res.status(status).json({ error: message });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});
