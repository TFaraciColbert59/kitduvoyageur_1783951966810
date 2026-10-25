# Plan d’implémentation — Récompenses LKDV

Ouvert le 25 octobre 2026. Branche `claude/recompenses-lkdv` (créée depuis `26a8c1b`, `main`). Les modifications non commitées déjà présentes sur la navigation (`layout.tsx`, `MobileNavWrapper`, `NavigationSurface`, `TabItem`, `WebNavigationBar`, `IOS27BottomBar`, `liquidTabIcons`, page de démonstration bottom bar, `account-glass.css`) ne sont ni modifiées ni indexées par ce chantier.

**Règle de comptage.** Progression = tâches validées ÷ tâches totales × 100. Une tâche réalisée sans preuve reste `[ ]`. Une tâche bloquée reste `[ ]` et figure dans « Blocages ». `[x]` = validée avec preuve, `[~]` = en cours.

**Progression : 40 / 47 = 85,1 %** (mise à jour 25 oct. 2026, 18 h ; total corrigé de 46 à 47 tâches, recompte de la liste)

---

## 1. Auditer les chemins réellement utilisés et réconcilier règles, journaux et soldes

- [x] 1.1 Appelants réels de chaque route récompense/fidélité et écrans montés. — P1
- [x] 1.2 Définitions vivantes relues en base et comparées au code. — P2
- [x] 1.3 Journal fidélité ↔ soldes de profil : 0 écart. — P3
- [x] 1.4 Journal économique ↔ comptes : 0 écart. — P3
- [x] 1.5 Diagnostic des 42 intentions en attente (cause : `CRON_SECRET` absent de Vercel). — P4
- [x] 1.6 Audit daté consigné : [AUDIT-RECONCILIATION.md](AUDIT-RECONCILIATION.md).

## 2. Corriger les écarts legacy, validations insuffisantes et traitements en attente

- [x] 2.1 `/api/rewards/claim` ne relaie plus rien (410). — P5, P8
- [x] 2.2 Appels client à `/api/rewards/claim` retirés (messages de groupe, création de carnet). — P6
- [x] 2.3 Migration `kill_switches.rewards_active=false` (cash conservé), prouvée sur copie ; **application en production : action de Tony**. — P7
- [x] 2.4 Gain `rapport_expedition` fermé derrière `points_program` (via `rewards_award_points`). — P5
- [x] 2.5 `/api/rewards/withdraw` validé par zod, sans fuite SQL. — P5
- [x] 2.6 Index unique `(user_id, source_id)` sur `loyalty_history` (0 doublon en production). — P3, P7
- [x] 2.7 Promesses non financées retirées des écrans montés ; `FideliteTab` mort supprimé. — P6, P9
- [ ] 2.8 Intentions en attente **traitées** : cause et action documentées, reprise impossible sans `CRON_SECRET`. — **Bloqué** (B1)

## 3. Finaliser le contrat des points, plafonds, catalogue et financement

- [x] 3.1 Contrat pur (unité, barème pilote C fermé, sous-plafonds, 250/semaine). — P8
- [x] 3.2 Configuration `points_program` lue fail-closed ; SQL et TS concordants (test). — P8
- [x] 3.3 Catalogue typé ; financement privé ; « funded » impossible sans coût, financeur, budget, stock. — P7
- [x] 3.4 Annulation, contre-écriture plafonnée au solde, XP jamais débités. — P7, P8

## 4. Implémenter attribution, déduplication, quotas concurrents, échanges et compensations

- [x] 4.1 Migration additive, RLS et grants. — P7
- [x] 4.2 `rewards_award_points` (décision unique, plafonds sous verrou, gain entier ou rien). — P7
- [x] 4.3 `rewards_redeem` (stock + débit atomiques, idempotence, refus explicites). — P7
- [x] 4.4 `rewards_cancel_redemption`, `rewards_reverse_award` idempotentes. — P7
- [x] 4.5 `rewards_wallet_snapshot` (aucun coût, financeur, IBAN ni score de risque exposé). — P7
- [x] 4.6 Routes `wallet`, `goal`, `redeem` + actions admin de compensation. — P8
- [x] 4.7 Banc SQL sur copie locale, dont concurrence réelle à 6 connexions. — P7

## 5. Intégrer solde, objectif choisi, catalogue et historique dans la refonte

- [x] 5.1 Tiroir React `RewardsDrawer` (DrawerShell, deux volets) monté par l’hôte du Compte. — P9, P10
- [x] 5.2 Entrée « Récompenses » du tiroir Compte, `?tab=fidelite|recompenses`. — P10
- [x] 5.3 `/recompenses` refondue ; droits cash/créateur séparés et conditionnels. — P9, P10
- [x] 5.4 `/fidelite` → 308 vers `/recompenses` ; Progression et plan du site mis à jour. — P10

## 6. Traiter chargement, erreur, attente, refus, hors ligne, rupture et annulation

- [x] 6.1 Modèle d’états pur et microcopy. — P8, P9
- [x] 6.2 Hors ligne : dernier solde daté, aucun échange. — P9, P10
- [x] 6.3 Échange : confirmation, double appui ignoré, même clé après échec réseau. — P9, P10
- [x] 6.4 Tests de composants par état. — P9

## 7. Préserver confidentialité, accessibilité et réduction des animations

- [x] 7.1 Portefeuille propriétaire seul ; journaux sans identifiant ; cache local rangé par membre. — P7, P8
- [x] 7.2 Statuts annoncés une fois, cibles ≥ 44 px, libellés accessibles, état non porté par la couleur seule. — P9, P10, P11
- [x] 7.3 `prefers-reduced-motion` ; seules transform/opacity animées. — P11

## 8. Vérifier les migrations, permissions, tests métier et parcours mobiles

- [x] 8.1 Migration appliquée deux fois sur copie fidèle. — P7
- [x] 8.2 Fonctions `SECURITY DEFINER`, `search_path` verrouillé, service_role seul. — P7
- [x] 8.3 `npx tsc --noEmit -p .` sans erreur. — P12
- [ ] 8.4 Suite complète : aucune régression par rapport à `26a8c1b`. — en cours (comparaison avec la ligne de base)
- [x] 8.5 Lint : 0 erreur sur les fichiers du chantier. — P12
- [x] 8.6 Parcours mobile 430×932 et 320×640 en navigateur. — P10
- [ ] 8.7 `next build` réussi. — à faire (dans un arbre séparé pour ne pas perturber le serveur de développement en cours)

## 9. Effectuer une revue indépendante et corriger les problèmes trouvés

- [ ] 9.1 Revue indépendante (agent séparé). — en cours
- [ ] 9.2 Constats corrigés avec tests de non-régression, vérifications rejouées.

## 10. Documenter livraison, activation, surveillance et retour arrière

- [ ] 10.1 [LIVRAISON.md](LIVRAISON.md) rédigé ; à relire après la revue.
- [ ] 10.2 Plan final avec preuves, vrais pourcentages et blocages.

---

## Preuves de validation

- **P1** — Recherche `rg` des appelants (`api/rewards/claim|withdraw`, `api/loyalty/*`, `claim_reward_points`) : `DiscussionCard.tsx` (cible = groupe), `carnets/page.tsx`, `rapport-expedition/page.tsx`, `panier/page.tsx`, `fidelite/page.tsx`, ancien `recompenses/page.tsx`. Détail : AUDIT § 1.
- **P2** — `pg_get_functiondef` en production le 25 oct. : `claim_reward_points`, `legacy_loyalty_{earn,spend,redeem,cart_refund}`, `sync_loyalty_points`, `legacy_loyalty_level_for`, `is_admin`, `guard_user_profile_privileged_columns` ; index, contraintes, politiques, grants. Recopiés à l’identique dans `supabase/tests/rewards/fixture_prod_subset.sql`.
- **P3** — Requêtes de réconciliation (AUDIT § 3–4) : 0 membre avec `SUM(loyalty_history) ≠ loyalty_points` (114 090 = 114 090) ; 0 compte économique en écart ; 0 doublon `(user_id, source_id)`.
- **P4** — `progression_award_intents` : 42 `pending`, `attempts=0` ; `cron.job` sans consommateur ; `filter_project_envs` Vercel : aucune variable `CRON_SECRET` ; `/api/cron/daily` répond 401 sans secret (code). AUDIT § 5.
- **P5** — `tests/rewards/routes.spec.ts` (Vitest) : claim 410 sans appel base ni lecture de session ; `loyalty/redeem` 410 ; `loyalty/earn` → `rewards_award_points`, jamais `legacy_loyalty_earn`, 403 si rapport d’autrui ; withdraw : 6 corps invalides refusés, message SQL masqué. Serveur de développement : `POST /api/rewards/claim` → 410, `GET /api/rewards/wallet` sans session → 401.
- **P6** — `rg "api/rewards/claim" src` : seule la route fermée reste ; `rg FideliteTab src` : aucun résultat après suppression.
- **P7** — `node scripts/rewards/db-verify.mjs` sur PostgreSQL 17.6 local jetable : **51/51 contrôles réussis** ([rapport JSON](evidence/impl-db-verify.json)). Dont : écart legacy reproduit AVANT migration puis refusé APRÈS ; migration rejouée 2 fois ; émission fermée sans écriture ; doublon, changement de version, sous-plafond, plafond 250 « entier ou rien » ; 6 attributions simultanées → 3 confirmées/3 refusées ; même fait ×6 simultané → 1 décision ; double dépense simultanée → 1 réservée/1 refusée ; dernière pièce disputée → 1 réservation/1 rupture ; annulation et contre-écriture idempotentes, reliquat tracé, XP intacts ; RLS propriétaire ; financement invisible ; anon sans accès ; fonctions SECURITY DEFINER/`search_path`/service_role ; non-régression `legacy_loyalty_spend`.
- **P8** — `npx vitest run tests/rewards src/components/rewards` : **77/77** (contrat, catalogue, portefeuille, parcours d’échange, routes, admin, CSS). Test de concordance : la configuration JSON écrite par la migration produit exactement `PILOT_C_RULES`.
- **P9** — `src/components/rewards/__tests__/RewardsPanel.test.tsx` (jsdom) : chargement sans chiffre, indisponible + Réessayer, hors ligne daté sans bouton d’échange, attente non additionnée, programme fermé sans montant, réclamable/non financé/rupture distingués, objectif sans dépense, progression réelle, confirmation + double appui ignoré + référence, même clé après échec réseau, historique séparé, vide expliqué.
- **P10** — Navigateur intégré, serveur de développement `localhost:4000`, 430×932 puis 320×640 : laboratoire `/dev/recompenses` (prêt, réservation en cours → réservée R-DEMO000001, hors ligne, droits legacy ; aucun débordement horizontal à 320 px) ; `/compte?tab=recompenses` ouvre le tiroir « Récompenses » (état non connecté stylé) ; entrée de l’onglet Compte → bouton `openRewards` → tiroir `recompenses` ; Échap ferme et démonte ; `/fidelite` → 308 ; `/recompenses` non connecté. Défauts trouvés et corrigés pendant ce contrôle : encre claire du thème sombre sur verre clair (îlot clair), raccourci `font` invalide (`var(--sf, inherit)`), colonnes inversées de l’historique, libellé « Contribution » vague, tiroir non connecté sans styles.
- **P11** — `tests/rewards/a11y-css.spec.ts` : transitions/animations limitées à transform/opacity, bloc `prefers-reduced-motion` coupant barre, boutons et gain, cibles 44 px, ombres sans `rgba(0,0,0)`, aucune couleur interdite. Composants : `role="status" aria-live="polite"`, `role="progressbar"` avec valeurs, `aria-pressed`, `aria-expanded`, `aria-busy`, libellés texte à côté des pastilles.
- **P12** — `npx tsc --noEmit -p .` : 0 erreur. `npx eslint` sur les fichiers créés : 0 erreur (avertissements restants hors chantier : `duration` inutilisé préexistant dans `rapport-expedition`).

## Blocages

- **B1 — Intentions de progression en attente (2.8).** Impact : 42 décisions XP de publication de carnet restent « en attente » ; aucun point dépensable n’est concerné. Élément manquant : variable `CRON_SECRET` dans le projet Vercel (secret réservé à Tony). Reprise : ajouter le secret ; le cron quotidien consomme 50 intentions par tir.
- **B2 — Activation en production (hors périmètre « fermé »).** La migration n’est pas appliquée en production (action de Tony, CLAUDE.md § 1.8). Tant qu’elle ne l’est pas, le portefeuille connecté affiche « Solde indisponible » ; les fermetures applicatives (claim, ancien échange) sont effectives dès le déploiement du code.
- **B3 — Parcours connecté de bout en bout.** Non exécutable par l’agent : connexion à un compte de production interdite, base de production sans la migration. Couvert par le banc SQL, les tests de routes et de composants et le laboratoire visuel.
