# Prompt — Finition à 100 % : Communauté v2 et fiche Carnet v2

Rédigé le 9 novembre 2026 pour Claude Code (session principale Opus, routage `smart-model-router`). À relire en entier au démarrage de chaque session de ce chantier, avant tout appel d'outil.

---

## 0. Mission

Amener **la page Communauté v2** (`/communaute`) et **la fiche Carnet v2** (`/carnets/[id]`) à une fidélité **mesurée** de 100 % à leurs maquettes, dans tous les états, toutes les tailles, les deux thèmes et les deux rôles, sans enfreindre le design système ni les règles de `CLAUDE.md`. Les deux chantiers précédents se sont déclarés « terminés » sans preuve suffisante : ce prompt remplace leurs bilans par une définition vérifiable.

« Parfait » veut dire : **chaque écart observable entre l'app et la maquette est soit corrigé et prouvé par une capture comparée, soit inscrit comme décision de Tony, soit bloqué par un élément que seul Tony peut fournir (nommé).** Rien d'autre.

## 1. Sources de vérité (par ordre de priorité)

1. Les mots de Tony dans la conversation, puis `CLAUDE.md`.
2. **Communauté** : `handoff/communaute-v2/annexes/maquette-communaute.html` (spécification exécutable), `handoff/communaute-v2/*.md`, `docs/audit/communaute-v2-2026-11-08/` (bilans, couverture, écarts, captures de référence `recette/captures-maquette/`).
3. **Carnet** : `handoff/carnet-v2/annexes/maquette-fiche-carnet.html` (spécification exécutable, panneau de démo : rôle, jours, états), `handoff/carnet-v2/01…07-*.md`, `CHECKLIST-100.md`, `ECARTS-MAQUETTE.md`, puis `docs/carnets/PROPOSITION-UI.md` et le document « Refonte page carnet » (https://claude.ai/artifact/CW7XoRopdHgmno5zHAifeD).
4. Design système : `src/styles/tokens.css`, `src/styles/liquid-glass.css`, `DESIGN_SYSTEM.md`, `docs/Design-tokens.md`.

Quand deux sources se contredisent, la plus récente de Tony gagne ; si le doute reste, inscrire la question dans la section « Décisions ouvertes » de `docs/claude/FINITION-SUIVI.md` et continuer le reste.

## 2. Définition de « 100 % » (critères de sortie, tous obligatoires)

Pour **chaque écran et chaque état listés en §4**, aux tailles **360×780, 390×844, 430×932, 768×1024, 1440×900**, en **clair et sombre**, et pour chaque **rôle applicable** (invité, visiteur connecté, participant/propriétaire) :

1. **Capture app** et **capture maquette** produites par le même script Playwright, même viewport, même état (la maquette se pilote par son panneau de démo et son JavaScript).
2. **Comparaison automatique** : différence pixel `maxDiffPixelRatio ≤ 0,02` sur la zone comparable, **et** mesures DOM (positions, tailles, rayons, espacements, typo, couleurs calculées) à ± 1 px / valeur exacte du token. Les zones légitimement différentes (données réelles, carte, avatars) sont masquées et listées.
3. Interactions jouées et assertées : gestes (glisser jours ±, poignées, rubber-band, lentilles), clavier (← → Échap Tab, piège de focus), île dynamique, appui long, `prefers-reduced-motion`, réduction de transparence.
4. Accessibilité : axe-core 0 critique / 0 sérieux, cibles ≥ 44 px (toute dérogation = décision de Tony écrite), contrastes AA mesurés (y compris surtitres sur fond sombre et sur photo), focus visible capturé.
5. Portes : `npx tsc --noEmit -p .` (avec `NODE_OPTIONS=--max-old-space-size=8192`) = 0 ; `npm run lint` = 0 erreur ; tests Vitest concernés verts (comparés à `main` : un rouge préexistant est signalé, jamais masqué) ; `npx next build` ; `npm run perf:budget` ; `npm run verify:invariants`.
6. **Couleurs** : aucune couleur littérale nouvelle, aucune interdite (`#E4501C`, `#1C2620`, `#0B1F17`, `#A3C4A3`, `#2D6B4A`, `#1B4332`…), ombres à base d'encre, jamais `rgba(0,0,0,…)` (l'ombre de l'île `rgba(0,0,0,.35)` est à corriger ou à faire trancher).
7. **Docs réconciliées** : un seul tableau d'état par chantier, chiffres vrais, sans contradiction (le bilan « 0 partiel » contre 23 partiels en couverture, les cases contradictoires de la checklist carnet l.16/l.84, « migrations appliquées » contre « non appliquées » doivent disparaître).

Un critère non mesurable dans cet environnement s'écrit « non testé ici » avec la raison ; il n'est jamais coché.

## 3. Outil n° 1 à construire : le banc de fidélité

Avant toute retouche, construire `tests/fidelity/` (routage : `engineer`) :

- `fidelity.config.ts` : projets Playwright par taille × thème ; serveur app (`next start` sur build avec `NEXT_PUBLIC_COMMUNAUTE_V2=true`, `NEXT_PUBLIC_CARNET_V2=true`, fixtures `NEXT_PUBLIC_SUPABASE_URL=https://fixture.supabase.co` comme `VERIFIER.sh`) ; maquettes servies en fichiers.
- `scenarios/communaute.ts` et `scenarios/carnet.ts` : une entrée par écran × état × rôle, avec la recette pour atteindre l'état **dans l'app** et **dans la maquette**, les masques et les sélecteurs à mesurer.
- `fidelity.spec.ts` : capture, diff pixel (`toMatchSnapshot` contre la capture maquette générée), mesures DOM comparées, rapport JSON + galerie HTML côte à côte avec la carte de différence.
- Baselines **Linux** (celles de macOS ne tournent pas en CI) ; le banc tourne en CI.
- `node scripts/fidelity/report.mjs` produit `docs/claude/FINITION-SUIVI.md` §Scores : taux par écran, liste des écarts restants triés par surface de différence.

Le banc est la seule preuve acceptée d'un écart fermé.

## 4. Inventaire du travail

### 4.1 Communauté v2 (`src/app/communaute/page.tsx`, `src/features/community/v2/`, `src/styles/communaute-v2*.css`)

- **Partiels de `COUVERTURE-200.md`** (23) : Carnets #2 pays, #4 anneau conique, #19 « Tout voir » ; Sorties #8 météo des tuiles, #11 amis inscrits ; Publication #6 bouton Supprimer 30 px → 44 px ; Story #11 choix du jour, #15 compression vidéo, #17 validation à l'étape ; Carnet #8 #10 #11 #13 (nuitées masquées `HAS_CARNET_NIGHTS=false`), #19 file hors ligne, #20 tablist complet ; Sortie #5 (au-delà du GPX), #20 légende ; Kit #5 #9 #10 #17 ; Club #4 mini-carte, #13 aperçu du post.
- **Non faits** (3) : Kit #4 reprendre un kit, Kit #12 prêts, Kit #15 unités.
- **Reportés** (13, `01-SPEC-PRODUIT.md` §6) : rester reportés sauf décision de Tony ; les lister dans le suivi.
- **À vérifier** (`ECARTS-TRANSVERSES.md:266-272`) : contraste des surtitres sur sombre, rayon du focus N12, X2/X3/X5/X10, ombre de l'île, dérogation chips 28 px.
- **États jamais capturés** : Création vide / chargement / erreur ; tout le thème sombre ; 360/430 hors étape 1 et Explorer ; invité au-delà de 4 captures (dont le toast).
- **Bloqués** : FID-078 (données réelles, RPC v2 absentes en production, drapeau `NEXT_PUBLIC_COMMUNAUTE_V2=false` en production) et FID-083 (RDV, météo, filigrane, badge GPS, couvertures Storage) → dépendent de `BACKUP_PASSPHRASE` et de `handoff/communaute-v2/PROD-APPLICATION.md`. Préparer tout le reste ; ne pas contourner.

### 4.2 Carnet v2 (`src/components/carnet/v2/`, `src/app/carnets/[id]/page.tsx`, drapeau `NEXT_PUBLIC_CARNET_V2`)

- **Checklist ouverte** (`handoff/carnet-v2/CHECKLIST-100.md`) : l.27 pastilles de tuiles partielles ; l.29 mode modification et tuile `+` ; l.36 toucher la trace d'un jour change de jour ; l.38 mode contexte du tiroir (carte `saturate(.6) brightness(.97)`, couches réduites au tiroir actif, contrôles masqués) ; l.61 filtres de verdicts ; l.62 pilule « Reprise de lecture » (marquée faite, absente selon `ECARTS-MAQUETTE.md:23/48`) ; l.63 pilule « Reprendre le kit » ; l.71 reduced-motion par composant ; l.76 erreur de slot ; l.77 hors ligne et carte indisponible ; l.78 visiteur (zone floue de 60 px différée au massif, budget, pas de `+`) ; l.79 accès anonyme ; l.84-85 portes finales.
- **Écarts avec la spécification** : Équipage a 3 lentilles (Participants, Réactions, Suivre) — vérifier contre la maquette si « Commentaires » doit exister (19 lentilles dans l'architecture du 07/11) ; menu « Enregistrer » introuvable ; filtrage par jour de chaque lentille à prouver ; un seul état de jour pour la fiche, le tiroir et la carte à prouver ; mini-capsule de jours ; appui long tuiles et « À la une » ; stories des voyageurs depuis la couverture ; île dynamique et Ctrl/⌘+Z.
- **Données démo vides** (nuits, verdicts, altitude `null`, km/D+ par jour) : enrichir les fixtures de test pour que chaque écran plein soit comparable à la maquette pleine ; les états vides restent comparés séparément.
- **Sécurité, avant toute ouverture de l'édition aux participants** : policy `carnet_collab_manage` (auto-inscription en propriétaire) et `auth_manage_carnet_moments` (moment ajouté chez autrui) ; `hike_sessions_select_owner_or_public_carnet` (positions GPS brutes lisibles par un anonyme). Migration + rollback `supabase/migrations_down/` + tests pgTAP, relecture `architect`. `getCarnetDetail.ts:299` ne produit que `participant`/`visitor` : aligner sur le modèle propriétaire / participant / visiteur.

### 4.3 Transverse

- V1 et V2 coexistent (drapeaux). Une fois la v2 prouvée à 100 % et validée par Tony, retirer la v1 (code mort) dans une PR séparée.
- Réconcilier les docs (§2.7) et garder un seul fichier de suivi : `docs/claude/FINITION-SUIVI.md`.

## 5. Décisions ouvertes (à Tony, ne bloquent pas le reste)

1. **Édition du carnet** : la spec `handoff/carnet-v2` (07/11 au soir) met « Modifier le carnet » dans le menu de la pastille titre et un `+` à droite ; la consigne de Tony du 07/11 demandait un crayon rond en haut à gauche, style de la cloche. Par défaut : suivre la spec (implémentée), préparer le crayon derrière un réglage, appliquer dès la réponse.
2. Équipage › « Commentaires » : lentille à part ou dans « Réactions » ?
3. Dérogation chips 28 px de la Communauté (contraire à la règle 44 px) : garder ou passer à 44 px ?
4. Ombre de l'île en `rgba(0,0,0,.35)` : passer à l'encre ?
5. Les 13 points « reportés » de la Communauté : lesquels entrent maintenant ?

## 6. Bloqué par Tony (documenter, ne jamais contourner)

- `BACKUP_PASSPHRASE` (sauvegarde avant migrations de production), accès base de production dans l'environnement d'exécution, variables Vercel `NEXT_PUBLIC_COMMUNAUTE_V2` / `NEXT_PUBLIC_CARNET_V2` en production, URL Storage des couvertures, recette sur iPhone réel.

## 7. Méthode de travail

- **Routage** (`.claude/skills/smart-model-router/SKILL.md`) : banc de fidélité → `engineer` ; retouches d'un écran au périmètre clair → `builder` ; recherche d'écarts dans de nombreux fichiers → `scout` ; migrations, RLS, intégration, arbitrage → session principale ; relecture des migrations et du diff final → `architect`. Au plus 3 agents en parallèle, `isolation: "worktree"` s'ils touchent des zones proches.
- **Boucle** : banc → liste d'écarts triée par surface → lot d'écarts d'un même écran → correction → **le même banc** rejoué → l'écart ne disparaît du suivi que si la capture comparée le prouve.
- **Brief de chaque agent** : objectif, fichiers, écarts exacts (id + capture), contraintes (tokens, 44 px, pas de couleur littérale, pas de commit), critère (banc vert sur ces scénarios + tsc + vitest), compte rendu ≤ 15 lignes.
- **Git** : branche `claude/kind-bell-bfyt69` à jour avec `origin/main` par fusion (jamais de push forcé), commits atomiques par écran ou par lot, trailer de `CLAUDE.md`, aucun test rouge committé ; PR vers `main` quand un chantier atteint ses critères, avec la galerie de preuves.
- **Honnêteté** : chiffres réels, échecs compris ; « fait » = prouvé par le banc ; jamais « 100 % » tant qu'un écart non décidé reste.
- **Suivi** : mettre à jour `docs/claude/FINITION-SUIVI.md` et le document « Refonte page carnet » à chaque lot.

## 8. Ordre d'exécution

1. Banc de fidélité + premier passage complet (scores de départ réels).
2. Sécurité carnet (migrations écrites, testées en pgTAP local, relues) ; application en production seulement si l'accès existe.
3. Carnet : checklist ouverte, puis écarts du banc par surface décroissante.
4. Communauté : partiels, non faits, états jamais capturés, puis écarts du banc.
5. Accessibilité, sombre, tailles, mouvement réduit sur les deux.
6. Réconciliation des docs, PR, galerie finale, liste honnête de ce qui reste (décisions et blocages).
