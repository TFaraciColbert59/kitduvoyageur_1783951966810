Tu es l'agent autonome chargé de finir et d'assainir le Kit Studio de l'application Le Kit du Voyageur. Tu travailles seul, jusqu'au bout, sans point d'étape.

Dépôt : `TFaraciColbert59/kitduvoyageur_1783951966810`, branche `main`, au commit de départ `21a4b11`. Ce bundle se décompresse à la racine du dépôt.

## Avant la première ligne de code

Lis, dans cet ordre : `CLAUDE.md` à la racine du dépôt, puis dans ce bundle `AUDIT-2026-11-07.md`, `CHANTIER-AUTONOME.md`, `spec/moteur-3d-matieres.md`, puis dans le dépôt `docs/kit-studio/REVIEW.md`, `RAPPORT-FINAL.md` et `LEDGER.md`.

`CHANTIER-AUTONOME.md` est ta feuille de route. Il contient les sept phases, leurs portes vérifiables, l'architecture cible et la définition de « terminé ». Exécute-le dans l'ordre, sans sauter de case.

## Trois choses que tu vas lire ailleurs et qui sont fausses

Le dossier `historique/` contient l'audit et le prompt du 5 novembre. Ils ont servi à un premier chantier, **déjà livré et mis en production**. Trois de leurs instructions sont devenues dangereuses :

1. « Le dépôt ne contient aucun Kit Studio : tout est à porter. » **Faux.** Il y a 133 fichiers, 27 438 lignes et 31 suites de tests sous `src/features/kit-studio/`, fusionnés par la PR #142 et vérifiés en production. **Tu ne reconstruis rien.** Tu finis et tu nettoies.
2. « Ajouter `three@0.149.0` exactement. » **Ne le fais pas.** Le dépôt est en `0.186.0` et tout est écrit pour cette version. Rétrograder casse le studio livré et la scène du hub.
3. « Route retenue : `/materiel/studio`. » **Non.** La route livrée est `/kit-studio`. N'en crée pas une troisième.

De `historique/`, ne retiens que deux choses, toujours valables : les 14 constats **C1–C14** de l'audit (ce sont des décisions de portage, ne les rejoue pas) et la **Phase 5 — Vraies données** du plan (c'est la spec de ta phase P1).

## Ce que tu dois obtenir

Un seul Kit Studio, branché sur la vraie donnée, capable de recevoir un élément modélisé en 3D et de lui appliquer le système de matières complet — trame, relief, matière choisie, couleur choisie — sans retouche manuelle.

Aujourd'hui il y en a deux, avec deux modèles de domaine incompatibles. La cible n'est pas d'en supprimer un : c'est de garder **l'interface et le domaine de `/kit-studio`**, qui sont le produit livré, et **la couche de chargement GLB** (`scene/bag/loader.ts`, `scene/bag/parts.ts`, `scene/bag/fabricMaps.ts`, `tools/bag-generator/`), qui recevra les maillages et porte le modèle de manifeste dont les modules ont besoin. Ce qui disparaît, c'est l'interface en double — `scene/BagScene.tsx`, `components/KitStudioView.tsx` — et le second modèle de domaine `state/types.ts`, `state/kitConfiguration.ts`, `state/useKitStudio.ts`. Le détail est en § « Architecture cible » du chantier.

## Méthode

1. Phase par phase. Une phase n'est finie que si **toutes** ses portes passent.
2. Après chaque phase : `npx tsc --noEmit -p .`, `npm run lint`, `npx vitest run src/features/kit-studio src/features/hub`, `npm run build`, `npm run perf:budget`. **Ne commite jamais un test rouge.**
3. Boucle de qualité : test → constat → cause → correction → test de non-régression → rejeu. Un constat n'est fermé que si le **même** test rejoué ne le reproduit plus. Chaque défaut corrigé laisse un test.
4. Ne coche une case qu'avec une **preuve** : sortie de test, capture, requête en base. Colle la sortie, pas un résumé, dans `docs/kit-studio/RAPPORT-CHANTIER.md`.
5. Honnêteté des chiffres. Si une mesure est impossible, écris « non mesuré » et la raison. **N'invente aucun chiffre.** `/hub` dépasse déjà son budget de 171 Ko avant toi : dis-le, ne le cache pas, ne le corrige pas dans ce chantier.
6. Migrations : à blanc d'abord, puis application, puis advisors, chacune avec son rollback dans `supabase/migrations_down/`.
7. Git : branche de travail, puis fusion dans `main` et mise en production selon `CLAUDE.md` §1.6, après les contrôles et une vérification sur l'aperçu Vercel. Si un contrôle de production échoue : retour arrière immédiat, puis compte rendu.

## Quand t'arrêter et demander

Trois cas, et seulement ceux-là :

1. **La cohérence visuelle des objets du catalogue.** 53 objets sur 19 formes sont construits par code. Si les modules LKDV ONE deviennent des maillages photoréalistes, ils voisineront avec des primitives abstraites. Le choix appartient à Tony (voir `spec/moteur-3d-matieres.md` § 5.2).
2. **Un renommage de route.** Il y a des liens, des redirections et une page `noindex` en jeu.
3. **Toute suppression de données irréversible.**

Pour tout le reste : prends la lecture la plus raisonnable, écris laquelle en tête de ton rapport, et continue.

## C'est fini quand

Les six affirmations de la fin de `CHANTIER-AUTONOME.md` sont vraies **et prouvées**, et les huit portes de la phase P6 sont vertes avec leurs sorties dans le rapport.

Commence par la phase P0 : la mesure de départ, sans écrire une ligne de code. Elle donne les valeurs attendues, mesurées au commit `21a4b11` — si tes chiffres en diffèrent, dis-le avant d'aller plus loin.

La phase P2 est déjà faite ; elle reste dans le chantier pour que la numérotation ne bouge pas.
