# PHASE 7 — Vérification (Carnet et communauté sans démonstrations)

**Date :** 2026-09-11
**Branche :** `feat/phase7-community-privacy` (`581295be`) → PR #40
**Environnement :** Supabase local + CI ; distant = INSUFFICIENT_DATA (Phase 1)
**Responsable :** agents FRONTEND/BACKEND/DATABASE + ORCHESTRATOR
**Décision :** **PASS (périmètre local)**

---

## 1. Livré

### 1.1 Zéro démonstration
- Toutes les données codées en dur de `/communaute` supprimées (posts `p-1/p-2`, clubs, groupes,
  événements 2026, faux « 12.4k Voyageurs », faux membres en ligne, faux commentaires).
- États vides sobres partout ; section événements branchée sur la **vraie** table `events`
  (inscription réelle `event_participants`).
- `CarnetView`/`CarnetMap` ne synthétisent plus ni trace ni métriques.

### 1.2 Zéro fusion localStorage ↔ serveur
- Lectures/écritures `user_carnets_data` / `user_created_clubs` / `user_created_groups` /
  `user_community_posts` supprimées ; brouillons hérités étiquetés « brouillon local ».
- Échec d'insertion Supabase → erreur affichée ; **plus d'ids fantômes** (`carnet-${Date.now()}`,
  `club-…`, `local-…`, ids invités).

### 1.3 Privé par défaut (opt-in de publication)
- `ALTER COLUMN visibility SET DEFAULT 'private'` (aucune réécriture de données).
- Corrigé UI + API : `CreateCarnetView`, `carnets/page.tsx`, `api/hike-sessions`,
  `queries-trip-completion`, `TripCompletionModal` (`isPublic` opt-in).

### 1.4 Liaison carnet ↔ session ↔ voyage
- `hike_sessions.trip_id` (FK additive + index) ; `carnets.trip_id` alimenté depuis la session
  ou le voyage quand le contexte le fournit.

### 1.5 Snapshot de publication (gate phare)
- Colonnes additives `snapshot_payload`, `snapshot_at`, `snapshot_exclude_location`.
- Trigger `snapshot_community_post_carnet` : copie figée du carnet à l'insertion (sous RLS),
  **immuable sur UPDATE**, champs sensibles retirés (`author_id`, compteurs, visibilité),
  retrait `map_points` optionnel (consentement de prépublication).

## 2. Preuve du gate (pgTAP — 24/24)

```text
1. Publication du carnet privé A -> snapshot copié (titre/description/map_points)
2. UPDATE du carnet privé (titre, description, map_points, updated_at)
3. Relecture -> snapshot INCHANGÉ (titre, description, contenu du post)
4. snapshot_at < carnet.updated_at (la version publiée est bien la version antérieure)
5. UPDATE du post -> snapshot toujours inchangé
6. DELETE du carnet -> snapshot conservé
7. Tiers -> carnet privé d'autrui refusé (RLS)
```

## 3. Preuves locales

| Commande | Résultat |
|---|---|
| `npm run type-check` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run test` | **2068 passed / 27 skipped — 0 failed** (288 fichiers) |
| pgTAP complet | **17 fichiers / 316 tests — PASS** |
| Gate snapshot | 24/24 ok |
| CI PR #40 | checks requis verts + baselines communauté régénérées |

## 4. Limites (honnêtes)

1. Aucune table « stories » : barre remplacée par un état vide.
2. Table `groupes` absente du replay migration pur (drift prod) : cartes → états vides ;
   `/groupes/[id]` n'existe pas et n'a pas été inventé.
3. Modération : signalement via `comment_reports` (pas de table dédiée), pas de file de revue
   admin ; `user_blocks` existe mais n'est pas intégré à la carte post.
4. Prépublication partielle : masquage documents/anonymisation non implémentés (aucun document
   ou personne structuré dans ce flux).
5. Médias : seules les URLs `http(s)` sont persistées.
6. Publications historiques sans snapshot (`NULL`) : non exposées par le nouveau flux ;
   backfill dédié à décider.

## 5. Décision

**PASS local** ; distant **INSUFFICIENT_DATA** (Phase 1).
