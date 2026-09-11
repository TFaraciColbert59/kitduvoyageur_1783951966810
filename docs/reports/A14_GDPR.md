# A14 — RGPD exécuté : export, suppression, registre, AIPD

Date : 2026-09-11 · Environnement : **base Supabase locale uniquement** (projet de
test) — aucun PII réel, aucun export commité, aucune donnée envoyée à un tiers.

## 1. Export (portabilité, art. 20) — livré et exécuté

- Module : `src/server/gdprExport.ts` (`buildGdprExport`, version de schéma `a14-v1`).
- Route : `GET /api/account/export` — **auth requise** (401), service requis (503),
  identité issue **exclusivement de la session**, réponse `application/json`
  téléchargeable (`Content-Disposition: attachment`), `Cache-Control: no-store`.
- Contenu : profil, consentements, et les 18 tables du domaine ci-dessous, plus
  les `adventure_plans` avec versions/décisions/runs enfants.
- Tests mockés : `tests/security/a14-gdpr-account.spec.ts` —
  TEST-A14-GDPR-EXPORT-01 (registre verrouillé), -02 (bundle complet),
  -03 (401), -04 (200 téléchargeable).
- **Preuve réelle locale** : `tests/ops/a14-gdpr.integration.spec.ts` —
  TEST-A14-GDPR-LOCAL-01 (export réel d'un utilisateur jetable : 1 consentement,
  1 session, 1 observation, 1 signalement, 1 plan + 1 version + 1 décision + 1 run).

Export réel (extrait anonyme, aucune valeur personnelle) :

```text
GET /api/account/export → 200, schemaVersion=a14-v1
profile.id=<uuid jetable>, consents=1, counts={terrain_reports:1, hike_sessions:1,
performance_observations:1, adventure_plans:1, ...}, plans[0].versions=1, decisions=1, engineRuns=1
```

## 2. Suppression (effacement, art. 17) — livrée et exécutée

- Module : `src/server/gdprDelete.ts` ; route `DELETE /api/account/delete`.
- Garanties :
  1. session obligatoire (401) ; identité issue de la session ;
  2. **confirmation explicite exacte** `{"confirmation":"SUPPRIMER MON COMPTE"}`
     sinon 400 — jamais de suppression par simple appel ;
  3. suppression `auth.users` via service_role **après** authentification →
     cascades `ON DELETE CASCADE` (vérifiées A9, FK `auth.users`) ;
  4. **recomptage de chaque table du registre après suppression** ; toute donnée
     résiduelle ⇒ `ResidualDataError` ⇒ **500 bloquant** (jamais un faux succès).
- Tests mockés : TEST-A14-GDPR-DELETE-01 (401), -02 (400 sans suppression),
  -03 (200 + cascades), -04 (résiduel ⇒ erreur), -05 (500 explicite), -06 (corps non-JSON).
- **Preuve réelle locale** : TEST-A14-GDPR-LOCAL-02 (confirmation erronée ⇒ 400,
  données intactes), -03 (suppression ⇒ 200, **toutes les tables à zéro**),
  -04 (export post-suppression ⇒ profil null, compteurs zéro).

Extrait de preuve réelle :

```text
DELETE /api/account/delete {"confirmation":"SUPPRIMER MON COMPTE"} → 200 {deleted:true, residual: tous 0}
user_profiles=0, terrain_reports=0, adventure_data_consents=0, hike_sessions=0,
performance_observations=0, saved_adventures=0, adventure_plans=0, plan_versions=0
```

## 3. Registre des traitements (tables réelles du domaine)

| Finalité | Tables | Base légale | Durée / purge |
|---|---|---|---|
| Profil & compte | `user_profiles` | exécution du contrat | jusqu'à suppression du compte (CASCADE `auth.users`) |
| Consentements par finalité | `adventure_data_consents` | obligation légale (preuve) | conservés jusqu'à suppression du compte ; retrait tracé (`revoked_at`) |
| Performance personnelle (profil appris) | `user_performance_profiles`, `user_performance_profile_versions`, `performance_observations` | consentement `personal_performance` | jusqu'au retrait du consentement (purge idempotente `consent.revoked`) ou suppression du compte |
| Prédictions (ETA/difficulté/fatigue) | `route_predictions`, `segment_predictions` | consentement `personal_performance` | idem (liées au profil/plan) |
| Sorties terrain (traces privées) | `hike_sessions`, `session_segment_passages` | consentement `live_location` / exécution | jusqu'à suppression du compte ; visibilité par défaut `private` |
| Plans d'aventure | `adventure_plans`, `adventure_plan_versions`, `adventure_plan_decisions` | exécution du contrat | jusqu'à suppression du compte (CASCADE) |
| Télémétrie moteurs (corrélation) | `adventure_engine_runs` | intérêt légitime (fiabilité/sécurité) | métadonnées techniques, plan détaché (`SET NULL`) ; pas d'identité directe |
| Demandes de génération | `adventure_generation_requests` | exécution / anti-abus | jusqu'à suppression du compte (CASCADE) |
| Shadow runs (comparaison) | `adventure_shadow_runs` | intérêt légitime (qualité) | jusqu'à suppression (`user_id` SET NULL) |
| Intelligence collective (agrégats) | `segment_collective_aggregates`, `segment_condition_buckets` | intérêt légitime | agrégats anonymes (seuil ≥ 5), pas de réidentification |
| Terrain Live (signalements) | `terrain_reports`, `terrain_report_confirmations`, `terrain_report_contributors` | consentement `collective_terrain` / intérêt légitime (sécurité) | expiration par catégorie (24–72 h), agrégats anonymes ensuite ; suppression compte ⇒ CASCADE |
| Hors-ligne | `offline_sync_operations` | exécution | jusqu'à suppression du compte (CASCADE) |
| Droits/abonnements | `user_entitlements` | exécution du contrat | jusqu'à suppression du compte (CASCADE) |
| Sauvegardes | `saved_adventures`, `saved_trails` | exécution | jusqu'à suppression du compte (CASCADE) |
| Événements domaine | `adventure_domain_events` | intérêt légitime (fiabilité) | purge par le processeur d'événements (`processed_at`) ; acteur détaché (`SET NULL`) |
| Journal applicatif | `lkv_events` | intérêt légitime / sécurité | purge `purge_expired_lkv_events` : **13 mois** |

Destinataires/sous-traitants : Supabase (hébergement BDD), Vercel (hébergement app),
OpenRouter/Nemotron (IA), Open-Meteo (météo), Stripe/affiliation (paiement),
fonds cartographiques. DPA et localisations UE/hors UE : **validation humaine
requise** (repris de A12 §6).

## 4. Rétention, consentements, incidents

- « Version courante uniquement » : `has_active_consent` (a10) ; retrait ⇒ purge
  idempotente observations + profil + versions + prédictions affectées.
- `external_readiness` désactivé (aucun connecteur santé).
- Sauvegardes : la procédure et les RPO/RTO sont testés localement
  (`A14_BACKUP_RESTORE.md`) ; rétention des sauvegardes prod à fixer côté
  plateforme (action humaine).
- Incident RGPD : procédure `A12_RUNBOOKS.md` §7 — gel des flags, évaluation,
  notification CNIL sous 72 h si violation avérée. Contact DPO : **à désigner
  (humain, bloquant pour le lancement public)**.

## 5. AIPD — décision motivée

**Décision proposée : AIPD non obligatoire en l'état** (à confirmer par le
juridique avant lancement public).

Motifs :
- le profilage (vitesse, difficulté, fatigue estimée) **n'utilise aucune donnée
  de santé** (aucun capteur physiologique, `ExternalReadinessProvider` = Noop) ;
- pas de décision automatisée produisant un effet juridique (art. 22) : les
  estimations sont indicatives, l'utilisateur reste décideur ;
- pas de surveillance systématique à grande échelle ni de croisement de données
  sensibles ; agrégats collectifs anonymes (seuil ≥ 5) ;
- les données de localisation sont traitées **avec consentement explicite**
  (`live_location`, `group_location`) et restent privées par défaut.

Déclencheurs qui imposeraient une AIPD : ajout de données de santé/capteurs
(fréquence cardiaque, etc.), scoring affectant l'accès à un service, ou
surveillance à grande échelle. Toute évolution doit repasser cette revue.

## 6. Limites

- La revue juridique des textes (consentements, mentions) et la désignation du
  DPO restent **humaines** (voir roadmap a14, checkpoints).
- Les tests d'intégration RGPD utilisent un utilisateur synthétique
  `@example.invalid` et nettoient derrière eux ; aucun export n'est écrit dans le
  dépôt.
