-- T45 — Index ciblés sur les requêtes chaudes (projection des missions,
-- encaissement, publications) : aucune lecture de journal entier pour la
-- carte compacte ni l'historique (pagination par curseur déjà en place).
CREATE INDEX IF NOT EXISTS progression_events_user_action_idx
  ON public.progression_events (user_id, action_type);

CREATE INDEX IF NOT EXISTS order_encashment_events_order_idx
  ON public.order_encashment_events (order_id);

CREATE INDEX IF NOT EXISTS progression_rule_publications_version_idx
  ON public.progression_rule_publications (version, created_at DESC);
