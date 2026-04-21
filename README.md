# Pointage Agents — Application de gestion des pointages avec roulements

## Stack
- **Frontend** : React 18 + Vite 5
- **Backend** : Node.js + Express (ESM)
- **Base de données** : Supabase PostgreSQL
- **Auth** : Supabase Auth
- **Déploiement** : Railway

---

## 1. Prérequis

- Node.js >= 18
- Compte Supabase (gratuit suffisant pour dev)
- Compte Railway (pour déploiement)

---

## 2. Installation Supabase

### 2.1 Créer le projet Supabase
1. Aller sur https://supabase.com → New Project
2. Noter : **Project URL** et **service_role key** (Settings > API)

### 2.2 Exécuter le schéma SQL
1. Supabase Dashboard > SQL Editor
2. Coller et exécuter le contenu de `sql/schema.sql`

### 2.3 Créer le premier utilisateur admin
Dans Supabase Dashboard > Authentication > Users > Add User :
- Email : admin@votredomaine.fr
- Password : (choisir)

Puis dans SQL Editor :
```sql
INSERT INTO profiles (id, email, nom, prenom, role)
VALUES (
  '<UUID_de_l_utilisateur_créé>',
  'admin@votredomaine.fr',
  'Admin',
  'Principal',
  'admin_app'
);
```

---

## 3. Lancement en développement

### Backend
```bash
cd backend
cp .env.example .env
# Remplir SUPABASE_URL et SUPABASE_SERVICE_KEY dans .env
npm install
npm run dev
# → http://localhost:3001
```

### Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
# → http://localhost:5173
```

Le proxy Vite redirige automatiquement `/api/*` vers `localhost:3001`.

---

## 4. Structure du projet

```
pointage/
├── sql/
│   └── schema.sql              # Schéma complet PostgreSQL
├── backend/
│   ├── server.js               # Point d'entrée Express
│   ├── supabase.js             # Client Supabase (service_role)
│   ├── .env.example
│   ├── middlewares/
│   │   ├── auth.js             # Vérification JWT Supabase
│   │   └── role.js             # requireRole(), requireServiceScope()
│   ├── services/
│   │   ├── matrixService.js    # Construction matrice + cumuls
│   │   └── roulementService.js # Calcul cycle roulement
│   └── routes/
│       ├── auth.js
│       ├── agents.js
│       ├── services.js
│       ├── pointages.js        # Matrix + saisie unitaire + période
│       ├── roulements.js
│       ├── codes.js
│       ├── convocations.js
│       ├── previsions.js
│       └── export.js           # Export Excel .xlsx
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── .env.example
    └── src/
        ├── main.jsx
        ├── App.jsx             # Router + guards rôles
        ├── index.css           # CSS global (dark theme, IBM Plex)
        ├── context/
        │   └── AuthContext.jsx # Auth + API client + can()
        ├── pages/
        │   ├── LoginPage.jsx
        │   ├── PointageMatrixPage.jsx
        │   ├── AgentsPage.jsx
        │   ├── RoulementsPage.jsx
        │   ├── CodesPage.jsx
        │   ├── ConvocationsPage.jsx
        │   ├── PrevisionsPage.jsx
        │   └── MonEspacePage.jsx
        └── components/
            ├── layout/
            │   └── AppShell.jsx        # Shell + sidebar arborescence
            └── matrix/
                ├── PointageMatrix.jsx  # Tableau central
                ├── ContextMenu.jsx     # Menu clic droit
                ├── PointageModal.jsx   # Saisie unitaire
                └── PeriodeModal.jsx    # Saisie masse
```

---

## 5. Calcul du roulement

Le code théorique pour une date donnée se calcule ainsi :

```js
// date_debut_reference = date de référence du roulement (jour 0 du cycle)
// longueur_cycle       = nombre de jours dans un cycle (ex: 6)
// cycles[]             = tableau de { index_jour, code_pointage }

const msParJour = 24 * 60 * 60 * 1000;
const delta = Math.round((dateCible - dateRef) / msParJour);
//   delta > 0 : date après la référence
//   delta < 0 : date avant la référence

const index = ((delta % longueur) + longueur) % longueur;
// Le double modulo gère correctement les delta négatifs

const code = cycles.find(c => c.index_jour === index).code_pointage;
```

**Exemple** avec longueur=6, référence=2025-01-01, cycle=[M,M,AM,AM,N,R] :
- 2025-01-01 → delta=0, index=0 → M
- 2025-01-03 → delta=2, index=2 → AM
- 2025-01-07 → delta=6, index=0 → M (cycle recommence)
- 2024-12-31 → delta=-1, index=5 → R

---

## 6. Rôles et permissions

| Action | admin_app | admin_service | pointeur | assistant_rh | agent |
|--------|:---------:|:-------------:|:--------:|:------------:|:-----:|
| Voir matrice | ✓ | ✓ | ✓ | ✓ | ✓ |
| Saisir pointage | ✓ | ✓ | ✓ | ✗ | ✗ |
| Saisie période | ✓ | ✓ | ✓ | ✗ | ✗ |
| Gérer agents | ✓ | ✓ | ✗ | ✗ | ✗ |
| Gérer roulements | ✓ | ✓ | ✗ | ✗ | ✗ |
| Gérer codes | ✓ | ✓ | ✗ | ✗ | ✗ |
| CRUD convocations | ✓ | ✓ | ✓ | ✓ | ✗ |
| Gérer services | ✓ | ✗ | ✗ | ✗ | ✗ |
| Export Excel | ✓ | ✓ | ✓ | ✗ | ✗ |

**Restriction service** : admin_service, pointeur, assistant_rh → limités à leur `service_id`.

---

## 7. Déploiement Railway

### 7.1 Backend
1. Nouveau projet Railway → Deploy from GitHub
2. Root directory : `backend`
3. Start command : `npm start`
4. Variables d'environnement à ajouter dans Railway :
   ```
   SUPABASE_URL=...
   SUPABASE_SERVICE_KEY=...
   JWT_SECRET=...
   PORT=3001
   FRONTEND_URL=https://votre-frontend.railway.app
   ```

### 7.2 Frontend
1. Nouveau service Railway → Deploy from GitHub
2. Root directory : `frontend`
3. Build command : `npm run build`
4. Start command : `npx serve dist`
5. Variables :
   ```
   VITE_API_URL=https://votre-backend.railway.app
   ```
6. Mettre à jour `vite.config.js` proxy pour pointer vers l'URL Railway en prod,
   ou simplement utiliser `VITE_API_URL` dans l'API client.

---

## 8. API — Endpoints principaux

### Matrice (endpoint central)
```
GET /api/pointages/matrix?service_id=...&date_debut=YYYY-MM-DD&date_fin=YYYY-MM-DD

Retour :
{
  dates: string[],
  cellules: Cellule[],
  specialites: Specialite[],
  agents: AgentMatrixRow[],
  cumuls: { [cellule_id]: { [date]: { matin, apres_midi, nuit, journee } } },
  feries: string[],
  codesMap: { [code]: CodePointage }
}
```

### Saisie unitaire
```
POST /api/pointages
Body: { agent_id, date, code_pointage, commentaire?, service_id, cellule_id }
```

### Saisie période (n'écrase pas les codes is_locked)
```
POST /api/pointages/periode
Body: { agent_ids[], date_debut, date_fin, code_pointage, service_id }
```

### Export Excel
```
GET /api/export/excel?service_id=...&date_debut=...&date_fin=...
→ Téléchargement .xlsx
```

---

## 9. Évolutions V2 suggérées

1. **Notifications** : alertes email/push pour les convocations
2. **Import Excel** : remplissage de la matrice depuis un fichier
3. **Audit log** : historique complet des modifications
4. **Dashboard RH** : statistiques absentéisme, taux de présence
5. **Multi-roulement par agent** : gestion des changements de poste intra-cycle
6. **Validation hiérarchique** : workflow de validation des absences
7. **Application mobile native** : React Native avec mode hors-ligne
8. **Jours fériés régionaux** : gestion par zone géographique
9. **Compteurs légaux** : décompte CP, RTT, heures sup
10. **API publique** : webhook pour synchronisation RH externe (Silae, Sage…)
