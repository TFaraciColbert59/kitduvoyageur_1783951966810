# Bus d'Événements Unique — `lkv_events`

## 1. Vue d'Ensemble
Le bus d'événements `lkv_events` constitue la colonne vertébrale événementielle de LKDV. Il relie les modules de création de voyage, de gestion d'équipage, de carnet et de matériel à un flux unifié pour le fil d'activité, le scoring et les notifications push.

---

## 2. Architecture & Schéma SQL

La table `lkv_events` est partitionnée conceptuellement et régie par des index partiels haute performance :

```sql
CREATE TABLE public.lkv_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  visibility text NOT NULL CHECK (visibility IN ('public', 'crew', 'private')),
  crew_id uuid REFERENCES public.crews(id) ON DELETE CASCADE,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '13 months')
);
```

### Rétention & Conformité RGPD
La fonction `purge_expired_lkv_events()` s'exécute automatiquement pour purger tout événement dépassant 13 mois de rétention légale.

---

## 3. Typologie des Événements

| Événement | Acteur | Visibilité | Métadonnées Notables |
|---|---|---|---|
| `trip.created` | Utilisateur connecté | `public` / `crew` / `private` | `title`, `country_code`, `total_days` |
| `trip.phase_changed`| Participant / Capitaine | `crew` / `private` | `previous_phase`, `new_phase` |
| `crew.created` | Créateur d'équipage | `public` / `crew` / `private` | `crew_name`, `theme` |
| `crew.member_joined`| Nouvel arrivant | `crew` | `role`, `joined_via` |
| `journal.published`| Auteur du carnet | `public` | `slug`, `places_count`, `photos_count` |

---

## 4. Consommateurs & Handlers

1. **`activityFeedHandler`** : Injecte les événements publics ou de l'équipage dans le fil de la communauté (`/communaute` et `/activite`).
2. **`scoringHandler`** : Récompense les accomplissements alpins (XP d'équipage, validation d'étapes de trek).
3. **`notificationHandler`** : Avertit les équipiers en temps réel lors de l'ajout d'une dépense commune ou de la publication d'un carnet.
