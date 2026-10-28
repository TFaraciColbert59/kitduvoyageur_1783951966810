---
name: lkdv-explorer-v2-activity
description: Use for live activities in Explorer v2 - start flow, countdown, GPS tracking, follow mode, off-route, SOS, summary, Live Activity native plugin and haptics.
---
# Activités en direct

- Démarrage : bouton ▶ ou appui long 600 ms sur la carte (niveau lieu) → grille 9 sports → compte à rebours 3·2·1 (impact rigid par chiffre) → `POST /api/explorer/v2/activity`.
- GPS : `@capacitor/geolocation` (web : `navigator.geolocation.watchPosition`, `enableHighAccuracy`). Rejeter précision > 30 m, lisser (Kalman 1D sur lat/lng), calculer distance (haversine), D+ avec hystérésis 3 m, vitesse moyenne mobile.
- Envoi par lots toutes les 10 s ; hors ligne → `offline_sync_operations` avec clé d’idempotence.
- Hors-trace : distance à la trace (worker) > 40 m pendant 15 s → état `offRoute` ; < 25 m → retour.
- SOS : bouton rouge, maintien 1,5 s, écran SOS avec compte à rebours 10 s annulable, puis `tel:` du numéro du pays (`country_practical`) et insertion `sos_alerts`. En test et en dev : appel remplacé par un événement `sos:simulated`.
- Stop : maintien 0,8 s → `finish_activity_session` → écran Bilan (vue d’ensemble caméra).
- Live Activity : plugin local Swift (ActivityKit, `ActivityAttributes` sport, chrono, distance, D+) démarré à `appStateChange(isActive=false)`, mis à jour toutes les 15 s, terminé au retour ou à l’arrêt. Web : no-op. Vérifié par le build iOS de la CI.
- Haptique : table `09_DESIGN.md §6`, anti-rebond 80 ms.
- Tests : `fixtures/gps.ts` rejoue un GPX (accéléré ×20) ; une trace par sport issue d’un vrai `hiking_routes` ou d’un tracé réaliste documenté.
