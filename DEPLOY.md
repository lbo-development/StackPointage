# Déploiement GitHub + Railway — Guide pas-à-pas

## Schéma du déploiement

```
GitHub (1 repo)
├── backend/   → Service Railway "pointage-backend"
└── frontend/  → Service Railway "pointage-frontend"
```

Railway détecte le sous-dossier `backend/` ou `frontend/` comme racine
de chaque service. Les deux services partagent le même repo GitHub.

---

## Étape 1 — Préparer le repo GitHub

```bash
# Dans le dossier pointage/ (racine du projet)
git init
git add .
git commit -m "feat: initial commit pointage agents"

# Créer un repo sur github.com puis :
git remote add origin https://github.com/VOTRE_USER/pointage-agents.git
git branch -M main
git push -u origin main
```

> ⚠️ Vérifier que `.gitignore` exclut bien `.env` avant de pusher.

---

## Étape 2 — Créer le projet Railway

1. Aller sur https://railway.app → **New Project**
2. Choisir **Deploy from GitHub repo**
3. Autoriser Railway à accéder à votre repo GitHub
4. Sélectionner `pointage-agents`

Railway va créer un projet vide. On va y ajouter 2 services manuellement.

---

## Étape 3 — Service Backend

### 3.1 Ajouter le service
Dans le projet Railway :
- Cliquer **+ New Service** → **GitHub Repo**
- Sélectionner `pointage-agents`
- **Root Directory** : `backend`
- Railway détecte automatiquement Node.js et le `railway.json`

### 3.2 Variables d'environnement du backend
Dans le service backend → onglet **Variables** → ajouter :

| Variable | Valeur |
|----------|--------|
| `SUPABASE_URL` | `https://VOTRE_REF.supabase.co` |
| `SUPABASE_SERVICE_KEY` | La clé `service_role` (Supabase > Settings > API) |
| `JWT_SECRET` | Une chaîne aléatoire longue (ex: `openssl rand -hex 32`) |
| `PORT` | `3001` |
| `FRONTEND_URL` | À remplir APRÈS avoir le domaine frontend (étape 4.3) |

### 3.3 Domaine backend
- Onglet **Settings** → **Networking** → **Generate Domain**
- Noter l'URL : `https://pointage-backend-XXXX.railway.app`

---

## Étape 4 — Service Frontend

### 4.1 Ajouter le service
Dans le même projet Railway :
- **+ New Service** → **GitHub Repo**
- Sélectionner `pointage-agents`
- **Root Directory** : `frontend`

### 4.2 Variables d'environnement du frontend
Dans le service frontend → **Variables** :

| Variable | Valeur |
|----------|--------|
| `VITE_API_URL` | `https://pointage-backend-XXXX.railway.app` (URL du backend, étape 3.3) |

> ⚠️ `VITE_API_URL` doit être défini AVANT le build, car Vite l'injecte
> à la compilation. Si vous le changez après, redéployer le frontend.

### 4.3 Domaine frontend
- Onglet **Settings** → **Networking** → **Generate Domain**
- Noter l'URL : `https://pointage-frontend-YYYY.railway.app`

### 4.4 Mettre à jour FRONTEND_URL dans le backend
Retourner sur le service backend → **Variables** → mettre à jour :
```
FRONTEND_URL=https://pointage-frontend-YYYY.railway.app
```
Railway redéploie automatiquement.

---

## Étape 5 — Vérification

```bash
# Health check backend
curl https://pointage-backend-XXXX.railway.app/api/health
# → { "status": "ok", "timestamp": "..." }

# Ouvrir le frontend
open https://pointage-frontend-YYYY.railway.app
```

---

## Déploiements suivants (automatiques)

Une fois configuré, chaque `git push` sur `main` déclenche
automatiquement le redéploiement des deux services via Railway.

```bash
# Workflow quotidien
git add .
git commit -m "fix: ..."
git push origin main
# → Railway redéploie backend et/ou frontend selon les fichiers modifiés
```

Pour désactiver l'auto-deploy : Railway > Service > Settings > Deploy Triggers.

---

## Variables Railway — Récapitulatif complet

### Backend
```
SUPABASE_URL          = https://XXXX.supabase.co
SUPABASE_SERVICE_KEY  = eyJ...  (service_role, PAS anon)
JWT_SECRET            = (chaîne aléatoire 64 chars)
PORT                  = 3001
FRONTEND_URL          = https://pointage-frontend-YYYY.railway.app
```

### Frontend
```
VITE_API_URL          = https://pointage-backend-XXXX.railway.app
```

---

## Problèmes courants

### "CORS error" dans le navigateur
→ `FRONTEND_URL` dans le backend ne correspond pas exactement à l'URL Railway du frontend (attention au `/` final).

### Écran blanc sur le frontend après login
→ `VITE_API_URL` est manquant ou incorrect. Vérifier dans Railway > frontend > Variables, puis **Redeploy**.

### "Token invalide" à chaque requête
→ La `SUPABASE_SERVICE_KEY` utilisée est la clé `anon` au lieu de `service_role`. Vérifier dans Supabase > Settings > API > `service_role`.

### Les routes React donnent 404 au refresh
→ Le fichier `frontend/serve.json` avec le rewrite `/**` → `/index.html` règle ce problème. S'assurer qu'il est bien présent dans le repo.

### Railway ne détecte pas le bon dossier
→ Vérifier que **Root Directory** est bien `backend` ou `frontend` dans Railway > Service > Settings > Source.
