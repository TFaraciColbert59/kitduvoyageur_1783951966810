# Design — Volet 1 Statistiques Club (Strava + Komoot) & Habilitations Stories

**Date :** 2026-11-23  
**Statut :** Approuvé et implémenté  

## 1. Objectif & Intention
Remplacer complètement l’ancien 1er volet du tiroir club (*Explorer* + sous-volets *Essentiel / Découvrir / Recherche*, ainsi que l’ancien doublon d’onglet 6) par un **volet 100 % Statistiques du club** de niveau **Strava + Komoot**, entièrement branché sur Supabase et adapté dynamiquement à la **hiérarchie du lecteur dans le club** (*Visiteur*, *Membre actif*, *Encadrant / Staff*, *Admin / Fondateur*).  
En parallèle, verrouiller strictement l’affichage et l’usage du bouton **`+ À la une`** aux seuls membres du club réellement habilités en base de données.

## 2. Décisions d’architecture retenues
- **Hiérarchie & permissions stories (Option A)** :
  - Ajout de la colonne `club_members.can_manage_stories boolean NOT NULL DEFAULT false` (migration `add_can_manage_stories_to_club_members`), pré-remplie à `true` pour les fondateurs, admins et modérateurs.
  - Endpoint `PATCH /api/clubs/[id]/members` (`action: 'story_permission'`) réservé aux admins et au fondateur, exposé sous forme de switch dans *Statistiques → Pilotage* et dans la fiche membre (*Cordée*).
  - `canManageClubStories` calculé strictement sur l’utilisateur authentifié + droit DB (`created_by` ou `can_manage_stories = true`), sans aucun fallback texte.
- **Navigation header après suppression d’Explorer (Option 1)** :
  - Le tiroir club passe à **5 onglets principaux** : `0: Statistiques` · `1: Cordée` · `2: Sorties` · `3: Coffre` · `4: Salons`.
  - La pilule **`Cordée des Alpes ▾`** ouvre l’overlay léger `club_switcher` (clubs rejoints + *Fonder un club* + lien `/communaute`).
  - La loupe **`🔍`** (et `⌘K`) ouvre l’overlay `club_search` dédié à la recherche rapide interne au club actif (sorties, membres, kits, matériel, publications).
- **Couche données & sécurité (Supabase)** :
  - Migration `add_club_stats_agg_rpc_and_open_policies` : lecture publique des kits officiels et équipements pour les clubs `privacy = 'open'` + fonction `SECURITY DEFINER` `public.lkdv_club_stats_agg(p_club, p_start)` retournant uniquement des agrégats anonymisés pour les visiteurs et les totaux par membre (respectant `leaderboard_opt_in`) pour les membres actifs.
  - Route `GET /api/clubs/[id]/stats?window=7d|30d|season|all` fail-closed :
    - `visitor` : `memberView = null`, `managementView = null` (vitrine publique uniquement).
    - `member` : `memberView` inclus (ma contribution + classement membres opt-in), `managementView = null`.
    - `staff` / `admin` : `memberView` + `managementView` (santé 30j, rétention, remplissage, présence, rotation coffre, demandes en attente, top encadrants, gestion habilitations stories pour `admin`).

## 3. Structure du Volet 1 (`ClubStatsHubDrawerBody`)
S’appuie sur le design system Liquid Glass Carnet V2 + `recharts` (`AreaChart`, `BarChart`) + `@number-flow/react` (`NumberFlow`) :
1. **0.0 `stats-perf` — Score & Performance** : sélecteur de période (`7 j / 30 j / Saison / Tout`), anneau Score de Performance `/100` à 4 piliers (*Régularité*, *Volume & D+*, *Kits & Entraide*, *Cohésion & Défis*), grille KPI 2×2, courbe d’effort Recharts interactive (`km` / `D+` / `Sorties`), bloc *Ma contribution* (membres) ou CTA *Rejoindre* (visiteurs).
2. **0.1 `stats-events` — Sorties, Terrains & Événements** : bilan organisés / réalisés / à venir / remplissage moyen, empreinte par massif (Komoot), répartition par disciplines, Hall of Fame / Records du club cliquables.
3. **0.2 `stats-kits` — Kits proposés & Coffre matériel** : kits officiels du club (poids moyen de base, ultralégers, accès clonage), graphique horizontal Recharts des catégories du coffre, rotation des prêts et progression des défis collectifs.
4. **0.3 `stats-members` — Efforts membres & Pilotage** : bloc *Pilotage & Santé 30j* (Staff/Admin), classement filtrable & dépliable avec switch *Habilité aux stories à la une* (Admin), ou synthèse communautaire anonymisée (Visiteur).
