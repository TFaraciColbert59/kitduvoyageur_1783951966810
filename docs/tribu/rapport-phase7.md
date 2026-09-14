# TRIBU — Phase 7 : partage de position live — Rapport (lot 2)

Date : 2026-09-13 · Branche : `chantier/tribu-live` · Déploiement DB prod : **appliqué** (`20260913200000`, `20260913210000`)

## Livré

- **M12 sessions** (`group_live_sessions`) : ouverture explicite (opt-in), unique par groupe (index partiel), bornée 1-72 h, clôture par le starter/`manage_members`/tout membre si expirée.
- **M13 positions** (`group_live_positions`) : une seule ligne par (session, membre), TTL **15 min borné en base** (WITH CHECK), lecture membres + session ouverte + positions fraîches, self-only en écriture, la ligne expirée reste récupérable par son propriétaire. Zéro historique : supprimée à l'arrêt.
- **Actions** : `startLiveSession` (ferme les expirées, 23505 explicite), `stopLiveSession` (0 ligne = échec honnête + purge best-effort), `sharePosition` (session ouverte requise), `stopSharingPosition`, `getLiveState` (**toute erreur DB remonte, jamais convertie en absence**).
- **Hook** `useLivePositionSharing` : ping 45 s, **arrêt confirmé serveur** (toggle, 3 échecs, onglet masqué > 2 min, démontage), watchdog de fraîcheur (5 min), erreurs GPS comptées.
- **UI** : `LiveSharePanel` dans `/hub/groupe` (desktop + mobile) — consentement avant démarrage, durées 2 h/8 h/24 h, **indicateur permanent** « PARTAGE ACTIF — arrêt à un tap », clôture organisateur uniquement (mobile corrigé), erreurs visibles. Le partage individuel n'est **jamais** activé implicitement au démarrage de session.
- **Carte** : prop `memberPositions` + couche avatars (`atlas-members`) sur `UnifiedExplorerMap`, badge « N positions du groupe » + « Arrêter mon partage » sur l'Explorer, données RLS-filtrées, Realtime `group_live_positions` + refresh 60 s.
- **Cron** `expire-live-positions` : purge des positions expirées + fermeture des sessions dépassées (TRIBU-R6), filtres re-vérifiés.

## Preuves

```text
pgTAP tribu_live            → 20/20 (RLS, TTL borné, self-only, unicité, expiration)
vitest (lot)                → 70/70 (actions, panneau, countdown, couche, cron)
harnais DB install+upgrade  → SUCCÈS (220 versions, pgTAP PASS, F1, EXPLAIN 22 ms)
vitest complet              → 2734 passed | 23 skipped (4 suites préexistantes)
lint 0 · tsc 0 · build ✓ · e2e 7/7 (preparer, depart, atlas) · garde design 14/14
prod                        → 2 migrations appliquées + probe service-role (tables ok)
```

## Revue `silent-failure-hunter` (NO-GO → corrigé)

- **C1** arrêt 1 tap qui ne coupait pas le serveur (et inversait l'état) → corrigé : toggle basé sur l'état effectif, `stop()` confirmé, refresh systématique.
- **C2** `getLiveState` transformait toute erreur DB en « aucune session » → corrigé : erreurs remontées (`{ok:false}`), test dédié.
- **C3** stop carte muet → erreur visible dans le badge + try/catch.
- **I1** clôture fantôme (`{ok:true}` sur 0 ligne) + « Clôturer » mobile pour tous → 0 ligne = échec explicite ; `isOrganizer` mobile dérivé des rôles.
- **I2** position expirée non récupérable (upsert/delete RLS) → policy SELECT élargie à sa propre ligne + filtre de fraîcheur côté action ; test 20.
- **I3** TTL non borné en base (client hostile) → WITH CHECK ≤ 15 min.
- **I4/I5** faux « actif » GPS / faux « inactif » sur arrêt raté → compteur d'échecs GPS, watchdog 5 min, arrêt confirmé serveur.
- **I6** nettoyage des sessions expirées par tout membre + 23505 explicite.
- **M1-M7** mineurs traités ou actés (purge à la clôture, message 500 générique, canal realtime best-effort).

## Dette / à savoir

- Purge à la clôture best-effort (RLS) : la garantie complète reste le cron service-role ; le déclencheur externe doit inclure `expire-live-positions`.
- Realtime sans gestion d'état de canal (refresh 60 s en filet) ; non bloquant.
- Harmonisation UX « manager » mobile (canManage large) toujours en backlog lot 1.
