# MISSION · Explorer v2 de LKDV, en autonomie totale

Tu es l’agent unique de ce chantier. Tu travailles seul, sans humain, jusqu’à ce que **chaque case de `07_CHECKLIST.md` soit cochée avec une preuve** et que `npm run explorer:verify` sorte en code 0. Tu ne poses **aucune question**. Tu ne t’arrêtes pas pour demander une validation. Tu ne déclares jamais « terminé » sans preuve exécutée.

## 1. Objectif
Remplacer la page `/explorer` par l’Explorer v2 défini par la maquette (`maquette/`, 42 écrans + 3 planches) : carte 3D plein écran, globe → pays → région → lieu, tiroirs à sous-tiroirs, activités en direct pour 9 sports, mode suivi, SOS, hors-ligne, monde entier, données réelles uniquement, performance et sécurité de niveau production, sur web mobile et iOS (Capacitor).

## 2. Ordre de lecture obligatoire (avant toute ligne de code)
1. `01_AUDIT.md` → ce qui existe déjà et doit être réutilisé.
2. `02_ARCHITECTURE.md` → la cible.
3. `03_ECRANS.md` + captures `maquette/captures/*.png` → chaque écran.
4. `04_CARTE.md`, `05_DONNEES.md`, `09_DESIGN.md`.
5. `06_PHASES.md`, `07_CHECKLIST.md`, `08_TESTS.md`.
6. Les skills du dossier `skills/` (installées à l’étape 0).
7. Dans le dépôt : `CLAUDE.md`, `AGENTS.md`, `.agents/skills/lkdv-ios27-page-refonte/SKILL.md`, `docs/DESIGN_SYSTEM.md`.

## 3. Étape 0 (une seule fois)
```bash
git fetch origin && git checkout main && git pull
git checkout -b feat/explorer-v2
mkdir -p docs/explorer-v2/preuves
cp handoff/explorer-v2/modeles/*.md docs/explorer-v2/
for d in .agents/skills .agent/skills; do mkdir -p $d; cp -r handoff/explorer-v2/skills/* $d/; done
npm ci
```
Puis crée `scripts/explorer-v2/verify-all.mjs` et le script npm `explorer:verify` (contenu exigé dans `08_TESTS.md §7`). Commit : `chore(explorer-v2): bootstrap chantier`.

## 4. Boucle de travail (répéter jusqu’à la fin)
1. Ouvre `07_CHECKLIST.md`, prends **le premier point non coché** de la phase en cours (jamais de saut de phase avant la gate).
2. Relis la section de spec liée (référence entre crochets dans la checklist).
3. Cherche d’abord l’existant (`rg`, `01_AUDIT.md`). Réutilise s’il fonctionne et ne ralentit pas. Sinon crée.
4. Implémente le plus petit changement complet.
5. Prouve : exécute les commandes de preuve du point (build, tests, requête SQL, capture Playwright). Copie la sortie réelle dans `docs/explorer-v2/MISSION_LOG.md`.
6. Coche la case `[x]` dans `07_CHECKLIST.md` **dans le même commit** que le code et la preuve.
7. Commit atomique `feat(explorer-v2): <ID> <titre>` puis `git push -u origin feat/explorer-v2` (au moins toutes les 5 cases).
8. À chaque fin de phase : exécute la gate de `06_PHASES.md`. Si rouge, corrige avant de continuer.

Si ton contexte est perdu ou que tu redémarres : relis ce fichier, puis `07_CHECKLIST.md` et les 30 dernières entrées de `MISSION_LOG.md`, et reprends au premier point non coché. Ne refais jamais un point coché sans raison consignée.

## 5. Règles de preuve (anti-hallucination)
- Un point est fait uniquement si une commande réelle le démontre. Pas de « devrait fonctionner ».
- Interdit de cocher sur la base d’une lecture de code seule.
- Toute affirmation sur la BDD se vérifie par `execute_sql` (MCP Supabase) ou `supabase db` : `pg_policies`, `pg_class.relrowsecurity`, `information_schema`.
- Toute affirmation visuelle se prouve par une capture Playwright enregistrée dans `docs/explorer-v2/preuves/`.
- Toute affirmation de performance se prouve par une mesure (Lighthouse CI, trace Playwright, `next build` First Load JS).
- `git grep` de contrôle avant chaque gate : aucune donnée inventée, aucun `TODO`, aucun `#E4501C`, aucune clé secrète.

## 6. Protocole de décision (tu ne demandes jamais)
Quand une question se pose, applique dans l’ordre :
1. La maquette et ces documents disent quoi faire → fais-le.
2. L’existant du dépôt le fait déjà → réutilise-le.
3. Plusieurs options valables → choisis la plus simple, la plus rapide à l’exécution et la plus sûre, réversible de préférence.
4. Une donnée réelle n’existe pas → **masque l’élément** (jamais d’invention), affiche l’état vide prévu, consigne dans `DECISIONS.md`.
5. Un accès manque (clé, compte, service) → contournement gratuit (voir §9) + entrée `BLOCAGES.md`, et tu continues.
Chaque décision non triviale = une ligne dans `docs/explorer-v2/DECISIONS.md`.

## 7. Interdits absolus
- Projet Supabase fantôme `lwrmuggefbmboikjgudc` : jamais une requête ni une migration. Projet actif uniquement : `icxyvwzfjbflcbqukpfz`. Appelle `list_projects` avant tout travail BDD et vérifie l’ID.
- Ne modifie jamais `src/app/compas/**` ni `src/features/compas/**`.
- Couleur `#E4501C` interdite partout.
- Aucune donnée fictive, aucun mock en production, aucun repli silencieux vers un exemple (cf. l’ancien `EXAMPLE_TRAIL`).
- Aucune dépense : budget 0 €. Aucun service payant, aucun essai gratuit avec carte bancaire.
- Aucune clé secrète dans le code, le client ou les logs. `SUPABASE_SERVICE_ROLE_KEY` uniquement côté serveur.
- Aucune migration destructive sur des tables existantes sans sauvegarde et sans `DECISIONS.md`. Jamais de `DROP` sur `trail_segments`, `hiking_routes`, `carnets`, `terrain_reports`, `hike_sessions`.
- Jamais d’appel réel au 112 ni de SMS réel pendant les tests : SOS testé en mode simulé.
- Ne supprime le code legacy de l’Explorer qu’à la phase 10, après la gate finale verte.

## 8. Exceptions approuvées au skill `lkdv-ios27-page-refonte`
Pour `/explorer` uniquement : la carte occupe 100 % de l’écran (pas de split 60/40), le tiroir est une feuille à crans au-dessus de la carte, et un thème sombre existe pour la carte et les tiroirs quand le système est en mode sombre. Toutes les autres règles du skill s’appliquent : sélecteurs en icônes, une seule barre basse, pas de croix ni de voile, matière verre, pas d’orange.

## 9. Contournements gratuits pré-approuvés
| Manque | Contournement |
|---|---|
| Clé Supabase ou MCP Supabase indisponible | `npx supabase start` (Docker local), migrations appliquées en local, tests contre la base locale ; consigner pour application distante |
| Pas d’appareil iOS | Tests `mobile-webkit` Playwright + compilation iOS via le workflow GitHub Actions macOS existant ; Live Activity marquée « compilée, non testée sur appareil » |
| Clé Météo-France absente | Prévisions MET Norway (gratuit, mondial) ; bulletin avalanche masqué |
| Clé OpenRouter absente | Recherche en langage naturel par analyseur de règles déterministe (`05_DONNEES.md §6`) |
| Overpass saturé | Cache BDD existant (`features/explorer-osm`), file d’attente et repli sur les points déjà matérialisés |
| Rust/wasm-pack non installable | Implémentation TypeScript dans le Web Worker (même interface) ; Rust ajouté plus tard |

## 10. Définition de « terminé » (toutes obligatoires)
- 100 % des cases de `07_CHECKLIST.md` cochées, chacune avec une entrée dans `MISSION_LOG.md`.
- `npm run explorer:verify` → code 0 (build, type-check, lint, unit, e2e Explorer v2 sur `mobile-chromium` et `mobile-webkit`, a11y, budgets perf, contrôles grep, RLS).
- Les 42 écrans reproduits : rapport de parité `docs/explorer-v2/PARITE.md` avec capture maquette / capture réelle côte à côte pour chacun.
- Chaque bouton, onglet, mini-sélecteur, cran de tiroir, repère et mouvement de caméra exercé par au moins un test Playwright (inventaire dans `08_TESTS.md §3`).
- Route `/explorer` servie par v2, flag `explorer_v2_enabled` à 100 %, legacy supprimé, bundle mesuré.
- Rapport final `docs/explorer-v2/RAPPORT_FINAL.md` : ce qui est fait, mesures, limites restantes (avec preuve), décisions.
- Branche poussée, PR ouverte vers `main` avec le rapport final en description. Tu ne merges pas.

Tant qu’un seul de ces points est faux, tu continues.
