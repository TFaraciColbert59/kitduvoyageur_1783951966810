# Dispatch des modèles et économie de crédits

Coordinateur : **Opus 5.5, effort élevé**. Il lit, décide, délègue, vérifie. Il ne code pas, sauf cas marqué `opus` dans le backlog. Les unités de coût ci-dessous sont des **ordres de grandeur relatifs** pour arbitrer (Haiku = 1), pas des tarifs.

## Les quatre profils
| Profil | Modèle · effort | Coût relatif | Sert à | Plafond de tours |
|---|---|---|---|---|
| `ks-scout`, `ks-scribe`, `ks-ops` | **Haiku** · bas | 1 | Lecture seule et recherche, transcription mécanique de données, i18n, libellés aria, fixtures, lancement de scripts et résumé de leurs sorties, git, PR, CI, captures et comparaisons | 12 |
| `ks-builder` | **Sonnet** · moyen | ≈ 3 | Moteur pur sous TDD, composants UI, stores, services, tests Vitest/Playwright, corrections ciblées | 25 |
| `ks-3d` | **Sonnet** · élevé | ≈ 5 | three.js, gestes, cycle de vie WebGL, performances, physique du tiroir | 40 |
| `ks-reviewer` | **Opus** · élevé | ≈ 15 | Relecture indépendante : architecture, base de données, sécurité, fuites, conformité ; débogage après deux échecs Sonnet | 20 |

Cibles de répartition en **nombre de tours** : Haiku 35 %, Sonnet 55 %, Opus (hors coordinateur) 10 % au plus. Le coordinateur reste léger : sa session ne contient que le backlog, les comptes rendus et les décisions.

## Règle de routage (arbre de décision)
1. La tâche se résume-t-elle à lire, chercher, copier, formater, lancer une commande ou résumer une sortie ? → **Haiku**.
2. Elle écrit du code avec un test qui dit si c'est juste ? → **Sonnet moyen**.
3. Elle touche WebGL, gestes, animations couplées, performance ou cycle de vie ? → **Sonnet élevé**.
4. Elle engage la base de données, la sécurité, l'architecture, ou a échoué deux fois sous Sonnet ? → **Opus**.
5. Un échec n'escalade qu'**une marche à la fois**, et seulement si un test ou une capture prouve l'échec. Pas d'escalade « au cas où ».

## Hygiène de contexte (là où part l'argent)
- Un seul **plan du dépôt** (`docs/kit-studio/REPO-MAP.md`, produit par `ks-scout` en T01) : personne ne ré-explore.
- Brief de sous-agent ≤ 40 lignes : objectif, fichiers à lire (avec plages de lignes), fichiers à écrire, critère d'acceptation, commande de test exacte, plafond de tours. Pas de copie du bundle entier.
- Lectures partielles (`offset`/`limit`) ; jamais le fichier complet de 200 Ko : la maquette se lit **par plage** (voir `audit/INVENTAIRE-MAQUETTE.md`).
- Sorties filtrées : `npx vitest run <fichier> --reporter=dot 2>&1 | tail -30`, `tsc` limité (`| head -40`), pas de `cat` de journaux.
- Captures : une seule par vérification, recadrée et réduite à 800 px de large ; comparaison par script (`pixelmatch`) avant de regarder à l'œil.
- Compte rendu de sortie : ≤ 150 mots (« fait / preuve / reste / risque »). Les détails vont dans le fichier, pas dans la conversation.
- Tâches dimensionnées pour tenir dans ~60 000 jetons de contexte ; au-delà, découper.
- Parallélisme : tout ce qui n'a pas de dépendance part **dans le même message**. Les tâches qui écrivent dans les mêmes fichiers vont chacune dans un worktree (`using-git-worktrees`).
- Relectures : une seule relecture Opus par lot (T22), jamais par tâche.
- Pas de nouvelle exploration web : la documentation utile est dans le bundle ; sinon `context7` (gratuit) pour three.js, Next.js, Capacitor, Playwright.
- Le coordinateur vérifie par **preuve** (sortie de test, capture) et non par relecture du code.

## Grand livre
`docs/kit-studio/LEDGER.md`, une ligne par tâche : `id | modèle·effort | tours | résultat | preuve`. À la fin, le coordinateur calcule la part de tours par modèle et la consigne dans le rapport final.

## Passage d'effort
Chaque fichier d'agent fixe `model` et `effort`. Si l'outil Agent ignore `effort` dans l'en-tête, passer le paramètre `effort` à l'appel (cette consigne vaut demande explicite de Tony).
