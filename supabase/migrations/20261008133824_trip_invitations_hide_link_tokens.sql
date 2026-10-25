-- Faille (audit du 8 octobre 2026) : un lecteur d'un voyage, et n'importe
-- qui sur un voyage public, lisait le jeton d'un lien d'invitation
-- (invitee_id nul, réutilisable) puis l'acceptait par
-- respond_trip_invitation(null, token, true) et devenait collaborateur avec
-- le rôle du lien (éditeur compris). Les liens ne sont plus visibles que des
-- éditeurs ; une invitation nominative reste lisible des lecteurs (son jeton
-- ne sert qu'à la personne invitée, vérifié par la fonction).
ALTER POLICY trip_invitations_select ON public.trip_invitations
  USING (
    invitee_id = auth.uid()
    OR public.can_edit_trip(trip_id)
    OR (invitee_id IS NOT NULL AND public.can_read_trip(trip_id))
  );
