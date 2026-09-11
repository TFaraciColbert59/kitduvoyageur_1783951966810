# A12 — Checklist conformité RGPD / données (P2)

Date : 2026-09-11 · Statut : checklist à valider juridiquement (humain)

## 1. Bases légales et consentements

- [x] Consentements par finalité (`adventure_data_consents`) : `personal_performance`,
      `collective_terrain`, `live_location`, `group_location` ; `external_readiness` désactivé.
- [x] Consentement « version courante uniquement » (`has_active_consent`, a10).
- [x] Révocation → purge idempotente (observations, profil + versions, prédictions, agrégats
      affectés) via `consent.revoked` (a10, sécurisé par acteur).
- [ ] Textes de consentement rédigés + versionnés + horodatés (contenu juridique à produire).

## 2. Minimisation et séparation

- [x] 4 niveaux : traces privées → observations privées → agrégats anonymes → vues publiques (seuil ≥ 5).
- [x] Aucune donnée santé collectée ; `ExternalReadinessProvider` = Noop.
- [x] Vues publiques sans identité (`terrain_reports_public`, `public_profiles` 12 colonnes sûres).
- [x] F1 : policies larges supprimées (dont dérive prod) ; lecture publique par projection.

## 3. Droits des personnes

- [ ] Export utilisateur (portabilité) : script + format (à produire ; tables du domaine identifiées).
- [x] Effacement : cascades `ON DELETE CASCADE` vérifiées (A9) + purge consentement (a10).
- [ ] Purge des sauvegardes : procédure + durée de rétention documentées puis appliquées.
- [x] Rétention événements : `purge_expired_lkv_events` 13 mois ; politique d'agrégats à préciser.

## 4. Registre et gouvernance

- [ ] Registre des traitements : finalités, bases légales, durées, destinataires (à compléter
      depuis ADR-AI-003 + consentements).
- [ ] AIPD : décision formelle (profiling vitesse/difficulté sans santé → probablement non requis,
      à documenter ; deviendrait requis avec santé/capteurs).
- [x] Journalisation administrateur : `adventure_engine_runs`, audits RLS existants.
- [ ] Procédure d'incident RGPD (voir `A12_RUNBOOKS.md`) + contact DPO.

## 5. Modération et transparence

- [x] Modération Terrain Live : rate limit, cooldown, réputation plafonnée, source officielle.
- [ ] Politique de modération publiée (contenus, photos, abus, recours).
- [ ] Mentions de non-garantie outdoor (ETA/difficulté indicatives, responsabilité utilisateur).

## 6. Sous-traitants

- [ ] Liste et DPA : Supabase, Vercel, OpenRouter/Nemotron, Open-Meteo, Stripe/affiliation,
      fournisseurs carto. Vérifier localisations et transferts hors UE.
