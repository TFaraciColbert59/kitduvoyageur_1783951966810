# Rétention et localisation des sauvegardes

> **À VALIDER PAR UN HUMAIN HABILITÉ — BROUILLON.** Aucune décision de rétention
> n'est juridiquement validée ici. Les durées proposées sont des **hypothèses de
> travail** à confirmer par le responsable conformité.

**Date du brouillon :** 2026-09-12
**Périmètre :** Supabase Postgres/PostGIS (projet de production à provisionner),
stockage objets, Stripe (prestataire), Vercel (hébergement).

## 1. Faits techniques vérifiés

| Élément | Fait | Source |
|---|---|---|
| Base principale | Supabase Postgres/PostGIS, RLS sur 223/224 tables du schéma `public` (seule `spatial_ref_sys` hors RLS, table PostGIS) | revue Phase 8 (scan local) |
| Suppression de compte | cascade `auth.users` vérifiée et recomptage bloquant | `src/server/gdprDelete.ts`, `tests/ops/a14-gdpr.integration.spec.ts` |
| Export de portabilité | JSON complet, `no-store`, identité session | `src/server/gdprExport.ts` |
| Sauvegardes Supabase | gérées par la plateforme ; **aucune configuration de rétention/PITR vérifiée dans ce dépôt ni dans ce worktree** | `INSUFFICIENT_DATA` |
| Identifiants Stripe | aucun abonnement stocké ; journaux d'événements `stripe_events` (id, type, kind, objet — sans PII) | migration `20260911552000_phase8_stripe_events.sql` |
| Télémétrie hub | `hub_telemetry` (événements produit, `user_id`), RLS FORCE, lecture admin | migrations `20260909150000_hub_telemetry.sql` |

## 2. À décider par un humain habilité

1. **Durée de rétention Postgres / PITR** : la fenêtre de restauration à chaud
   dépend de l'offre Supabase réellement souscrite (non provisionnée). Vérifier
   le plan, la fréquence, la fenêtre PITR et la procédure de restauration.
2. **Rétention des sauvegardes vs droits des personnes** : une sauvegarde peut
   contenir des données effacées. Décider la doctrine (restauration sélective,
   purge à la restauration, information des personnes).
3. **Localisation** : région d'hébergement Supabase, région Vercel, région des
   sauvegardes. Déterminer si des transferts hors UE ont lieu et sur quelle base
   (cf. `02_DPA_TRANSFERTS_INTERNATIONAUX.md`).
4. **Durées par finalité** : proposer puis valider une durée pour chaque
   catégorie (profil, consentements, performance, télémétrie, logs, facturation).
   *Hypothèse de travail à confirmer :* profils/consentements jusqu'à suppression
   du compte ; journaux techniques 90 jours ; `stripe_events` 13 mois.
5. **Journalisation** : rétention des logs applicatifs (Vercel) et des traces
   d'observabilité, avec interdiction de données sensibles (déjà posée Phase 10).

## 3. Éléments de preuve à produire

- [ ] Capture de la configuration Supabase (plan, région, backups, PITR) — humain ops.
- [ ] Capture de la configuration Vercel (région, logs).
- [ ] Procédure de restauration testée et datée (script `scripts/ops/a14_backup_restore_test.ps1`).
- [ ] Tableau rétention par table validé et signé.

## 4. Limites explicites

- **Aucune validation juridique** : le document ne conclut pas sur la conformité.
- La base locale de développement ne préjuge pas de la configuration de
  production (`INSUFFICIENT_DATA`).
