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
