# CLUB_PLAN_SECURITE — Plan de Défense en Profondeur

> **Approche** : Strictement défensive — cohérence UI / API / Postgres RLS, principe du moindre privilège, anti-escalade et traçabilité.

---

## 1. Contrôles vérifiés (État actuel)

| Domaine | Contrôle vérifié | État | Priorité si écart |
|---|---|---|---|
| **RLS** | 40/40 tables `club*` avec `rowsecurity = true` | **En place** | — |
| **API Auth** | `optionalUser(supabase)` + `401` sur toutes les routes `/api/clubs/[id]/*` | **En place** | — |
| **CSRF** | `hasValidOrigin(request)` sur tous les `POST`, `PATCH`, `DELETE` | **En place** | — |
| **Validation** | Schémas `zod` `.strict()` sur les payloads JSON (`salons`, `members`, `permissions`, `moderation`, `volunteers`, `budget`) | **En place** | — |
| **Anti-CSV Injection** | Échappement `^[=+\-@]` dans `GET /api/clubs/[id]/budget?format=csv` | **En place** | — |
| **Hiérarchie 5 rôles & anti-escalade** | Rang strict (`founder=5 > admin=4 > moderator=3 > volunteer=2 > member=1`), non-auto-promotion, non-délégation d'un droit absent | **En place dans le code & migration SQL** *(finaliser `db push` sur DB distante)* | **P0** |
| **Journal d'audit** | `club_permission_audit` pour changements de rôles, overrides et policies de rôle | **En place dans la migration SQL** | **P0** |

---

## 2. Feuille de route Sécurité Avancée (P0 → P3)

### P0 — Avant mise en production
1. **Finaliser l'application de `20261124100100_club_admin_v2_core_ops_budget.sql` sur la base distante** :
   - *Contrôle* : `club_has_capability`, `guard_club_member_privileged_columns`, `club_transfer_ownership`, policies `club_channels` (`min_role`) et `club_role_cap_policies_write`.
   - *Critère de vérification* : `SELECT proname FROM pg_proc WHERE proname IN ('club_actor_effective_role','club_transfer_ownership');` retourne 2 lignes.

### P1 — Haute priorité (Court terme)
2. **Rate limiting applicatif (Upstash Redis / Vercel WAF)** sur les routes sensibles (`POST /salons`, `POST /invites`, `POST /budget`, `PATCH /permissions`).
3. **Isolation Realtime des salons privés (`min_role`)** :
   - *Risque* : un client souscrit au channel Postgres Realtime peut compter sur le RLS pour filtrer `postgres_changes`, mais vérifier explicitement que `club_messages_member_read` utilise `club_role_rank >= min_role` et activer **Private Realtime Channels** avec JWT claims si nécessaire.
4. **Durcissement des pièces jointes & URLs** :
   - Valider `receipt_url` (budget) et `cover_image` (sorties/salons) via une liste blanche de domaines (`https:` + bucket Storage LKDV uniquement) et supprimer les métadonnées EXIF GPS des photos uploadées dans les clubs privés/secrets.

### P2 — Moyen terme (Conformité RGPD & Observabilité)
5. **En-têtes HTTP & CSP** : vérifier `Content-Security-Policy`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` sur `/clubs/*` et `/api/clubs/*`.
6. **Export & Droit à l'oubli RGPD** : inclure `club_budget_entries` (anonymisation `created_by`), `club_event_volunteer_assignments`, `club_channel_messages` et `club_permission_audit` dans la procédure de suppression/export compte utilisateur.
7. **Alerting sécurité** : alerte automatique sur `transfer_ownership`, suppression de club (`club.delete`), ou rafale de `403` sur `/permissions` et `/moderation`.

### P3 — Long terme
8. **Ré-authentification récente (step-up auth)** exigée avant `club.transfer_ownership` et `club.delete`.
9. **Tests automatisés de non-régression RLS** en CI sur base Supabase éphémère (matrice 5 rôles × opérations `SELECT/INSERT/UPDATE/DELETE`).
10. **Analyse IA** : aucune IA générative n'accède directement aux données privées des clubs (`salons`, `budget`, `moderation`) dans cette version ; si un assistant IA club est ajouté ultérieurement, exclure explicitement les tables `club_budget_entries`, `club_content_reports` et `club_permission_audit` de son contexte.
