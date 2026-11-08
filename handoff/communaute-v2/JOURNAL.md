# JOURNAL — chantier Communauté v2

Décisions non tranchées par le bundle, avec date, raison et alternative écartée. Tenu par le Lead.

## 2026-11-08 — Phase 0 : préparation

### J-01. Bundle de handoff non présent dans le dépôt
Le dossier `handoff/communaute-v2/` n'existait pas dans `origin/main` (seuls `carnet-v2` et
`explorer-v2` y sont). Le README demande de le committer sur `main` avant de lancer l'agent.
**Décision** : le bundle est copié dans le worktree `feat/communaute-v2` et voyagera dans la même
PR (premier commit). Raison : la protection de branche est désactivée mais un commit direct sur
`main` redéploierait la prod sans intérêt ; la PR donne un lien direct vers le dossier, comme exigé
par `06 § 1`. Alternative écartée : PR docs séparée (bruit inutile).

### J-02. Worktree propre plutôt que le checkout principal
`kitduvoyageur_1783951966810` est sur un HEAD détaché avec 19 fichiers modifiés non commités
(messagerie, `/compte`, `Info.plist`) issus d'autres chantiers. **Décision** : travail dans un
worktree dédié `/Users/fr168256/Documents/deepseek-harness/default-workspace/lkdv-communaute-v2`,
branche `feat/communaute-v2` depuis `origin/main` (`08993b8`), `npm ci` refait. Raison : portes
qualité mesurées sur une base propre, pas de pollution du diff, pas de risque de committer le
travail d'un autre chantier. Alternative écartée : travailler dans le checkout sale.

### J-03. Prérequis carnet-v2 : code fusionné mais migrations non appliquées en prod
`handoff/carnet-v2/RAPPORT.md` dit TERMINÉ SAUF recette B/C et lancement iPhone ; la PR #154 est
fusionnée (`08993b8`). MAIS le registre de prod (`supabase_migrations.schema_migrations`, 377
lignes) s'arrête à `20261108000000` : les 5 migrations carnet-v2 `20261108100001…000005` ne sont
**pas** enregistrées et `public.carnet_nights` n'existe pas en prod. Le RAPPORT signalait déjà que
l'application en prod n'était pas vérifiée.
**Décision** : ne pas appliquer les migrations carnet-v2 (elles appartiennent à ce chantier, comme
`00 § 2` l'exige). Conséquence assumée : l'étape « Nuits » du formulaire Carnet est masquée
(`create_carnet_v2` conditionne l'écriture à `to_regclass('public.carnet_nights')`), et on note
l'écart dans `RAPPORT.md`. Alternative écartée : les appliquer nous-mêmes (hors mandat, risque de
conflit avec une reprise du chantier carnet-v2).

### J-04. Outillage : pas de CLI GitHub/Vercel/Supabase, pas de psql, pas de Postgres local
Constat machine : `gh`, `vercel`, `supabase`, `psql`, Docker et Postgres sont absents. Sont
disponibles : jeton GitHub dans le trousseau macOS (`git credential fill`), API REST GitHub (curl),
outils MCP `supabase` (SQL prod) et `vercel` (déploiements/variables), Xcode 27.2 et iPhone 16 Pro
appairé. **Décision** :
- GitHub : branches/PR/fusion/workflow_dispatch via l'API REST, jeton lu à la volée sans jamais
  l'écrire dans un fichier, un log ou un rapport.
- Supabase : la base de prod est pilotée par l'outil MCP (`apply_migration` / `execute_sql`), pas
  par `supabase db push`. Les migrations sont écrites pour être idempotentes ; après application,
  le registre est aligné explicitement sur les versions des fichiers (une ligne par fichier, nom du
  fichier) pour que le prochain `fetch-prod-ledger` + `migrations-alignment` reste lisible.
- pgTAP : pas de Postgres local → les tests s'exécutent **uniquement** dans le job CI
  `database-gates` (Postgres 17 éphémère du dépôt). Itérations par pushes sur la branche.
Alternative écartée : branche Supabase (coût horaire, budget 0 €) ; installer Postgres/pgTAP sans
Homebrew (compilation lourde, hors budget temps).

### J-05. Registre de prod en retard sur le dépôt (écart antérieur au chantier)
Le registre prod n'a pas les migrations `20261022*`, `20261023*`, `20261024*`, `20261025*`,
`20261026130000`, `20261028160000`, `20261029120000`, `20261031200000…220000`, ni celles du
2026-11-05/06/07 (sauf `20261107123212`/`123239`/`160000` et `20261108000000`). Certains objets de
ces migrations existent quand même en base (`replace_kit_items`, `can_view_story`…), signe de
passages par le connecteur avec d'autres versions (catégorie « renumbered » du script d'alignement).
**Décision** : ne pas rejouer ces migrations, ne rien nettoyer du registre. Nos migrations sont
écrites pour l'état **réel** constaté (`03` demande de vérifier chaque hypothèse) : colonnes
manquantes ajoutées en `if not exists` (`creation_meta`, `clubs.rules`…), triggers de compteurs
absents remplacés par des recalculs dans nos RPC, et `clubs_privacy_check` posée seulement après
contrôle des valeurs (`open`/`secret` observés). L'écart de registre est documenté dans le rapport
comme suite (dette d'alignement, pas de notre ressort).

### J-06. Baseline CI de `main`
`08993b8` : `LKDV Unified Quality Gates` et `Lighthouse CI` verts ; `Visual Regression — Shell
Mobile` et `ops-alerts` (alerte quotidienne) déjà rouges. Nos portes obligatoires : `quality-gates`
et `database-gates` vertes sur la PR. Le job visuel ne doit pas empirer sur `tests/visual/community-*`.

### J-07. Maquette manipulée
Serveur local `python3 -m http.server 8765` dans `annexes/` ; parcours complet au clavier/souris
(4 volets Explorer, filtres, tri, peek, détails empilés, états chargement/vide/erreur/hors ligne,
rôle invité, 6 types de création, étapes, erreurs de validation, brouillon simulé, glisser pager,
Échap hiérarchisé). 51 captures de repérage dans
`/Users/fr168256/Documents/deepseek-harness/default-workspace/audit-communaute-v2/maquette/`.
Elles serviront de référence pour les comparaisons 390×844 de la recette.

## 2026-11-08 — Livraison : blocage sauvegarde identifié (cas d'arrêt `00 § 5`)

### J-08. `BACKUP_PASSPHRASE` absent : aucune migration en production
Le workflow `db-backup.yml` a été déclenché par l'API GitHub (run `42482429006`, branche
`main`, conclusion verte) mais **aucun artefact `sauvegarde-base` n'a été produit**. Le job
« Secrets présents ? » sort en `ready=false` sans échouer : les secrets repo disponibles sont
`SUPABASE_DB_URL`, `CAPACITOR_SERVER_URL`, `GEO_POIS_IMPORT` — pas `BACKUP_PASSPHRASE`.
C'est exactement le piège documenté par `06 § 3.1` (« le workflow sort alors en vert sans dump »).
**Décision** : conformément à `00 § 5` (accès indispensable manquant) et `CLAUDE.md`
(`BACKUP_PASSPHRASE` reste à Tony, ne pas contourner), on **n'applique aucune migration en
prod**, on ne passe pas `NEXT_PUBLIC_COMMUNAUTE_V2=true` en production, et on ne fait pas de
recette prod. Tout le reste (code, tests, PR, aperçu, installation iPhone, recette partielle)
est mené à son terme ; le RAPPORT contient la séquence exacte de reprise.
Alternative écartée : poser nous-mêmes une passphrase dans les secrets GitHub (contournement
interdit), créer une branche Supabase payante (budget 0 €), faire un dump « maison » sans
chiffrement (viole `06 § 3.1` et exposerait la base).

### J-09. Variables Vercel posées pour l'aperçu
`NEXT_PUBLIC_COMMUNAUTE_V2=true` sur Preview (créée le 2026-11-08, `id i7GWo8a3dUHCr00y`) et
`DEMO_AUTO_LOGIN=true` sur Preview (`id 1vxtBUfiS9UTUlOz`) pour la recette du compte de démo
uniquement. La production reste à `false` tant que la sauvegarde n'existe pas (J-08).
Alternative écartée : poser `NEXT_PUBLIC_COMMUNAUTE_V2` en production tout de suite (V2 cassée
faute de migrations) ; le drapeau est figé au build, il sera posé au moment du feu vert.

### J-10. Revue d'alignement du registre (prochaine étape DB)
Le registre prod (377 lignes, max `20261108000000`) est en retard sur le dépôt pour des
migrations antérieures au chantier ; nos 8 fichiers `20261108130001…130008` doivent apparaître
en `repoOnly` (jamais appliqués) dans `scripts/db/migrations-alignment.mjs`. Cette sortie sera
jointe au RAPPORT comme preuve d'alignement avant application future.
