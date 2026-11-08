# Communauté v2 — drapeau, déploiement et retour arrière

## Drapeau

| Variable | Preview | Production | Effet |
|---|---|---|---|
| `NEXT_PUBLIC_COMMUNAUTE_V2` | `true` (posée le 2026-11-08) | `false` par défaut | `true` : la page `/communaute` monte `CommunityExploreSheetV2` et `CreateSheetV2` ; `false` : les tiroirs actuels (`CommunitySectionsDrawer`, `CreateDrawer`) reviennent, sans redéploiement de code. |

`NEXT_PUBLIC_*` est figé au build : changer la valeur impose un redéploiement
(`vercel redeploy` ou nouveau commit). La variable n'est **pas** dans `.env.example`
(fichier protégé par `CLAUDE.md`) ; elle est configurée sur Vercel :
- Preview : valeur `true` créée le 2026-11-08 (projet `kitduvoyageur-1783951966810`,
  équipe `team_lBmtlHsEp3YQAM4hQCaWovPG`) ;
- Production : à poser à `true` **après** application des migrations (voir plus bas).

`DEMO_AUTO_LOGIN=true` a été posé sur Preview le 2026-11-08 uniquement pour la recette
du compte de démonstration (`00-MISSION § 4.8`) ; à retirer/repacer à `false` après la
recette si les aperçus d'autres branches ne doivent pas exposer la connexion démo.

## Ordre de mise en production

1. Sauvegarde : `db-backup.yml` déclenché par l'agent GitHub ou l'API, **artefact
   `sauvegarde-base` présent et daté du jour** obligatoire. Sinon : arrêt (`00 § 5`).
2. Migrations phase 1 (`20261108130001` → `20261108130006`), puis phase 2
   (`20261108130007`, `20261108130008`) après revue. Application idempotente :
   `psql "$PROD_DB_URL" -v ON_ERROR_STOP=1 -1 -f supabase/migrations/<fichier>.sql`.
3. Aligner le registre `supabase_migrations.schema_migrations` (une ligne par version
   appliquée, avec le nom du fichier) : `scripts/db/migrations-alignment.mjs` doit
   ensuite ne plus signaler nos fichiers en `repoOnly`.
4. Fusion de la PR, déploiement production Vercel « Ready », puis
   `NEXT_PUBLIC_COMMUNAUTE_V2=true` sur Production + redéploiement.
5. Recette `07-RECETTE.md` § B, surveillance 30 min (5xx, CSP), advisors Supabase.

## Retour arrière

- Drapeau : `NEXT_PUBLIC_COMMUNAUTE_V2=false` + redéploiement (immédiat, sans
  redéploiement de code si la valeur est changée puis redéployée).
- Migrations : après le premier usage réel, ne rien supprimer ; `.down.sql` uniquement
  pour une migration qui n'a jamais servi (contrôle des données en tête du `.down`).
- La fiche `/sorties/[id]` et la mini-carte restent sans effet tant que le drapeau est
  à `false` (aucun autre écran ne les référence en V1).

## État au 2026-11-08

- **Blocage constaté** : le secret `BACKUP_PASSPHRASE` est absent du dépôt GitHub
  (secrets présents : `SUPABASE_DB_URL`, `CAPACITOR_SERVER_URL`, `GEO_POIS_IMPORT`).
  `db-backup.yml` (run 42482429006) sort vert **sans artifact** : pas de dump.
  Conformément à `00 § 5` et `06 § 3.1`, **aucune migration n'a été appliquée en prod**
  et `NEXT_PUBLIC_COMMUNAUTE_V2` n'est **pas** activé en production. Reprise :
  poser `BACKUP_PASSPHRASE` (Tony), relancer `db-backup.yml`, vérifier l'artefact,
  puis dérouler « Ordre de mise en production » ci-dessus.
