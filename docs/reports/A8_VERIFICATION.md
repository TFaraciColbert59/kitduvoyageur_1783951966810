# A8 — Rapport de vérification (Phase 8 : groupe, trek, monétisation)

Date : 2026-09-11 · Branche : `chantier/adventure-intelligence` · Commit : `42145d45`
Statut : **RÉALISÉ**

## Livrables

| Livrable | Chemin |
|---|---|
| Spec + plan | `docs/superpowers/specs/2026-09-11-a8-group-trek-monetization-design.md` |
| Groupe | `domain/groupIntelligence.ts` (membre dimensionnant, difficulté par membre, séparation, redistribution, projection publique) |
| Trek | `domain/multiDayTrek.ts` (capacité cumulative, récupération, dérive, ajustements) |
| Monétisation | `domain/entitlements.ts` (plans, passes, gating), `domain/affiliationRanking.ts` (classement transparent) |
| B2B (contrats) | `domain/b2bContracts.ts` (types + catalogue, zéro implémentation) |
| Tests | 5 suites A8 (+21 tests) · **239 fichiers / 1775 tests** verts |

## Preuves

| Commande | Résultat |
|---|---|
| `npm run test` | ✅ 239 fichiers, 1775 tests, 0 échec |
| `npm run type-check` | ✅ exit 0 |

## Gate de sortie Phase 8 (revue indépendante : Approved, 0 Critical/Important)

- ✅ Groupe fonctionnel : allure = membre dimensionnant (jamais une moyenne), raison du
  dimensionnement, difficulté par membre, pauses, risque de séparation, redistribution plafonnée.
- ✅ **Privacy groupe** : `projectGroupPlanPublic` n'expose que 5 agrégats (test verrouillant
  l'absence d'identités, vitesses individuelles et limitations).
- ✅ Trek multi-jours : fatigue cumulative, récupération nocturne, nuit courte, journée courte,
  dérive, ajustements proposés (raccourcir, déplacer, refuge, nuit, transfert, récupération).
- ✅ Paywall cohérent : plans (`free/explorer/expedition/group`), passes (`weekend/trip/expedition`),
  entitlements testés ; entitlement inconnu jamais accordé.
- ✅ Affiliation transparente : commission **jamais** utilisée dans le classement
  (test de permutation des commissions) ; offres indisponibles exclues ; raisons fournies.
- ✅ Aucune monétisation des données santé (aucun entitlement/champ santé).
- ✅ B2B : contrats futurs typés uniquement (API difficulté, ETA, conditions) — aucun endpoint.

## Mineurs différés (ledger)

1. `totalDriftRisk` = pic de déficit journalier (et non déficit cumulé final) — sémantique
   non fixée par la spec, comportement testé ; à préciser en Phase 9 si besoin de reporting.
2. UI groupe/trek non montée : l'intégration Hub réelle est prévue en Phase 9
   (les moteurs et contrats sont prêts).
