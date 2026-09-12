# AIPD / DPIA — structure d'analyse

> **À VALIDER PAR UN HUMAIN HABILITÉ — BROUILLON.** Ce squelette doit être rempli
> et signé par le responsable conformité. Aucune AIPD n'est réalisée à ce stade.

**Date du brouillon :** 2026-09-12
**Référence interne :** Phase 8 — Gate « aucune ouverture publique sans validation
juridique enregistrée ».

## 1. Traitements candidats à une AIPD

| Traitement | Pourquoi il est candidat | Statut |
|---|---|---|
| Géolocalisation / traces GPS (`hike_sessions.positions_timed`, `positions_geojson`) | suivi de localisation, potentiellement sensible | À éVALUER |
| Profil de performance appris (`user_performance_profiles`, `performance_observations`) | profilage à partir d'activités | À ÉVALUER |
| Intelligence collective / agrégats de segments | agrégation de comportements, seuil ≥ 5 | À ÉVALUER |
| Modération et signalements (`comment_reports`, `moderation_queue`) | surveillance de contenus, réputation (`trust_score`) | À ÉVALUER |
| Attribution/commissions kit (parents, descendants) | traçabilité de personnes/œuvres | À ÉVALUER |
| Télémétrie produit (`hub_telemetry`) | suivi d'usage | À ÉVALUER |
| Publication de carnets (snapshots) | diffusion publique de contenus, lieux, personnes | À ÉVALUER |

## 2. Grille minimale par traitement (à remplir)

1. **Description** : finalité, base légale, données, personnes, destinataires.
2. **Nécessité** : proportionnalité, minimisation, alternatives moins intrusives.
3. **Risques** : origine, gravité, vraisemblance.
4. **Mesures** : techniques (RLS, chiffrement, seuils, rétention) et
   organisationnelles (formation, revue, procédure de violation).
5. **Avis du DPO** et **décision** (poursuivre / modifier / renoncer).
6. **Date de revue**.

## 3. Garanties techniques déjà présentes (à décrire, pas des conclusions)

- RLS exhaustive + tests horizontal/vertical (Phase 8 :
  `supabase/tests/database/phase8_rls_access.test.sql`).
- Fenêtre privée par défaut des carnets et publication en snapshot figé (Phase 7).
- Seuil collectif `distinct_user_count >= 5` (migrations A1).
- Consentements par finalité (`has_active_consent`) et export/effacement (A14).
- Aucune donnée personnelle dans `stripe_events`.

## 4. Zones d'incertitude déclarées

- Durée de conservation réelle des logs hébergeurs : `INSUFFICIENT_DATA`.
- Liste des fournisseurs IA activés en production : `INSUFFICIENT_DATA`.
- Région d'hébergement et de sauvegarde : `INSUFFICIENT_DATA`.

**Aucune conformité n'est revendiquée ; toute conclusion appartient à un humain
habilité.**
