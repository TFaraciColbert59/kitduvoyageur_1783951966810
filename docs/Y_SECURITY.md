# Y_SECURITY — État des lieux sécurité module voyages (Y0.7)

Date : 07/09/2026 · Branche `chantier/x-design-unique` · Audit statique complet
(module `/voyages`, API, actions serveur, RLS) réalisé puis compléments Y0.7.

## 1. Audit complet (réalisé, session X-étendue) — verdicts et corrections

### Corrigé (commits `cabd5c24` + Y0.7)
| Réf. | Sévérité | Constat | Correction |
|---|---|---|---|
| H3 | HIGH | Webhook affiliation **fail-open** sans secret | 503 si `TRAVELPAYOUTS_WEBHOOK_SECRET` absent — fail-closed |
| H1 | HIGH | `?token=` GPX/export passé comme `userId`, jamais comparé à `share_token` | Vérification serveur (mismatch → 404). Accès toujours RLS (fail-closed) |
| M1 | MED | Injection `.or()` PostgREST (invitation + recherche), écho d'identifiant | Lookups paramétrés, sanitizeur `,()\`, plus d'écho |
| M2 | MED | JSON-LD sans échappement `<` (XSS titre/description) | `.replace(/</g,'\\u003c')` sur les 2 pages |
| M3 | MED | `publishTripCarnetAction` sans ownership (tout lecteur d'un voyage public pouvait publier) | `getTripById(id, user.id)` + `canEdit` exigé |
| M6 | MED | `kit-actions` : zéro zod, zéro auth, erreurs brutes | zod + `getUser()` + `canEdit` + erreurs génériques |
| L4 | LOW | `share_token` exposé aux non-propriétaires | Strippé dans `getTripBySlug` (hors owner) |
| L5 | LOW | GPX sans `force-dynamic` | Ajouté |
| R7 | CRITIQUE (risque) | `saveTripOffline` sérialisait le `TripFull` entier en clair dans localStorage (documents/file_url, dépenses, collaborateurs, share_token) | Payload assaini : `documents: []`, `expenses: []`, `share_token: null` |
| — | MED | `getPublicTrips` exposait `trip_expenses(amount)` sur les voyages publics | Montants retirés du select public (compteurs agrégés uniquement) |

### Migration en attente d'application ( écrite, NON appliquée — validation sur copie requise)
`supabase/migrations/20260907010000_trips_rls_hardening.sql` :
- **H2** — un éditeur pouvait se réattribuer un trip en PATCHant `user_id` (PostgREST direct) → trigger `freeze_trip_owner` ;
- **M4** — insert collaborateur `role='owner'` possible via RLS → policy restreinte à editor/viewer ;
- **M5** — document attributable au propriétaire → `user_id = auth.uid()` exigé ;
- **M7** — vues legacy sans `security_invoker` (bypass RLS sur crews/trip_participants) → `security_invoker = on`.

### Reste à traiter en Y8.3
| Réf. | Sévérité | Objet |
|---|---|---|
| H1-complet | HIGH | Lien de partage ouvrant un voyage **privé** (chemin de lecture anon dédié) — comportement actuel fail-closed, aucune fuite |
| M8 | MED | Cookies `SameSite=None` + `POST /api/voyages` sans CSRF |
| L1 | LOW | `updateTripVisibilityAction` : un éditeur peut passer un voyage privé en public (produit à arbitrer) |
| L2 | LOW | Écritures filtrées par RLS rapportent `success:true` (0 ligne) — ajout `.select()` et vérification |
| L3 | LOW | Messages d'erreur DB/zod bruts dans actions legacy (`actions.ts:266,300,335`…) |
| L6 | LOW | `/go/[slug]` sans allowlist de domaines partenaires (cible admin-DB, HTTPS imposé) |

## 2. Compléments Y0.7 — verdicts

| Point | Commande / fichier | Verdict |
|---|---|---|
| `service_role` atteignable côté client | `grep -rn "SERVICE_ROLE" src/` → uniquement `src/app/api/**` (checkout, crons, materiel/share) | ✅ serveur uniquement |
| Env non-`NEXT_PUBLIC` dans composants clients | grep sur `src/components`, `src/features` `.tsx` avec `"use client"` | ✅ aucune |
| Stockage hors-ligne en clair | `offline/tripOfflineStorage.ts` (3 451 o, localStorage) | ❌ → **corrigé** (payload assaini, cf. R7) |
| File de sync hors-ligne | `tripOfflineSyncQueue.ts` (actions, données sensibles ?) | ⚠️ à auditer en Y7.4 (migrations dexie) |
| `share_token` journalisé | `grep console.*share_token` → vide | ✅ |
| `share_token` indexable | `src/app/sitemap.ts` : pas de slugs voyages tokenisés ; token uniquement via lien explicite | ✅ (révocation = régénération du token, à garder en Y8.3) |
| `visibility: public` — documents | RLS select `can_edit_trip` only, anon sans grant (`trips_core.sql:516-518,599-600`) + double porte applicative | ✅ |
| `visibility: public` — dépenses | `getPublicTrips` sélectionnait `trip_expenses(amount)` | ❌ → **corrigé** (retiré du select) |
| `visibility: public` — identités | select public : `trip_collaborators(count)` uniquement (compteur, pas d'identité) | ✅ |
| Mutations contrôlées côté serveur | 9 actions planner vérifient `computeTripPermissions` dérivé serveur ; collab/budget/docs/completion appelent `getUser()` (kit-actions corrigé) | ✅ (sauf L2) |

## 3. Parcours de test de sécurité
Le parcours 5 (permissions viewer — mutations refusées **côté serveur**) est exécuté
en Y9.1 ; les assertions L2 seront vertes après correction.
