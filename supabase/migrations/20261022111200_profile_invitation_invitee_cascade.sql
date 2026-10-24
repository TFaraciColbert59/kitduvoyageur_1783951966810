-- 2026-10-22 — Revue finale C3 : la suppression d'un compte invité doit aboutir.
--
-- `profile_invitations.invitee_id` était `references auth.users(id) on delete
-- set null`. Quand un invité supprimait son compte, la clé étrangère mettait
-- `invitee_id = NULL` sur ses invitations acceptées, ce qui violait la
-- contrainte `profile_invitations_accepted_bound`
-- (`status <> 'accepted' or invitee_id is not null`) : `auth.admin.deleteUser`
-- échouait, et l'effacement RGPD devenait impossible pour quiconque avait
-- accepté une invitation.
--
-- La clé passe en `on delete cascade` : les invitations acceptées par le compte
-- disparaissent avec lui, et la contrainte `accepted_bound` reste satisfaite.
-- La contrainte est supprimée sous son nom réel (`profile_invitations_invitee_id_fkey`,
-- nom généré par la création de la table en 20261022100000) puis recréée.

alter table public.profile_invitations
  drop constraint if exists profile_invitations_invitee_id_fkey;

alter table public.profile_invitations
  add constraint profile_invitations_invitee_id_fkey
  foreign key (invitee_id) references auth.users(id) on delete cascade;
