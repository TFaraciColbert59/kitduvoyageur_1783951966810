-- Carnet v2 — appliquer la fonction d'accès canonique aux carnets `friends`.
--
-- `can_view_carnet` sait déjà qu'un lecteur autorisé est l'auteur, un
-- collaborateur, un participant, ou un abonné réel de l'auteur. Les policies
-- historiques de `carnets` ne l'appliquaient pas : un carnet `friends` restait
-- illisible même pour l'abonné que la fonction autorise. On ajoute une policy
-- permissive (les policies permissives se cumulent) sans retirer les règles
-- publiques existantes.
--
-- La lecture des sorties suit la même autorisation, mais uniquement pour les
-- sorties explicitement partageables : une sortie `private` d'un carnet
-- `friends` reste lisible par son propriétaire/participants seulement.

drop policy if exists carnets_select_can_view on public.carnets;
create policy carnets_select_can_view on public.carnets
  for select to public
  using (public.can_view_carnet(id));

drop policy if exists hike_sessions_select_shared_carnet on public.hike_sessions;
create policy hike_sessions_select_shared_carnet on public.hike_sessions
  for select to public
  using (
    carnet_id is not null
    and public.can_view_carnet(carnet_id)
    and visibility in ('public', 'collective_anonymized')
  );
