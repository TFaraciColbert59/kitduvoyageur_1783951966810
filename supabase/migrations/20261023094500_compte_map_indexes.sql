-- Lecture de la carte du Compte : les 80 sorties récentes d'un utilisateur.
-- Index additif, aucune donnée ni policy modifiée.
create index if not exists idx_hike_sessions_user_started
  on public.hike_sessions (user_id, started_at desc);
