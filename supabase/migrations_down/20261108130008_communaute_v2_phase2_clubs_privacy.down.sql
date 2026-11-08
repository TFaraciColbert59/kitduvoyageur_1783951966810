-- Rollback de la PHASE 2 Communauté v2 (20261108130008) :
-- retrait de la contrainte de domaine sur clubs.privacy.
-- Aucune donnée n'est touchée ; les valeurs open/closed/secret restent valides
-- sans contrainte (les policies existantes ne dépendent pas d'elle).

alter table public.clubs drop constraint if exists clubs_privacy_check;
