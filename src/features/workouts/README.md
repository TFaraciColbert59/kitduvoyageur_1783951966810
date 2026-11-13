# Entraînement — plans, séances guidées et récupération

Périmètre : `S2.28` (plan course), `S2.29` (plan vélo), `S2.30` (séances
instantanées), `S2.31` (séance guidée et envoi montre), `S2.36` (récupération).

## Décision d'architecture

- **Contrats purs et versionnés** dans `domain/` : plan, semaine, séance,
  étape, cible, exécution, envoi, récupération. `WORKOUT_CONTRACT_VERSION = 1`.
- **Aucune migration ni table nouvelle.** L'exécution est locale
  (`localStorage`, clé `lkdv.workouts.active.v1`) et embarque la séance
  complète, pour qu'une séance instantanée puisse être reprise sans historique
  serveur. Le rattachement à une séance canonique A04/A05 reste à faire quand
  ces contrats seront livrés ; il n'est pas simulé ici.
- **Aucune API partenaire inventée.** Runna et CTS sont déclarés
  indisponibles (`no_license`) ; Garmin est indisponible (`connector_absent`).
  Les plans affichés sont natifs LKDV (`provider: 'lkdv'`).
- **Aucune puissance vélo inventée.** Sans FTP mesuré, les cibles vélo sont
  RPE + cadence. Le contrat accepte `power` pour un futur adaptateur, mais les
  plans générés n'en produisent pas.
- **Aucune donnée capteur inventée.** L'historique est lu depuis
  `payload.outings` du bootstrap Compte. Cette source ne porte pas le sport :
  `sportStatus` reste `unknown` et le nombre de sorties est utilisé seul. Sans
  sortie lisible, l'état est explicitement `absent`.

## Emplacement

`Compte` → drawer Profil → capsule `Entraînement` (slot `entrainement`).
Les sections internes sont `Course`, `Vélo`, `Séances`, `Récupération`.
Aucune page dédiée, aucun filtre standard, aucun écran de calcul.

## Envoi montre

`planWatchTransfer` produit un plan de capacité et un payload JSON neutre
(`encoding: 'lkdv_json'`). Ce n'est ni du FIT ni un appel Garmin. Sans
connecteur connecté et capable de `structured_workout`, le statut est
`unavailable` ou `unsupported` ; l'exécution locale reste `available`.

## Récupération

Le programme est relié à la dernière pratique réelle (`outings`). Il est
`absent` sans pratique ou après 48 h, `rest` en cas de douleur importante, et
`ready` sinon. Les exercices sont de la mobilité générale, sans prescription
médicale.

## Tests ciblés

```bash
./node_modules/.bin/vitest run src/features/workouts/__tests__ \
  src/components/compte/drawer/workouts/__tests__
```

Couverture : plans et progression, absence d'API partenaire, séances
instantanées, moteur de séance (pause/reprise/saut/fin), persistance locale,
envoi montre, récupération, lecture des sorties Compte, UI du drawer.
