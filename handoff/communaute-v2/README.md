# Bundle d'implémentation — tiroirs de la Communauté v2 (LKDV)

Tiroirs **Explorer** (Recherche, Carnets, Clubs, Sorties) et **Création** (Publication, Story, Carnet, Sortie, Kit, Club) de `/communaute`, au système de design de `/compte`.

À placer dans le dépôt sous `handoff/communaute-v2/` (à côté de `handoff/carnet-v2/`), commit sur `main` avant de lancer l'agent. À lancer **après** la fin du chantier carnet-v2 de préférence (voir `00-MISSION.md` § 2 : sinon l'agent fait tout sauf l'enregistrement des nuits).

## Ordre de lecture
1. `00-MISSION.md` : mission, prérequis, décisions prises (dont le tri en menu et les teintes vertes), garde-fous, cas d'arrêt, définition de « fini ».
2. `01-SPEC-PRODUIT.md` : structure des deux tiroirs, comportements transverses, règles de données des 6 formulaires, éléments reportés.
3. `02-DESIGN-ET-COMPOSANTS.md` : composants réels à réutiliser, nouvelles primitives, CSS, interdits.
4. `03-DONNEES-SUPABASE.md` : migrations (brouillons SQL), RPC atomiques, recherche, RLS, tests pgTAP.
5. `04-PLAN-IMPLEMENTATION.md` : phases et ordre de travail.
6. `05-QUALITE-ET-TESTS.md` : portes qualité et tests à écrire.
7. `06-DEPLOIEMENT.md` : GitHub, aperçu, Supabase prod, Vercel prod, iPhone via Xcode, retours arrière.
8. `07-RECETTE.md` : recette aperçu, prod, iPhone et modèle de rapport.
9. `annexes/` :
   - `maquette-communaute.html` : maquette navigable (à ouvrir dans Chrome ; panneau démo à droite) ;
   - `D-document-refonte.md` : les 200 améliorations numérotées (la loi pour le contenu) ;
   - `H-existant-communaute.md` : inventaire du code actuel des deux tiroirs et des 34 écarts ;
   - `J-schema-communaute.md` : audit du schéma Supabase et des flux d'écriture actuels ;
   - `A-design-visuel-compte.md`, `B-interactions-compte.md`, `C-contenus-compte.md` : système `/compte` extrait du code.

## Prompt de lancement (à coller tel quel dans Antigravity)

> Tu es l'agent d'implémentation de LKDV. Ta mission complète est décrite dans `handoff/communaute-v2/` : commence par `handoff/communaute-v2/README.md`, puis lis tous les fichiers dans l'ordre indiqué et toutes les annexes, ainsi que `CLAUDE.md`, `AGENTS.md` et `DESIGN_SYSTEM.md` à la racine. Ouvre la maquette `annexes/maquette-communaute.html` dans Chrome et manipule-la entièrement avant d'écrire du code. Tu travailles en autonomie complète jusqu'à la définition de « fini » de `00-MISSION.md` : implémentation des tiroirs Explorer et Création au système de `/compte`, migrations et RPC Supabase, tests, PR, aperçu Vercel, fusion dans `main`, production Vercel, installation sur l'iPhone via Xcode, recette. Tu ne me poses aucune question avant d'avoir terminé : les décisions non tranchées vont dans `handoff/communaute-v2/JOURNAL.md` avec leur raison. Tu respectes strictement les garde-fous de `00-MISSION.md` § 4 (migrations additives avec rollback, sauvegarde avant la prod, RPC et RLS testées, portes qualité vertes, aperçu avant prod, aucun secret exposé, aucun contenu ni message visible par de vrais utilisateurs) et tu ne t'arrêtes que dans les cas de § 5. À la fin, écris `handoff/communaute-v2/RAPPORT.md` selon le modèle de `07-RECETTE.md`, puis préviens-moi avec le statut, les liens et ce qui reste éventuellement.

## Prérequis côté Tony (à vérifier une fois avant le lancement)
- Antigravity connecté à GitHub avec droit de push sur `main`.
- CLI Vercel connectée à l'équipe `team_lBmtlHsEp3YQAM4hQCaWovPG` (variables d'environnement modifiables).
- Accès Supabase prod : CLI liée au projet `icxyvwzfjbflcbqukpfz` ou `PROD_DB_URL` dans l'environnement de l'agent.
- Mac avec Xcode, compte Apple de l'équipe `QRU99VJUB5`, iPhone branché, déverrouillé, mode développeur actif.
- Workflow `db-backup.yml` déclenchable par l'agent.
