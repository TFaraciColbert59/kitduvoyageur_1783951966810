# 03 — Données et migrations Supabase

Projet prod : ref `icxyvwzfjbflcbqukpfz`. Convention : `supabase/migrations/YYYYMMDDHHMMSS_slug.sql` + rollback `supabase/migrations_down/YYYYMMDDHHMMSS_slug.down.sql`. Dernière migration connue : `20261108000000_perf_p1_rls_initplan_duplicate_indexes.sql` ; prends un horodatage strictement postérieur au dernier fichier présent quand tu commences.

Le SQL ci-dessous est un **brouillon de référence**. Avant d'écrire la migration finale :
1. Relis en base les types réels (`carnets.id`, `carnet_moments.id` : uuid ou bigint ?), les politiques effectives (`select * from pg_policies where tablename in ('carnets','carnet_moments','carnet_likes','carnet_comments','carnet_collaborators','hike_session_participants')`) et les fonctions existantes (`can_view_hike_session`).
2. Aligne-toi sur ces types et sur le style des migrations récentes (idempotence, `security definer` + `set search_path = public` + `revoke execute ... from public`, index sur les FK, initplan `(select auth.uid())`).
3. Valide à blanc sur la base éphémère de la CI (`database-gates`) et en local avant la prod.

## 1. Lot A — fonctions d'accès (prérequis de toutes les politiques)

```sql
-- Participant du carnet : auteur, collaborateur (owner/contributor) ou participant d'une sortie liée.
create or replace function public.is_carnet_participant(p_carnet uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from carnets c where c.id = p_carnet and c.author_id = (select auth.uid()))
      or exists (select 1 from carnet_collaborators cc where cc.carnet_id = p_carnet
                  and cc.user_id = (select auth.uid()) and cc.role in ('owner','contributor'))
      or exists (select 1 from hike_sessions hs join hike_session_participants hp on hp.session_id = hs.id
                  where hs.carnet_id = p_carnet and hp.user_id = (select auth.uid()));
$$;

-- Lecture : participant, ou carnet public, ou 'friends' et l'auteur est suivi (aligne sur la politique SELECT effective de carnets).
create or replace function public.can_view_carnet(p_carnet uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_carnet_participant(p_carnet)
      or exists (select 1 from carnets c where c.id = p_carnet and c.visibility = 'public')
      or exists (select 1 from carnets c join user_follows f on f.following_id = c.author_id
                  where c.id = p_carnet and c.visibility = 'friends' and f.follower_id = (select auth.uid()));
$$;
revoke execute on function public.is_carnet_participant(uuid), public.can_view_carnet(uuid) from public;
grant execute on function public.is_carnet_participant(uuid), public.can_view_carnet(uuid) to authenticated;
```
Vérifie les noms de colonnes de `user_follows` et les blocages (`user_blocks`) : un utilisateur bloqué par l'auteur ne voit pas le carnet si la politique actuelle de `carnets` l'applique déjà ; reproduis-la exactement.

## 2. Lot B — réactions par jour (sous-tiroir « Réactions »)

```sql
create table if not exists public.carnet_day_likes (
  carnet_id uuid not null references public.carnets(id) on delete cascade,
  jour_numero int not null check (jour_numero >= 1),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (carnet_id, jour_numero, user_id)
);
create table if not exists public.carnet_day_comments (
  id uuid primary key default gen_random_uuid(),
  carnet_id uuid not null references public.carnets(id) on delete cascade,
  jour_numero int not null check (jour_numero >= 1),
  author_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 1000),
  parent_id uuid references public.carnet_day_comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists carnet_day_comments_carnet_jour_idx on public.carnet_day_comments (carnet_id, jour_numero, created_at);
alter table public.carnet_day_likes enable row level security;
alter table public.carnet_day_comments enable row level security;
-- lecture : can_view_carnet ; écriture : en son nom et si can_view_carnet ; suppression : auteur du commentaire ou participant propriétaire
```
Politiques : `select using (public.can_view_carnet(carnet_id))` ; `insert with check (user_id/author_id = (select auth.uid()) and public.can_view_carnet(carnet_id))` ; like : `delete using (user_id = (select auth.uid()))` ; commentaire : suppression douce (`update set deleted_at`) par l'auteur, ou par l'auteur du carnet (modération). Notifications : trigger sur le modèle `trg_on_carnet_comment/like` (notifier les participants, jamais soi-même, respecter les préférences). Signalement : réutiliser `comment_reports` (ajoute une valeur de type si la table est typée).

## 3. Lot C — j'aime et commentaires par moment (post)

Le post d'un moment (`CarnetPostSheet`) affiche aujourd'hui les compteurs du carnet. Pour un post identique à `/compte`, crée `carnet_moment_likes (moment_id, user_id, pk)` et `carnet_moment_comments (id, moment_id, author_id, content, parent_id, created_at, deleted_at)` sur le même modèle que le lot B (RLS via le `carnet_id` du moment). « Enregistrer » un moment : réutilise la table d'enregistrements des posts si elle existe (`saved`), sinon `carnet_moment_saves (moment_id, user_id)` lisible par son seul propriétaire.

## 4. Lot D — nuits, verdicts, position en direct

- **Nuits** : `carnet_nights (id, carnet_id, jour_numero, nom, type check in ('refuge','gite','bivouac','hotel','camping','autre'), altitude_m int, infos text, lat double precision, lng double precision, map_refuge_id <type de map_refuges.id> null, created_by, created_at)`, unique `(carnet_id, jour_numero)`. Lecture `can_view_carnet`, écriture `is_carnet_participant`. **Pas de copie des données legacy** : en lecture, si un carnet n'a aucune ligne `carnet_nights`, `getCarnetDetail` retombe sur `groupe_hebergements` (comme aujourd'hui). Garde-fou : coordonnées nulles autorisées, jamais d'erreur de carte sur `null` (règle CLAUDE.md).
- **Verdicts du kit** : `alter table carnet_kit_items add column if not exists verdict text check (verdict in ('essentiel','utile','jamais_servi','defaillant','manquait'))`, `add column if not exists verdict_note text check (char_length(verdict_note) <= 500)`, `add column if not exists jours_utilises int[]`. Écriture `is_carnet_participant`. Lecture : affichage combiné avec `kit_field_reports` des sorties liées si présents (le verdict du carnet prime).
- **« Reprendre ce kit »** : copie dans le kit de l'utilisateur courant via la RPC existante `replace_kit_items` ou l'API du Compas ; aucune nouvelle table si une copie de kit existe déjà (`lkdv_forked_kit_v1` côté client = à remplacer par la persistance serveur existante si elle existe, sinon table `kit_forks (user_id, source_carnet_id, created_at)` + items).
- **Position en direct** : `carnet_live_positions (carnet_id, user_id, lat, lng, accuracy_m, recorded_at, primary key (carnet_id, user_id))` (dernière position seulement, upsert). RLS : `select using (public.is_carnet_participant(carnet_id))`, `insert/update with check (user_id = (select auth.uid()) and public.is_carnet_participant(carnet_id))`. Pour les visiteurs : fonction `security definer` `carnet_public_position(p_carnet uuid) returns table (zone_label text, lat_approx numeric, lng_approx numeric, recorded_at timestamptz)` qui ne renvoie rien si le partage est désactivé (`carnets.live_sharing boolean default false`, ajout additif), arrondit à 0,05° (~5 km), et ne renvoie que des positions **antérieures de 3 h ou plus**. Activation explicite par le participant (Paramètres › Position en direct), désactivée par défaut. Aucune position exacte ne doit jamais atteindre un visiteur (test pgTAP obligatoire). Mise à jour : `@capacitor/geolocation` en avant-plan seulement, au plus toutes les 60 s, jamais en arrière-plan.
- **Budget** : lecture de `trip_expenses` via `carnets.trip_id` pour les participants uniquement (vérifie la RLS de `trip_expenses` ; si elle autorise plus large, filtre côté serveur ET ajoute un test). Visiteur : la lentille n'est pas rendue et l'API ne renvoie pas les montants.

## 5. Lot E — réponses aux stories du carnet

Aucune table : `getOrCreateDirectConversation` + `sendMessage(type 'text', metadata { carnet_moment_reply: { carnet_id, moment_id, author_id } })` sur le modèle de `src/lib/stories/reply.ts`. Respecter la garde de blocage DM (`20261013250000_dm_block_guard`) et les demandes de message (`20261013130000`). Afficher la vignette du moment dans la conversation si la messagerie sait rendre `metadata.story_reply` (ajoute le cas `carnet_moment_reply` au même endroit).

## 6. Tests base de données (obligatoires, `supabase/tests/` pgTAP, joués par `database-gates`)
1. Visiteur ne lit ni moments, ni likes/commentaires de jour, ni nuits d'un carnet **privé**.
2. Visiteur lit ceux d'un carnet **public**, peut aimer/commenter en son nom, ne peut ni supprimer ni écrire au nom d'un autre.
3. Visiteur ne lit **aucune** ligne de `carnet_live_positions` ; `carnet_public_position` renvoie au plus une zone arrondie et ancienne de ≥ 3 h, rien si le partage est off.
4. Visiteur ne lit pas le budget.
5. Participant écrit nuits, verdicts, position ; un non-participant ne le peut pas.
6. Utilisateur bloqué : ne commente pas, ne peut pas envoyer de réponse privée.
7. Les `.down.sql` s'appliquent proprement après les migrations (aller-retour testé).

## 7. Application en production
Voir `06-DEPLOIEMENT.md` § 3 (sauvegarde, ledger, application lot par lot, vérifications, advisors).
