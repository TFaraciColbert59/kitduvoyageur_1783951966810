-- T38 — Retour arrière : retire le moteur d'encaissement et RÉTABLIT les triggers legacy.
-- Les colonnes additives et les journaux restent (aucune destruction).
DROP FUNCTION IF EXISTS public.record_order_encashment_event(text, uuid, text, integer);
DROP TABLE IF EXISTS public.order_encashment_events;
CREATE TRIGGER trigger_process_order_points BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.process_order_points();
CREATE TRIGGER trigger_process_pending_order_points BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.process_pending_order_points();

