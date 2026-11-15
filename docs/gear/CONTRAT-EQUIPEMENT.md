# D04 · Contrat équipement, kilométrage et alertes

Statut : **implémenté en code, migration non appliquée à la production au
2026-11-11**. Les surfaces sont bornées au propriétaire par la RLS ; aucun
calcul ne remplace une donnée absente par zéro.

## Objets et liens

| Objet | Rôle | Source de vérité |
|---|---|---|
| `gear_items` | Inventaire possédé | Table existante, aucune duplication |
| `hike_session_gear` | Objet associé à une séance | `gear_item_id` ajouté, `sport` ajouté |
| `gear_mileage_settings` | Seuil, version, acquittements | Une ligne par objet |
| `gear_alert_history` | Preuve d'alerte | Unique `(gear_item_id, threshold_version)` |
| `gear_components` | Composants d'un vélo | Installation et remplacement en km |
| `gear_sport_defaults` | Matériel proposé par sport | Défaut explicite, jamais imposé |

Le kilométrage n'est **pas** stocké une seconde fois. Il est dérivé :

- d'une séance terminée (`hike_sessions.ended_at`) ;
- de sa distance (`hike_sessions.distance_km`, sinon
  `activity_sessions.distance_m / 1000`) ;
- de son sport (`activity_sessions.sport`, sinon `rando` pour l'historique) ;
- une séance = un `sessionId` : un rejeu ne compte pas deux fois ;
- une correction met à jour la distance de la séance et donc le total, sans
  compensation à écrire ;
- une distance `null` est comptée « sans distance », jamais `0` ;
- une distance `0` est une information réelle, mais n'ajoute rien.

## Seuils et alertes

- `threshold_version` augmente à chaque changement de seuil.
- Une alerte n'est écrite que si le seuil est réellement atteint.
- `gear_alert_history` a une contrainte unique `(objet, version)` : rejouer
  l'acquittement ne crée pas de doublon.
- `dismissed_version` empêche de réafficher la même alerte après « ne plus
  afficher ».
- Changer le seuil crée une nouvelle version, donc une nouvelle alerte
  légitime si le nouveau seuil est franchi.

## Composants vélo

- `installed_at_km` est le kilométrage du vélo au moment de l'installation.
- Sans remplacement, le composant suit le total du vélo.
- Après remplacement, son kilométrage est figé entre installation et
  remplacement.
- Un point d'installation absent laisse le composant « non mesuré ».
- Le remplacement serveur refuse (`no_mileage`) s'il n'existe aucune séance
  éligible : on n'écrit pas un zéro inventé.

## Défauts par sport

`selectDefaultGear` propose, dans cet ordre :

1. l'objet déjà associé à l'activité ;
2. le défaut explicite du sport (`gear_sport_defaults.priority`) ;
3. les autres objets du bon type.

Sports couverts : `rando`, `trail`, `course`, `famille`, `bivouac` →
chaussures ; `velo` → vélo. Les autres sports ne proposent rien plutôt que de
forcer un objet inadéquat.

## Surfaces

- `src/components/compte/drawer/gear/GearAssociationSheet.tsx` : fiche sortie →
  Matériel → associer un vélo ou des chaussures.
- `src/components/compte/drawer/gear/GearMileagePanel.tsx` : fiche matériel →
  kilomètres, seuil, alerte, composants.
- `src/features/gear/domain/*` : moteur pur testé (aucune I/O).
- `src/features/gear/server/*` : lecture/écriture Supabase.
- `/api/gear/[id]/mileage`, `/api/gear/[id]/components`,
  `/api/compte/sorties/[id]/gear/associate` : routes bornées à l'utilisateur.

## Migration et retour arrière

- Migration : `supabase/migrations/20261113120000_gear_mileage_alerts.sql`.
- Rollback : `supabase/migrations_down/20261113120000_gear_mileage_alerts.down.sql`.
- Le backfill de `gear_item_id` ne relie que les noms **uniques** chez le
  propriétaire ; une ambiguïté reste `NULL`.
- Avant application : relire les grants et policies, exécuter sur une copie,
  puis vérifier `gear_items`, `hike_session_gear` et les quatre nouvelles
  tables. Le down supprime les quatre tables et les deux colonnes : il est
  réservé à un arrêt des écritures D04.
