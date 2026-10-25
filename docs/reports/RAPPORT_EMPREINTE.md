# RAPPORT — Empreinte & Orientation (L'identité se révèle)

Date : 2026-09-04 · Chantier : ADR-010 · Branche : `feat/lignees-kits` (code prêt) ·
Statut : **CODE TERMINÉ ET VERT** (tsc 0 · 339 tests · build · anti-dérive) · **base non
appliquée** (voir préalable du chantier).

## 1. Objectif

Étendre la doctrine « rien ne s'affiche sans preuve terrain » aux profils : remplacer le
« rôle auto-déclaré avec couleur » par DEUX objets — une **ORIENTATION privée** (paramètre
du configurateur, jamais affichée) et une **EMPREINTE publique** (100 % dérivée de
`hike_sessions`, jamais choisie).

## 2. Livrables (code)

| Objet | Fichier | Verdict |
|---|---|---|
| Migration `user_orientation` + RLS own stricte | `supabase/migrations/20260904010000_user_orientation.sql` | ☐ à appliquer |
| Module pur orientation (prefill annoncé, boucle de correction qui propose) | `src/features/identity/orientation.ts` | ✅ 14 tests |
| Carte collecte/édition (capsules, « passer », ≥44px, aria-pressed) | `src/components/identity/OrientationCard.tsx` | ✅ (câblée configurateur + /compte) |
| Injection serveur `/api/kit-report/generate` | `route.ts` | ✅ tsc |
| Migration `user_field_signature` (matview + consentement + fonction sécurisée) | `supabase/migrations/20260904020000_user_field_signature.sql` | ☐ à appliquer |
| Module pur empreinte (plancher, vocabulaire, sceau) | `src/features/identity/fieldSignature.ts` | ✅ 27 tests (identity) |
| Sceau SVG déterministe (ink+sage, sans ordre) | `src/components/identity/FieldSeal.tsx` | ✅ |
| API lecture respectant consentement + plancher | `src/app/api/identity/signature/route.ts` | ✅ |
| Consentement d'affichage (private par défaut) | `src/components/identity/SignatureVisibilityControl.tsx` | ✅ (dans /compte > confidentialité) |
| Affichage réutilisable | `src/components/identity/UserFieldSignature.tsx` | ✅ (header /compte) |
| Verrou anti-dérive | `scripts/verify/identity_compliance.mjs` | ✅ passe |

## 3. Mesures réelles (la leçon du Lignées §4 : pas de ✅ sans sortie)

| Vérification | Sortie réelle |
|---|---|
| `tsc --noEmit` | **EXIT 0** (2026-09-04) |
| `vitest run` (toutes suites) | **54 fichiers · 339 tests passés** (27 nouveaux identity) |
| `next build` | **réussi** (toutes routes) |
| Conformité hex interdits (Design-tokens §10) fichiers touchés | **0 résultat** |
| Anti-dérive `identity_compliance.mjs` | **toutes contraintes respectées** (voir §4) |
| **Contraste réel** (palette v2.0, fond #FBFAF6) | label `#17402C` 11,13:1 · sage-700 `#365233` 8,34:1 · tertiaire `#5A7064` 5,11:1 · sage-500 `#5B7F55` 4,36:1 (grand) · sage-300 `#A6C1A0` 1,87:1 (remplissage) |

## 4. Anti-dérive (contractuel)

Le verrou `scripts/verify/identity_compliance.mjs` fait **échouer** si :
- `user_orientation` apparaît dans un composant public hors `src/components/identity`
  (l'orientation reste 100 % privée) ;
- `features/kits` lit `user_orientation` (les lignées classent les objets, pas les personnes) ;
- un token `--role-*` est introduit ;
- un hex hors palette apparaît dans `src/features/identity` / `src/components/identity`.

Sortie actuelle : **toutes les contraintes sont respectées.** (Le verrou a d'abord attrapé
un faux positif de séparateur Windows, corrigé — il scanne donc réellement.)

## 5. Préalable NON levé (bloquant livraison prod)

1. **Réconciliation Stripe** (`RECONCILIATION_STRIPE.md`) : vide — côté base sondé
   (3 orders confirmed, `order_items`=0, aucune trace Stripe), mais la clé `STRIPE_SECRET_KEY`
   (live) manque du `.env.local` pour lister les encaissements.
2. **Migrations Lignées 1→5 non appliquées** (GATE 1) : les nouvelles migrations `user_*`
   dépendent de `20260903020000` (hiking_routes.region) → **ne pas appliquer avant**.
3. GATE A (validation ADR-010) : **en attente Tony** — le code est prêt, le feu rouge
   départ reste contractuel.

## 6. Reste à la main de Tony (infra uniquement)

- Lire/valider `ADR-010-orientation-vs-empreinte.md` (GATE A).
- Débloquer le préalable (kit Stripe prêt : `scripts/db/reconcile_stripe.mjs`, runbook
  `LIGNEES_VALIDATION_BASE.md`).
- Appliquer les 2 migrations `user_*` APRÈS la vague 1→5, exécuter les pgTAP identity
  (à écrire — voir §7), coller les sorties.

## 7. Tests DB à écrire (pgTAP, comme les Lignées)

- `user_orientation` : anon bloqué (lecture ET écriture), user A ne lit/écrit pas user B,
  insertion OK pour soi (source défaut `declared`), champs NULLABLE.
- `get_user_signature` : cible inconnue → `{}` ; `private` → `{}` pour autrui ; `communaute`
  → visible si authentifié ; `public` → visible anon ; **AUCUNE coordonnée dans la sortie** ;
  plancher laissé côté applicatif (matview brute).
- À exécuter sur la copie au GATE 1 (3 suites des Lignées + ces 2).

## 8. Axes de respect des interdictions (vérifiés)

- ✅ Aucun token CSS couleur nouveau, aucun `--role-*`.
- ✅ Aucun grade/rang/niveau/palier/XP/titre comparatif ajouté (le champ legacy
  `user_profiles.loyalty_level` et `HeroProfil.role_badge` existent déjà hors périmètre —
  flag pour un chantier doc, ADR-010 « Ouvert »).
- ✅ L'orientation n'est jamais rendue hors son propre périmètre (verrou).
- ✅ Aucun classement d'utilisateurs introduit — le sceau différencie, il ne hiérarchise pas
  (disposition radiale symétrique, géométrie non ordonnable, testée).