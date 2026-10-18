# Plan d'Implémentation — Globe 3D Personnel & Empreinte du Voyageur LKDV (Scalable Millions d'Utilisateurs)

> **Pour agents & développeurs :** Ce plan applique les standards de développement LKDV. Les étapes utilisent la syntaxe de cases à cocher (`- [ ]`) pour le suivi incrémental.
> **Règle absolue :** ZÉRO modification dans `/compas` (`src/app/compas`, `src/features/compas`).
> **Règle clé utilisateur 1 :** La carte et le globe 3D doivent être **STRICTEMENT rattachés à la personne du compte en question** (données personnelles : ses traces GPS, ses massifs foulés, ses carnets, ses photos d'expédition géolocalisées, son matériel testé, ses stats).
> **Règle clé utilisateur 2 :** **Architecture conçue pour les futurs millions d'utilisateurs** : requêtes spatiales PostGIS GiST par viewport, payload LOD pyramidal (< 5 Ko en vue Globe), Edge Caching, IndexedDB hors-ligne, instanciation GPU Three.js et sécurité PostgreSQL Row Level Security (RLS).
> **Règle design permanente :** Séparation stricte icône ou texte (jamais les deux sur le même contrôle), fidélité Apple HIG et fluidité 60 FPS mobile.

**Objectif :** Créer le moteur 3D d'exploration personnelle à l'échelle planétaire, capable de charger instantanément pour **n'importe lequel des millions d'utilisateurs** son globe d'empreinte spatiale (Z0-Z3) jusqu'au survol cinématique de ses traces GPS en immersion sol (Z15-Z19), de manière fluide et sécurisée.

---

## 1. Architecture Haute Performance & Scalabilité (Millions d'Utilisateurs)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ÉCHELLES DE ZOOM (LOD)                          │
├────────────────────────────────┬───────────────────────────────────────┤
│ Z0 — Z3 : Globe Spatial 3D     │ Payload : < 5 Ko (Centroïdes massifs) │
│                                │ Requête : Aggregated Footprint Summary│
├────────────────────────────────┼───────────────────────────────────────┤
│ Z4 — Z7 : Arcs & Régions       │ Payload : ~15 Ko (Polylignes macro)   │
│                                │ Requête : Massif Bounding Box         │
├────────────────────────────────┼───────────────────────────────────────┤
│ Z8 — Z11 : Massif Actif        │ Payload : ~35 Ko (Liste sorties/POIs) │
│                                │ Requête : PostGIS ST_Intersects BBOX  │
├────────────────────────────────┼───────────────────────────────────────┤
│ Z12 — Z19 : Sentier & Sol 20cm │ Payload : Streamé à la demande        │
│                                │ IGN 20cm + DEM Terrarium + Three.js   │
└────────────────────────────────┴───────────────────────────────────────┘
```

1. **Résolution Dynamique d'Utilisateur Multi-Tenant** :
   - Hook `useUserFootprint(userId?: string)` qui extrait soit l'utilisateur authentifié Supabase (`user.id`), soit le profil cible (`/compte/[userId]`), avec repli immédiat sur le profil démo `@tony_frc` pour le mode invité/test.
   - Zéro dépendance codée en dur.

2. **Indexation Spatiale PostGIS GiST & Requêtes BBOX O(log N)** :
   - Requête via fonction RPC ou API `/api/users/[userId]/footprint?bbox=...&zoom=...`.
   - Utilisation de `ST_Intersects(geom, ST_MakeEnvelope(...))` pour ne jamais saturer la RAM serveur ni le réseau mobile.

3. **Protection & Confidentialité RLS (Row Level Security)** :
   - Politiques PostgreSQL RLS :
     - Propriétaire : accès direct à toutes ses traces (`private`, `tribe`, `public`).
     - Tiers / Visiteur public : filtrage automatique par PostgreSQL (`visibility = 'public'`).

4. **Optimisation GPU & Mémoire Mobile (iOS / Android 60 FPS)** :
   - Three.js loop désactivée en vue Globe ($z < 12$).
   - `InstancedMesh` pour la végétation 3D (1 seul draw call pour 400 conifères).
   - Déchargement préventif des textures mémoire pour éviter `WEBGL_context_lost`.

---

## 2. Inventaire des Éléments Personnels par Niveau de Zoom

### Niveau 1 : Le Globe de l'Aventurier (Zoom 0 à 3 — Échelle Planétaire)
- **Terre 3D avec empreinte de l'utilisateur :** Seuls les pays et massifs foulés par le compte s'illuminent sur le globe.
- **Jalons d'Expéditions personnelles :** Pastilles lumineuses d'empreinte (*FieldSeal*) sur chaque massif exploré (ex pour Tony : Mont-Blanc, Pyrénées, Vercors, Corse, Islande).
- **HUD Télémétrie de Vie de l'Utilisateur :**
  - Identifiant du compte : `@handle` (Voyageur LKDV)
  - Distance totale enregistrée : `X km`
  - Dénivelé positif cumulé : `+Y m D+`
  - Sommets atteints : `Z sommets`
  - Preuves terrain & tracés certifiés : `% certifié`

### Niveau 2 : Territoires & Massifs de l'Utilisateur (Zoom 4 à 6 — Échelle Continentale)
- **Zones d'aventures du compte :** Découpage de ses massifs favoris.
- **Statut hors-ligne / Cache :** Indicateur des massifs sauvegardés localement dans IndexedDB.
- **Compagnons d'itinérance :** Membres de la tribu ayant partagé ces aventures.

### Niveau 3 : Le Massif en Relief 3D (Zoom 7 à 10 — Échelle Massif)
- **Sommets gravis :** Sommets validés par trace GPS (marqués comme conquis).
- **Refuges & Bivouacs expérimentés :** Nuits passées en cabane/refuge avec dates.
- **Ses sorties dans le massif :**
  - Sorties terminées (tracés archivés).
  - Sorties prévues (itinéraires en préparation).

### Niveau 4 : L'Itinéraire GPS Vivant (Zoom 11 à 14 — Échelle Sentier)
- **Tracé GPS réel :** Ligne vectorielle drapée sur le relief DEM haute précision.
- **Ses photos de terrain géolocalisées :** Vignettes circulaires Liquid Glass épinglées aux coordonnées exactes de prise de vue.
- **Ses notes de terrain :** Observations réelles horodatées (*sources, passages délicats*).
- **Observations faune & flore enregistrées :** Espèces identifiées par l'utilisateur.

### Niveau 5 : Immersion Sol & Équipement Embarqué (Zoom 15 à 19 — Haute Définition)
- **Orthophoto IGN 20cm :** Texture officielle drapée sur le relief haute précision.
- **Forêt 3D Three.js :** Conifères et flore plaqués au niveau du sol.
- **Rover Randonneur 3-DOF :** Position sur le sentier avec caméra drone cinématique lissée (LERP).
- **Sac & Matériel testé :** Fiche de l'équipement utilisé lors de cette sortie (*sac, tente, chaussures*) avec retour terrain.
- **Dock & Graphiques synchronisés :** Profil altimétrique réel de sa sortie, pente instantanée, vitesse et altitude IGN.

---

## 3. Décomposition des Tâches d'Implémentation

### Tâche 1 : Moteur de Projection Globe 3D & Caméra Continue
**Fichiers :**
- Modifier : `src/app/carte-3d/Carte3D.tsx`
- Créer : `src/features/carte-3d/lib/globeProjection.ts`
- Test : `tests/carte-3d/globeProjection.spec.ts`

- [x] **Étape 1.1 : Écrire les tests unitaires pour la projection globe (failing tests)**
- [x] **Étape 1.2 : Activer `projection: { type: 'globe' }` avec transition atmosphérique et minZoom: 0.8 / maxZoom: 19.5**
- [x] **Étape 1.3 : Créer les 3 boutons de commande d'échelle Liquid Glass (`ORBITE`, `MASSIF`, `SENTIER`) sans mélange icône+texte**
- [x] **Étape 1.4 : Valider le zoom cinématique fluide sans à-coup**

---

### Tâche 2 : Service d'Empreinte Multi-Utilisateurs & Couche GeoJSON Scalable
**Fichiers :**
- Créer : `src/features/carte-3d/services/userFootprintService.ts`
- Modifier : `src/app/carte-3d/Carte3D.tsx`
- Test : `tests/carte-3d/userFootprintService.spec.ts`

**Interfaces :**
- `userFootprintService.ts` :
  - `fetchUserFootprintSummary(userId: string): Promise<UserFootprintSummary>` (Z0-Z6, < 5 Ko)
  - `fetchUserMassifDetails(userId: string, massifId: string): Promise<UserMassifDetails>` (Z7-Z11)
  - `fetchUserTrailFull(userId: string, trailId: string): Promise<Carte3DTrail>` (Z12-Z19)

- [x] **Étape 2.1 : Écrire les tests du service d'empreinte multi-utilisateurs (mock + live)**
- [x] **Étape 2.2 : Implémenter le service `userFootprintService.ts` avec gestion de cache en mémoire et fallback gracieux**
- [x] **Étape 2.3 : Connecter `Carte3D.tsx` à ce service pour charger dynamiquement le profil utilisateur actif**
- [x] **Étape 2.4 : Valider avec Vitest**

---

### Tâche 3 : Intégration des Traces GPS, Photos & POIs Personnels
**Fichiers :**
- Modifier : `src/app/carte-3d/Carte3D.tsx`
- Test : `tests/carte-3d/userTrailsAndPhotos.spec.ts`

- [x] **Étape 3.1 : Afficher les traces GPS réelles de l'utilisateur actif**
- [x] **Étape 3.2 : Épingler ses photos de carnets géolocalisées sur le relief (au clic : zoom cinématique sur le point de vue)**
- [x] **Étape 3.3 : Afficher ses notes de terrain et espèces observées**
- [x] **Étape 3.4 : Valider l'affichage épuré (icône seule ou texte seul)**

---

### Tâche 4 : HUD & Télémétrie Adaptatifs au Profil
**Fichiers :**
- Modifier : `src/app/carte-3d/Carte3D.tsx`

- [x] **Étape 4.1 : En vue Globe : afficher le passeport d'exploration de l'utilisateur (distance totale, D+, massifs)**
- [x] **Étape 4.2 : En vue Sentier : afficher le matériel embarqué, la pente et l'altitude de sa sortie**
- [x] **Étape 4.3 : Vérifier le masquage automatique du dock inférieur en vue planétaire**

---

### Tâche 5 : Tests de Non-Régression & Validation E2E Maestro
**Fichiers :**
- Modifier : `.maestro/carte-3d.yaml`
- Exécuter la suite complète des 5 flux Maestro

- [x] **Étape 5.1 : Valider `npx vitest run tests/carte-3d/`**
- [x] **Étape 5.2 : Compiler avec `npm run build`**
- [x] **Étape 5.3 : Valider les 5 flux Maestro E2E avec passage Globe $\leftrightarrow$ Sentier**
- [x] **Étape 5.4 : Commiter et déployer sur `origin/main`**
