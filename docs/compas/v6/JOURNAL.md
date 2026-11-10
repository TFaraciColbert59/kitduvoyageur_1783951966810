# Compas v6 — journal des preuves

Règle R7 (`docs/compas/SPEC-V6-MOTEUR.md`) : chaque tâche laisse ici la commande lancée, la sortie brute et le commit. Une case de `PLAN-100.md` n'est cochée qu'avec un renvoi vers une entrée de ce journal.

## Écarts à la consigne de lancement, dits une fois

- **Branche** : la consigne demande `claude/compas-v6-moteur`. Cette session cloud est tenue à la branche `claude/new-session-23wse9` (règle de la session : ne jamais pousser ailleurs sans accord explicite). Le chantier vit donc sur cette branche, en PR brouillon vers `main`.
- **Worktrees** : les sous-agents lancés en parallèle écrivent chacun dans des fichiers distincts et nouveaux du même arbre (règle « jamais deux agents sur le même fichier » tenue). Les worktrees sont réservés aux tâches qui modifient du code existant en parallèle.

## Décisions en attente de Tony (section 13 de la spec)

| Id | Question | Bloque | État |
|---|---|---|---|
| D1 | Autoriser l'IA à extraire le Brief | T1.3, porte 1 | en attente |
| D2 | Stockage du monde | phase 4 | en attente |
| D3 | Zones prioritaires de l'import | phase 4 | en attente |
| D4 | Allure réelle sans demander | branchement de T1.5 | en attente |
| D5 | Invariant bloquant non réparé : rendre ou refuser | T3.3 | en attente |

---

## 2026-11-10 — Phase 0, premier lot

### Référence de non-régression avant tout changement (commit `571142e`)

```
$ NODE_OPTIONS=--max-old-space-size=6144 npx tsc --noEmit -p .
tsc exit 0
$ npx vitest run src/features/compas
 Test Files  252 passed (252)
      Tests  5189 passed (5189)
```

Note : sans `--max-old-space-size`, `tsc` s'arrête faute de mémoire sur la machine de la session (« Aborted », code 134). Ce n'est pas une erreur de typage.

### T0.0 — `CLAUDE.md` §1.6 et §1.9 (orchestrateur)

Trailer de commit et modèle de la session principale mis à jour. `git diff --stat` : `CLAUDE.md | 4 ++--`.

### T0.1 — inventaire de ce qui est rangé par voyage (`scout`)

Rendu dans `T0.1-inventaire-voyage-en-base.md`. Trois faits qui pèsent sur la mesure : l'heure de départ de chaque jour n'est jamais écrite ; la météo et les risques sont calculés à la lecture et ne se lisent pas en base ; la durée de préparation n'est pas rangée.

### T0.2 — ADR (orchestrateur)

`ADR-V6-001-architecture.md`, relecture `architect` demandée (résultat consigné dans l'ADR §10).

### T0.3 — 300 demandes avec leur attendu (`builder` × 3 lots, fusion et relecture orchestrateur)

```
$ node scripts/compas/validate-demandes-or.mjs docs/compas/v6/demandes-or.json
famille    {"marche":52,"bivouac":21,"velo":22,"route":20,"ville-culture":30,"plage":25,"ski":20,"alpinisme":20,"escalade":20,"eau":25,"course":21,"multi":24}
duree      {"1h":40,"journee":40,"week-end":70,"semaine":65,"2-semaines":45,"1-mois":40}
langue     {"fr":87,"en":69,"es":50,"de":49,"it":45}
groupe     {"solo":104,"couple":75,"famille":50,"groupe":71}
continent  {"europe":126,"asie":50,"afrique":31,"amerique-nord":32,"amerique-sud":31,"oceanie":30}
saison     {"printemps":71,"ete":107,"automne":54,"hiver":68}
special    {"floues":30,"multi":22}
OK
```

- Aucune phrase reprise des deux jeux de la phase 7 (contrôle à la fusion : liste vide).
- Relecture de 40 demandes tirées au sort (14 du lot A, 26 des lots B et C) : langue, classement et attendu cohérents. Corrections faites à la fusion : la famille « escalade » était à 18 (minimum 20), deux demandes de marche du lot B (D115, D143) réécrites en escalade ; ajout de `attendu.joursTolerance` sur les 157 demandes dont la phrase ne dit pas le nombre de jours (« un week-end » accepte 2 ou 3 jours, « un mois » ± 3).
- Limites dites : la marche est surreprésentée (52) ; les coordonnées attendues sont des repères de test écrits de mémoire, avec un rayon de tolérance — elles ne sont jamais affichées et ne nourrissent pas le moteur (règle R1 non concernée). Un attendu faux se corrige dans le jeu, avec une ligne ici.
- Incident : deux `builder` ont partagé le même dossier temporaire et l'un a écrasé le générateur de l'autre. Les trois fichiers de lot ont été recontrôlés un à un après coup (100 demandes et identifiants attendus dans chacun). Désormais chaque brief nomme un sous-dossier temporaire propre à l'agent.

### T1.2 — lecteurs de réglages hors `tripContext.ts` (`scout`, lancé en avance car indépendant)

Rendu dans `T1.2-lecteurs-reglages.md` : environ 85 lectures directes dans une quinzaine de fichiers, dont 4 recalculs de nuits.

### T1.1 — schéma du Brief et interrupteurs (orchestrateur, lancé en avance car indépendant de D1)

`engine/brief/schema.ts` (11 blocs, 76 variables), `engine/v6Flags.ts`.

```
$ npx vitest run src/features/compas/__tests__/briefSchema.test.ts
 Test Files  1 passed (1)
      Tests  19 passed (19)
```
