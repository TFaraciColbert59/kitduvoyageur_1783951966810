# H8 — Décision (2026-09-10)

## Verdict : NO-GO — aucune suppression exécutée.

Critères obligatoires non remplis (par construction ce soir) :
- 14 jours de `hub_redirect_used` : impossible (télémétrie créée en H7, base même pas migrée).
- Hit ratio cible ≥40 %, 0 incident P1/P2 : non mesurables.
- Signature PO : absente.

## Rappel kill switch
`hub_all_enabled=false` → `possession` partout via `deriveHubNature` (moteur prêt, pas de bandeau maintenance dédié — à créer le jour du GO).

## Prochaine étape
Relire ce rapport après 14 jours de télémétrie verte, puis exécuter H8.1-H8.3.
