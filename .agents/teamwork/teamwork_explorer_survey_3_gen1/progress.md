# Progress — Survey Explorer 3 (gen1)

Last visited: 2026-11-13T20:38:00Z
Status: Survey completed, verified dry-run on live PostgreSQL database. Handoff report drafted.

- [x] Verified exact demo account specifications (`d5451f35-db9f-4575-9114-6d3b79550bbc`, `demo@lkdv.app`, Léa Fontaine) in `/api/demo-login`, `/connexion`, `user_profiles`, and foreign key relations.
- [x] Complete codebase inventory of mock constants and occurrences (`DEMO_*`, `_MOCK_*`, `CLUB_PRESETS`, `Mathieu Chevrier`, fake highlights, `no_image.png`, `Alpes`/`Écrins` hardcoded data in studio).
- [x] Identified all Supabase parasite targets (Club Judisid `e96aed5c-...`, 4 fake events, 27 fake club events, 16 CC0 posts, 83 parasite test accounts).
- [x] Discovered and resolved FK trigger pitfall (`prevent_message_immutable_fields_update` on `public.messages`).
- [x] Tested 100% clean dry-run transaction on Supabase PostgreSQL `icxyvwzfjbflcbqukpfz`.
- [x] Writing complete 5-component `handoff.md` in state folder.
