# MISSION_LOG — Reconstruction "Mon Matériel" (Liquid Glass)

**Mission** : reconstruire entièrement la page **Mon Matériel** de LKDV, de zéro, selon
`PROMPT_ULTIME_MON_MATERIEL_REBUILD (1).md` (Cockpit Liquid Glass, Apple iOS 26 / WWDC 2025).

**Contraintes** :
- Stack : Next.js 15 (App Router dans `src/app/`), React 19, TS strict, Tailwind, Supabase, Zod, Zustand.
- Palette Sage/Stone/Ink + sémantiques. **Jamais** `#E4501C`.
- RLS sur toutes les tables (filtre `auth.uid()`). Server Components par défaut.
- Bundle client < 40 kB gzip/route. WCAG 2.2 AA.
- Pas de fichiers fantômes (`.bak`, `.old`, `-copy`, `_OLD`…). Un fichier canonique par responsabilité.
- Preuve obligatoire (sortie brute grep/find/build/tsc) collée ci-dessous avant de marquer une phase terminée.

**Décisions (règles d'autonomie)** :
1. **Schéma DB** : exécuter le schéma du prompt LITTÉRALEMENT (tables `kits`, `product_ownership`,
   `kit_items`, `alerts`, `loans`, `share_tokens`) malgré les tables existantes `gear_items`,
   `custom_kits`, `custom_kit_items`, `loans`, `gear_loans`. Collision connue avec les tables
   catalogue presets `kits`/`kit_items` (voir Phase 3, décision D3.1). **Suivi à la lettre.**
2. **Composants** : réécrire depuis le code du prompt (pas réutiliser les fichiers untracked existants).
3. **Route** : `/materiel` (supprimer les références orphelines `/mon-materiel`).
4. **Outil Supabase** : l'environnement ne fournit PAS les outils MCP (`apply_migration`,
   `list_tables`, `get_advisors`). Utilisation du **Supabase CLI** (lié au projet prod
   `icxyvwzfjbflcbqukpfz`). **Projet fantôme à ignorer : `lwrmuggefbmboikjgudc`.**
5. **Adapters repo** : `getSupabaseServerClient` → `createClient()` (async) de `@/lib/supabase/server` ;
   service-role via `process.env.SUPABASE_SERVICE_ROLE_KEY` (pattern repo existant) ;
   `app/` → `src/app/` ; imports via `@/`.

---

## Table des 10 phases

| # | Phase | Statut |
|---|-------|--------|
| 0 | Diagnostic post-suppression & mise en place | EN COURS |
| 1 | Fondations du Design System | PENDING |
| 2 | Composants socles | PENDING |
| 3 | Supabase : schéma, RLS, migrations | PENDING |
| 4 | Page grille `/materiel` | PENDING |
| 5 | 6 plein écrans × 10 widgets | PENDING |
| 6 | Interconnexions natives | PENDING |
| 7 | Accessibilité, performance, hors-ligne | PENDING |
| 8 | Tests & qualité | PENDING |
| 9 | Vérification finale anti-hallucination | PENDING |
| 10 | Livraison | PENDING |

---

## Journal

### PHASE 0 — Diagnostic post-suppression & mise en place

#### Objectif
Vérifier la suppression, nettoyer les références orphelines, auditer l'état Supabase, initialiser le pilotage.

#### Actions
- Branche `feat/materiel-rebuild-liquid-glass` créée depuis `main`.
- Diagnostic fichiers (Phase 0.1) exécuté.
- Recherche des références orphelines `/mon-materiel` dans `sitemap.ts` et `robots.ts`.
- Vérification du projet Supabase lié.

#### Preuve — Phase 0.1 (find/grep)
```
> Get-ChildItem -Path . -Recurse -File | Where-Object { ... -match 'materiel|mon-materiel' }
PROMPT_ULTIME_MON_MATERIEL_REBUILD (1).md
src\app\api\materiel\export\route.ts
src\app\api\materiel\items\route.ts
src\app\api\materiel\kits\route.ts
src\app\api\materiel\kits\[id]\route.ts
src\app\api\materiel\optimize\route.ts
src\app\api\materiel\scan\route.ts
src\lib\materiel\db.ts
src\lib\materiel\events.ts
src\lib\schemas\materiel.ts

> grep (tsx) "mon.?materiel|MonMateriel|GearCard|/materiel"
No files found
```
→ **Aucune page frontend `/materiel` ni `/mon-materiel`** (route absente de `src/app/`). Les seuls
fichiers `materiel` restants sont l'API backend + lib offline (untracked), qui seront RÉÉCRITS selon le prompt.

#### Preuve — Projet Supabase lié
```
> Get-Content supabase\.temp\project-ref
icxyvwzfjbflcbqukpfz
```
→ Projet prod correct. Projet fantôme `lwrmuggefbmboikjgudc` ignoré.

#### Statut
EN COURS (nettoyage orphelins + audit DB à terminer avant Phase 1).

---

<!-- Journal des phases suivantes ajouté ci-dessous -->
