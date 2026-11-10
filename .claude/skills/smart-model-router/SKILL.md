---
name: smart-model-router
description: Routage intelligent des modèles pour le dépôt LKDV. Décide, pour chaque sous-tâche de développement (recherche, édition, implémentation, débogage, revue, migration), si la session principale la fait elle-même ou la délègue à un agent du dépôt (scout, chore, builder, engineer, architect), avec quel brief, quand paralléliser, quand escalader, et seulement quand la délégation rapporte vraiment (contexte, parallélisme, volume) plutôt que par principe.
when_to_use: Avant le premier appel d'outil d'une tâche qui lit, modifie, teste ou audite du code LKDV, ou qui se découpe en sous-tâches. Exemples - "implémente", "corrige", "trouve où", "inventorie", "audite", "refactore", "ajoute des tests", "lance la boucle phase 7", "migre".
user-invocable: true
---

# Smart Model Router — LKDV

Version dépôt du skill de compte `model-router`, adaptée aux agents de `.claude/agents/` et corrigée par les mesures du 03/11/2026 (`docs/claude/MODEL-ROUTER-VALIDATION.md`). La grille compacte vit aussi dans `CLAUDE.md` §1 point 9, car un skill n'est pas chargé automatiquement : ce fichier garde le détail.

Tu es l'orchestrateur (session principale, Opus high). Tu ne changes pas ton propre modèle ; le seul levier est la **délégation** à un agent qui porte son propre `model` et `effort`. Les règles dures de `CLAUDE.md` priment sur tout ce qui suit.

## 1. Les exécutants

| Exécutant | Modèle · effort | Outils | Pour |
|---|---|---|---|
| **toi** | Opus · high | tous | Commande courte, petite édition, réponse déjà en contexte, architecture, sécurité/RLS, migration, finances, concurrence, intégration finale, relecture d'un diff sensible |
| `scout` | Haiku · low | lecture seule | Recherche qui lit **plusieurs fichiers ou ramène > ~100 lignes** : inventaire, tous les appelants, classement, cartographie, résumé de docs (`ETAT.md`, `CONSTATS.md`, preuves) |
| `chore` | Haiku · low | édition | Transformation mécanique entièrement spécifiée : renommage, imports, typo, doc simple, formatage. Jamais de logique métier |
| `builder` | Sonnet · medium | édition | Code + tests au périmètre clair (un ou deux modules) : composant React/TS, moteur pur `features/*/engine/`, correctif classique, tests Vitest |
| `engineer` | Sonnet · high | édition | Multi-modules, débogage dur (reproduire → isoler → corriger), perf, backend/API/données, tests d'intégration, revue approfondie. Escalade de `builder` |
| `architect` | Opus · high | lecture seule | **Rare** : second regard indépendant sur un changement à fort impact, ou échec persistant après escalade |

Si les agents du dépôt ne sont pas visibles (session ouverte avant leur création : ils ne se rechargent pas à chaud), utilise `general-purpose` en passant `model` (`haiku` / `sonnet` / `opus`) à l'appel, avec les mêmes correspondances.

## 2. Décider : moi ou un agent ?

Avant le premier appel d'outil, tranche explicitement « moi » ou « tel agent ». Évalue silencieusement : raisonnement (mécanique → transversal), risque (local réversible → données, argent, production), périmètre (quantité ≠ difficulté : 40 renommages restent mécaniques, une ligne de RLS est critique), vérifiabilité (tsc, Vitest, lint).

**Fais toi-même** si l'un de ces cas s'applique :
- ≤ 3 appels d'outils, ou un seul grep / une seule commande suffit ;
- la réponse est déjà dans ton contexte ;
- architecture, sécurité, RLS, migration (`supabase/migrations` + `migrations_down`), Stripe, concurrence, arbitrage critique ;
- un contrôle **existant** et déterministe (`npx tsc --noEmit -p .`, `npx vitest run …`, `npm run lint`, build, `perf:budget`) : lance-le en Bash, ne paie pas un agent pour le lire ;
- le contexte nécessaire ne se résume pas en un brief court.

**Délègue** si la sous-tâche correspond à une ligne de la table **et** qu'au moins un gain est réel :
- **volume** : le travail délégué est grand devant le brief (lecture de dizaines de fichiers, implémentation + tests complète) ;
- **contexte** : les sorties brutes (logs Playwright, résultats de jeux de phrases, inventaires) pollueraient ta fenêtre alors que seule la conclusion compte ;
- **parallélisme** : plusieurs travaux indépendants à mener en même temps.

**Pourquoi ce double critère** : la validation a mesuré que, sur des tâches moyennes, déléguer coûtait **+8 à +11 %** (brief + relecture du compte rendu) pour **−6 à −14 %** de durée. La délégation n'est donc pas une économie automatique ; elle se justifie par le volume, le contexte préservé ou le parallélisme. N'annonce jamais d'économie chiffrée sans mesure.

**Garde-fou** : si tu as choisi « moi » et que tu dépasses 3 appels d'outils, ou que ton approche échoue (outil refusé, script qui ne suffit pas, résultat partiel), arrête la main et re-route la suite vers l'agent adapté, avec ce que tu as appris dans le brief. Écrire un script d'inventaire n'est pas un « contrôle existant » : c'est du travail de `scout`.

## 3. Correspondances LKDV fréquentes

| Situation | Routage |
|---|---|
| Démarrage de session : lire `ETAT.md`, `PLAN-100.md`, `phase7/CONSTATS.md` | `scout` si les fichiers sont longs et que seule la liste des cases `[ ]`/`[~]` compte ; sinon toi |
| Lire les résultats d'un jeu de phrases ou d'un banc Playwright | `scout` (synthèse : taux, échecs avec preuves) ; toi pour la décision |
| Constat phase 7 : reproduire, corriger, test de non-régression dans `phase7Constats.test.ts` | `engineer` (pipeline de lecture, plusieurs modules) ; `builder` si la cause est déjà isolée dans un moteur pur |
| Regex (`intent.ts`, `intentWords.ts`, `places.ts`) | agent d'édition, avec la consigne explicite « regex via l'outil Edit, jamais heredoc/sed » |
| Refonte de style Liquid Glass d'une page | `builder` (ou agents `pays-*` dédiés quand ils correspondent) ; conformité grep par `scout` |
| Migration, policy RLS, fonction `SECURITY DEFINER` | toi, puis `architect` en relecture indépendante avant production (`CLAUDE.md` §6) |
| Fusion dans `main`, mise en production, retour arrière | toi (contrôles, aperçu, `perf:budget`) |

## 4. Orchestration

- **Parallélisme** : uniquement des travaux indépendants, **3 agents maximum** au départ, envoyés dans le même message ; longues exécutions en arrière-plan.
- **Conflits** : deux agents qui éditent des zones proches → `isolation: "worktree"`, puis intégration par toi. Jamais de `git stash` nu.
- **Pas de lecture en double** : donne dans le brief chemins, lignes et contrats déjà connus ; ne relis pas ce qu'un agent a prouvé, sauf changement sensible.
- **Agents sans commit** : sauf mention, les agents ne committent ni ne poussent ; c'est toi qui commits après les contrôles (trailer de `CLAUDE.md`).

### Brief type

```
Objectif : <résultat attendu, une phrase>
Fichiers : <chemins précis, lignes si connues>
Contexte : <contrats, décisions prises, ce qui est déjà vérifié>
Contraintes : <ne pas toucher X ; règles CLAUDE.md utiles (regex via Edit, tokens --lkv-*, RLS…) ; pas de commit/push>
Critères de réussite : <commandes qui doivent passer, comportement attendu>
Compte rendu : ≤ 15 lignes — fichiers modifiés, sortie des contrôles, doutes.
```

## 5. Escalade

`scout` / `chore` → `builder` → `engineer` → toi → (`architect` si un regard indépendant apporte quelque chose).

- Escalade **sur preuve** : test rouge inexpliqué, compte rendu incohérent, sortie de périmètre, ou l'agent dit dépasser son niveau.
- Transmets l'échec constaté et ce qui a été essayé. **Jamais deux fois la même tentative sans nouvelle hypothèse.**

## 6. Qualité (l'économie ne remplace jamais la qualité)

1. Vérifier contrats et dépendances avant d'écrire.
2. Implémenter avec l'exécutant choisi.
3. Lancer toi-même les contrôles : `npx tsc --noEmit -p .` puis `npx vitest run src/features/compas` (ou `npm run test:unit` si large), lint, build si besoin.
4. Corriger (re-déléguer ou escalader), relancer **le même** contrôle.
5. Sensible (sécurité, données, migrations, argent, API publique) : relire toi-même le diff réel.
6. Ne finir qu'avec les critères satisfaits ; sinon nommer le blocage. Jamais de test rouge committé.

## 7. Honnêteté

- Ne prétends pas avoir changé de modèle principal.
- Le modèle réellement servi d'un agent se lit dans `/tasks` ou dans `~/.claude/projects/<projet>/<session>/subagents/agent-*.jsonl` (`message.model`, `effort`). Une liste `availableModels` d'organisation peut substituer un modèle : signale-le.
- Mentionne en une ligne dans le compte rendu qui a fait quoi (toi / agent, modèle).
