-- H7.4 — KPI hub 7 jours (service_role uniquement, via endpoint admin).

CREATE OR REPLACE VIEW public.hub_dashboard_kpis AS
SELECT
  (SELECT count(DISTINCT user_id) FILTER (WHERE event_name = 'hub_page_view' AND ts > now() - interval '7 days')::float
     / NULLIF((SELECT count(*) FROM auth.users WHERE last_sign_in_at > now() - interval '7 days'), 0)
  ) AS dau_hub_pct_7d,
  (SELECT count(DISTINCT session_id) FILTER (WHERE event_name = 'hub_nature_changed' AND ts > now() - interval '7 days')::float
     / NULLIF((SELECT count(DISTINCT session_id) FROM public.hub_telemetry WHERE event_name = 'hub_page_view' AND ts > now() - interval '7 days'), 0)
  ) AS switcher_usage_pct_7d,
  (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (t2.ts - t1.ts)))
     FROM public.hub_telemetry t1
     JOIN public.hub_telemetry t2
       ON t2.session_id = t1.session_id
      AND t2.event_name = 'hub_section_visited'
      AND t2.ts > t1.ts
      AND t2.ts < t1.ts + interval '10 minutes'
    WHERE t1.event_name = 'hub_page_view'
      AND t1.ts > now() - interval '7 days'
  ) AS median_time_to_section_seconds_7d,
  (SELECT count(DISTINCT session_id) FILTER (WHERE event_name = 'hub_section_visited')::float
     / NULLIF(count(DISTINCT session_id) FILTER (WHERE event_name = 'hub_page_view'), 0)
   FROM public.hub_telemetry
   WHERE ts > now() - interval '7 days'
  ) AS section_visit_ratio_7d;
