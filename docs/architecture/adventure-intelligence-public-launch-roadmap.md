# Adventure Intelligence — Roadmap de lancement public (Étape 0 → a15)

Date : 2026-09-11 · Base : audit `31bdb279`, rulings du 2026-09-11 (Étape 0 A/B/C verrouillée)
Statut : **Étape 0 en exécution** — aucune fonctionnalité a13 avant clôture vérifiée de l'Étape 0.

## Objectif final

Rendre Le Kit du Voyageur publiquement utilisable à grande échelle avec l'Adventure
Intelligence : parcours complet « phrase → plan → cockpit → sortie → retour », gates
prouvées à chaque palier, aucun accès prod non validé.

## Étape 0 — Certification technique (bloquante)

### A — CI HEAD verte (critères verrouillés)

- [ ] type-check, lint, tests, invariants/design, build : verts **sur le commit final**.
- [ ] aucune erreur masquée ; aucune dépendance involontaire à la production.
- [ ] build CI = placeholder documenté ou projet de test via secrets ; jamais la prod.
- [ ] geodata : 3 états distincts (build absent : silencieux ; runtime indisponible :
      fallback explicite + observable ; contrat/dataset corrompu : erreur observable).

### B — Gate BDD

Ordre : `base vide → migrations complètes → pgTAP → copie historique → migrations AI →
pgTAP → F1 → EXPLAIN (ANALYZE, BUFFERS)`.

- [ ] Replay base vide vert (lots 7-10 réparés inclus).
- [ ] Toutes les suites pgTAP vertes (a1, a2, a10, a11).
- [ ] Drill historique : dump **schema-only** en priorité + données synthétiques
      représentatives ; volumes non vides, policies divergentes, vues/fonctions,
      PostGIS, orphelins, contraintes nouvelles sur données anciennes, reprise après échec.
- [ ] F1 confirmé fermé après migration (`pg_policies`).
- [ ] `EXPLAIN` acceptable sur la RPC de proximité.
- [ ] Dump hors dépôt, gitignoré, vérifié (`git check-ignore -v`), jamais en CI/cloud,
      supprimé après validation.

### C — Clôture

- [ ] Tags `a10-code-done` et `a11-code-done` **sur commit à CI verte** uniquement.
- [ ] Rapports A10/A11 conformes aux preuves réelles.
- [ ] Aucun dump/secret dans Git.

## a13 — L3 · Produit fonctionnel bout-en-bout

Parcours certifié : `phrase → trois plans complets → sélection → route map-matchée →
ETA personnelle → cockpit → tracking → recalcul → offline → reconnexion → retour
d'expérience → profil recalibré`. **Aucune fixture/mock dans le scénario final.**

Lots : ETA réelle bout-en-bout ; groupe/trek/entitlements (persistance+API+UI) ; sources
vivantes (conditions live, POI, réglementation/documents selon disponibilité) ; cockpit
live complet ; offline réel (pack + worker) ; Terrain Live UI produit ; backtesting réel chiffré.
Skills UI obligatoires : `apple-ui-designer`, `ux-mobile`, `interaction-design`.

## a14 — L4 · Ops & conformité (preuves d'exécution requises)

- [ ] Export RGPD réellement généré ; suppression réellement testée.
- [ ] Sauvegarde réellement restaurée ; rollback réellement exécuté.
- [ ] Incident simulé ; alertes reçues ; validation juridique enregistrée.
- Observabilité (corrélation, dashboards, alertes), modération publiée, support/astreinte.

## a15 — L5 · Échelle & lancement

- [ ] Charge (k6), dimensionnement/coûts, mobile (stores, appareils réels), batterie.
- [ ] Rollout interne → 1 % → 5 % → 20 % → 50 % → 100 % : fenêtre d'observation terminée,
      métriques disponibles, aucun seuil d'arrêt dépassé, décision humaine enregistrée,
      rollback immédiat possible.
- [ ] **Après 100 % : période de stabilisation post-lancement** (pas une fin en soi).

## Responsables humains (checkpoints)

| Domaine | Responsable | Moment |
|---|---|---|
| Secrets de test + variables de dépôt | humain | Étape 0-A/B |
| Autorisation dump prod (schema-only) | humain | Étape 0-B |
| Validation juridique/RGPD (textes, AIPD, export) | humain | a14 |
| Comptes stores + builds signés | humain | a15 |
| Décision de palier de rollout | humain | a15 |
| Budget infra/IA/carto | humain | a14/a15 |

## Procédures d'arrêt

Fuite de données, erreur RLS critique, ETA dangereusement sous-estimée (couverture P90 < 0,75),
faux signalements critiques, batterie/coûts non maîtrisés, sync destructive → flags OFF +
post-mortem + gel du palier (voir `docs/reports/A9_ROLLOUT.md` et `A12_RUNBOOKS.md`).

## Statut réel des capacités (au 2026-09-11)

Voir `docs/reports/A10_VERIFICATION.md` et `A11_VERIFICATION.md` : code livré en branche,
CI HEAD rouge au build (en cours de correction), gate BDD non encore exécutée, flags OFF,
aucune écriture production.
