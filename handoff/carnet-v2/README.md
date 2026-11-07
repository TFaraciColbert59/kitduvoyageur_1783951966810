# Bundle d'implémentation — fiche carnet v2 (LKDV)

À placer dans le dépôt sous `handoff/carnet-v2/` (à côté de `handoff/explorer-v2/`), commit sur `main` ou sur la branche de travail avant de lancer l'agent.

## Ordre de lecture
1. `00-MISSION.md` : mission, décisions prises, garde-fous, cas d'arrêt, définition de « fini ».
2. `01-SPEC-PRODUIT.md` : ce que la fiche fait (écran, 5 tiroirs, 18 sous-tiroirs, post, stories, rôles, états).
3. `02-DESIGN-ET-COMPOSANTS.md` : composants réels de `/compte` à réutiliser, interdits.
4. `03-DONNEES-SUPABASE.md` : migrations (brouillons SQL), RLS, tests pgTAP.
5. `04-PLAN-IMPLEMENTATION.md` : phases et ordre de travail.
6. `05-QUALITE-ET-TESTS.md` : portes qualité et tests à écrire.
7. `06-DEPLOIEMENT.md` : GitHub, aperçu, Supabase prod, Vercel prod, iPhone via Xcode, retours arrière.
8. `07-RECETTE.md` : recette aperçu / prod / iPhone et modèle de rapport.
9. `annexes/` : maquette navigable (`maquette-fiche-carnet.html`, à ouvrir dans Chrome), spécifications extraites du code de `/compte` (A visuel, B interactions, C contenus), inventaire du dépôt (F), derniers retours de Tony (E).

## Prompt de lancement (à coller tel quel dans Antigravity)

> Tu es l'agent d'implémentation de LKDV. Ta mission complète est décrite dans `handoff/carnet-v2/` : commence par `handoff/carnet-v2/README.md`, puis lis tous les fichiers dans l'ordre indiqué, ainsi que `CLAUDE.md`, `AGENTS.md` et `DESIGN_SYSTEM.md` à la racine. Tu travailles en autonomie complète jusqu'à la définition de « fini » de `00-MISSION.md` : implémentation, migrations Supabase, tests, PR, aperçu Vercel, fusion dans `main`, production Vercel, installation sur l'iPhone via Xcode, recette. Tu ne me poses aucune question avant d'avoir terminé : les décisions non tranchées vont dans `handoff/carnet-v2/JOURNAL.md` avec leur raison. Tu respectes strictement les garde-fous de `00-MISSION.md` § 3 (migrations additives avec rollback, sauvegarde avant la prod, RLS testée, portes qualité vertes, aperçu avant prod, aucun secret exposé, aucun message à de vrais utilisateurs) et tu ne t'arrêtes que dans les cas de § 4. À la fin, écris `handoff/carnet-v2/RAPPORT.md` selon le modèle de `07-RECETTE.md`, puis préviens-moi avec le statut, les liens et ce qui reste éventuellement.

## Prérequis côté Tony (à vérifier une fois avant le lancement)
- Antigravity connecté à GitHub avec droit de push sur `main` du dépôt.
- CLI Vercel connectée à l'équipe `team_lBmtlHsEp3YQAM4hQCaWovPG` (variables d'environnement modifiables).
- Accès Supabase prod : CLI liée au projet `icxyvwzfjbflcbqukpfz` ou `PROD_DB_URL` disponible dans l'environnement de l'agent.
- Mac avec Xcode, compte Apple de l'équipe `QRU99VJUB5` connecté, iPhone branché, déverrouillé, mode développeur actif.
- Workflow `db-backup.yml` déclenchable par l'agent.
