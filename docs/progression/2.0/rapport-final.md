# Progression 2.0 — Rapport final (T48)

Date : 2026-10-11. Dépôt `TFaraciColbert59/kitduvoyageur_1783951966810`, branche `main`.
Le suivi détaillé par tâche, écarts et preuves datées vit dans `ETAT.md` (autorité du chantier) ; la reprise vit dans `NEXT_SESSION.md`.

## Périmètre livré

- **P0 (T01–T04)** : stabilisation prouvée — scan prod 0 anomalie, isolation démo (19 comptes), restauration isolée rejouée, sondes 401, jobs pg_cron observés (`progression-outbox-v1`, `progression-leaderboard-v1`, purge quotidienne + journal `progression_ops.job_runs`, retry leaderboard réparé).
- **P1 (T05–T11)** : contrat v2 gelé (`rules-registry.json` + zod, `draft_closed`), intentions durables (capteurs SQL atomiques + consommateur borné), moteur v2 (verrou par utilisateur, plafonds par date métier, cap_group, claims, tie-break TS/SQL aligné — preuve de concurrence 1 gagnant/1 refus), sept preuves renforcées (durée active, nouveauté claim, checklist dues, itinérance 2 jours, débrief différé), carte compacte vérifiée, historique paginé avec pending séparé.
- **P2 (T12–T17)** : catalogue de missions versionné sans promesse de points, liaison des défis réels (5 publiés / 3 conservés), assignations ≤ 3 atomiques, projection d'avancement sans XP, distinctions dédupliquées (32 → 19 clés, possessions intactes, 0 promesse), rythme choisi + pause, suggestions déterministes avec IA facultative sans autorité.
- **P3 (T18–T23)** : découvertes vérifiées (provenance stricte), passeport privé, couche carte (identifiants seulement), adaptateurs d'activité (randonnée seule active), préparation Compas (claim partagé), kit éprouvé (diff + vitaux conservés).
- **P4 (T24–T29)** : corrections acceptées (validateur indépendant, claim unique), réponses acceptées (anti-collusion), médias dédupliqués (empreinte), preuves éditoriales/traces/avis matériel (contrôles partagés, IA brute exclue).
- **P5 (T30–T36)** : coopération vérifiée (présence, tâches, prêts 24 h/2 confirmations, interventions), accompagnement/environnement/observation encadrés, **opt-in compétition au retrait effectif** (suppression immédiate des agrégats), **ligues à population réelle ≥ 20** (démos exclues, gel stable, re-gel refusé).
- **P6 (T37–T42)** : inventaire des trois familles (0 écart), **encaissement autoritaire** (triggers legacy d'émission-par-statut DÉSACTIVÉS en prod ; seul un événement d'encaissement émet, idempotent, remboursements partiels bornés), valorisation serveur des bons, allocation de pool financé (fermée sans financement), crédits de lignée provisoire/confirmé, simulation de règles sans mutation + journal de publication.
- **P7 (T43–T48)** : specs e2e mobiles/offline (limite appareil consignée), confidentialité (routes privées 401/no-store), charge locale (200 cycles = 82 ms ; EXPLAIN indexés), mesure produit (payloads assainis), déploiement par cohortes conditionné + script de contrôle, ce rapport.

## État par produiteur (transparence)

- **Actifs** : les sept producteurs T09 (randonnée, sentier, checklist, débrief, avis, carnet, itinérance) — nominal + refus + rejeu testés.
- **Preuve livrée, émission fermée (v2 non publié)** : compas_prepared, kit_improved, place_report_accepted, answer_accepted, place_photo, editorial/trace/gear_review/collectives — le moteur refuse `action_non_autorisee` jusqu'à publication datée (T42/T47).
- **Fermés par dépendance** : modules d'apprentissage (éditorial), activités vélos/urbaines/adaptées (sources de sessions), observations naturalistes, avantages commerciaux (financement), ligues (population).

## Migrations et retour arrière

Toutes additives, testées localement puis appliquées en prod par workdir isolé : `2026101014…-2026101118…` (verrouillage soldes, démo, réconciliation, niveaux, jobs, intentions, plafonds v2, capsule débrief, liaisons défis/missions/badges, préférences, découvertes, validations, opt-in/ligues, encaissement, publications, index). Chaque descente est dans `supabase/migrations_down/` et **ne supprime ni journal ni droit** ; le retour arrière applicatif redéploie Vercel sans perdre les nouveaux journaux.

## Limites déclarées (non maquillées)

- Webhook Stripe : **branchement code terminé et testé** (encaissement carte/remboursements/confirmation virement ; 35/35) — reste la clé webhook + un rejeu réel en environnement (l'émission commerciale s'ouvre ensuite, DEPLOYMENT.md §9).
- Financement du pool et budget des bons : inconnus → distribution fermée.
- Téléphone réel (VoiceOver/TalkBack, Capacitor) : non exécuté (aucun appareil) — specs web mobile vertes (3/3 Playwright local).
- Pilote de compréhension (≥ 8/10) : non exécuté (population réelle requise).
- Les suites d'intégration locales (producers, countries, phase2, a14, a15) sont réconciliées et vertes **séquentiellement** (43/43) — instructions dans NEXT_SESSION.md.

## Couverture des 25 domaines du plan (§3) — clos le 2026-10-11

| # | Domaine | Traitement | État |
|---|---|---|---|
| 1 | Identité | Titres de niveau conservés sans pouvoir ; distinctions dédupliquées (T15) ; visibilité privée par défaut (T16, T44). | Livré — permission/certif indépendants des XP |
| 2 | Progression | Barre + 4 compétences + jalons (T10/T11 ; `levelPresentation` 22 tests) ; 10 seuils conservés. | Livré — somme des compétences = gains ventilés (pgTAP/T-SQL alignés T08) |
| 3 | Passeport | Découvertes vérifiées (T18/T19) avec provenance réelle/déclarée/virtuelle ; export/suppression (T44). | Livré (privé par défaut) |
| 4 | Carte | Couche personnelle `DiscoveryMapLayer` (T20) sur cartographie existante, chargée à la demande ; IDs seulement. | Livré — aucune coordonnée exposée |
| 5 | Aventures | Bilan et états avant/pendant/après (T11/T14) ; hors-ligne visible en attente puis réconcilié une fois (e2e T43). | Livré |
| 6 | Matériel | Débrief final (T09), diff de kit (T23), avis matériel (T29), prêts (T32), interventions (T33). | Preuves livrées — émission v2 fermée |
| 7 | Compas | `preparationProof` + claim sentier/Compas exclusif (T22) ; checklist due (T09) ; trail_prepared v1 actif. | Livré — compas_prepared fermé (v2) |
| 8 | IA | Suggestions déterministes + IA facultative sans autorité (T17) ; injection testée. | Livré |
| 9 | Quêtes | 3 missions max (T13), avancement par événements (T14), fin = 0 XP (pgTAP mission_projection). | Livré |
| 10 | Défis collectifs | Présence (T30), tâches (T31), collectifs encadrés (T34) — doubles crédits exclus. | Preuves livrées — émission v2 fermée |
| 11 | Communauté | Corrections (T24), réponses (T25), médias (T26), éditorial/traces (T27/T28), réputation descriptive (T29). | Preuves livrées — émission v2 fermée |
| 12 | Classements | Opt-in compétition au retrait effectif (T35) ; 1 km fermé partout ; anti-énumération. | Livré — 1 km fermé |
| 13 | Ligues | Cohortes gelées ≥ 20 réels hors démo (T36, pgTAP 8/8). | Fermé — population réelle |
| 14 | Badges | Fusion 32→19 clés sans perdre les acquis ; 0 crédit au déblocage (T15, pgTAP 10/10). | Livré |
| 15 | Récompenses | Trois familles inventoriées (T37 ; scan 0 écart), encaissement (T38), bons (T39), pool (T40), lignée (T41) ; vues séparées documentées (`droits-et-couts.md`). | Moteurs livrés — UI avantages fermée par dépendance |
| 16 | Personnalisation | Rythme choisi (T16) ; registre d'adaptateurs (T21 : randonnée active, autres fermées). | Livré — adaptateurs fermés |
| 17 | Accessibilité | Aucun diagnostic collecté (rythme T16) ; suite a11y existante conservée ; limites appareil consignées (T43). | Partiel — appareil réel |
| 18 | Écologie | Actions encadrées confirmées (T34) ; aucun score carbone (doctrine) ; lieux fragiles protégés. | Livré — émission v2 fermée |
| 19 | Constance | Objectif hebdo + pause sans pénalité (T16, 8 tests). | Livré |
| 20 | Historique | Paginé avec source, date métier, version, correction (T11 ; 60/min, curseur). | Livré |
| 21 | Animations | Confirmations légères existantes ; reduced-motion couvert par la suite a11y ; aucune célébration d'un gain en attente. | Livré (existant conservé) |
| 22 | Notifications | Aucun push n'émet (aucun producteur v2 ouvert) ; préférences de rythme servies (T16). | Hors périmètre minimal — rien à fermer (aucune émission) |
| 23 | Administration | Simulateur + route gardée `is_admin` (T42), journal de publication, coupe-circuit par production fermé par défaut. | Livré |
| 24 | Fiabilité | Intentions atomiques (T06/T07), claims v2 (T08), outbox reprenable (T04), concurrence prouvée (pgTAP 23/23 + preuve 1 gagnant/1 refus). | Livré |
| 25 | Mesure produit | Payloads analytics assainis (T46), `mesures.md`, garde-fous coûts/refus (T45). | Livré — pilote compréhension fermé |

## Contrôles transversaux de fin (todo.md)

| Contrôle | Preuve | Verdict |
|---|---|---|
| Les tâches fermées sont signalées, jamais présentées comme actives | `status.json` : 48/48 vérifiées, 27 activées, 21 portes nommées ; ETAT « FERMÉ » avec raison | ✅ |
| Un même fait ne recrédite pas en changeant de barème, module, rôle ou support | Claims sans version (`includes_rule_version === false`, spec v2Registry), rejeux idempotents producteurs, claims partagés sentier/Compas, dédup médias, exclusivités correction/accessibilité et entretien/réparation | ✅ |
| Soldes, projections, droits historiques et corrections restent traçables | Décisions/transactions/outbox/journal d'encaissement ; reconstruction T02 sans recrédit ; descentes sans destruction | ✅ |
| Les comptes démo sont exclus des mesures et de la compétition | Scans 0 violation (`phase1_demo_and_projection_scan`, `economic_entitlements_scan`) | ✅ |
| Les métriques et tests déclarés ont réellement été exécutés | Batterie datée 2026-10-11 : vitest 8286/8286, pgTAP 1164, **build production réussi**, a11y 57/57 et verre 36/36, e2e mobile 14/14 (contre le build prod), gated 43/43, ledger prod vérifié (commits `4a3b3ddc`, `49e63ac2`) | ✅ |
