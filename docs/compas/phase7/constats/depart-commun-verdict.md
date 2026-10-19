# Constats — lot Départ, Commun, Verdict (phase 7)

Dernier passage réel : `proof/compas-full/dcv-9` (aperçu `kitduvoyageur-1783951966810-9gsrib57l`, téléphone 393 × 852, 1 worker, IA allumée).
Identifiants D-31 à D-33 (plage choisie pour ne pas entrer en collision avec les autres lots).

## Défauts de l'application (scénarios gardés en échec)

| Id | Où | Observé | Attendu |
|---|---|---|---|
| D-31 | Commun › carte › « Personnaliser la carte » | « Carte nue » et « Tout afficher » (pied du panneau) sont recouverts par la barre d'onglets du site : le toucher est intercepté (`<a class="lkv-nav-tab">`). Exercés au clavier (Entrée) pour le crédit. | Boutons atteignables au toucher (panneau remonté ou défilant). |
| D-32 | Commun › carte › « Personnaliser la carte » | Le crédit « Powered by Esri · © OpenStreetMap » passe par-dessus la grille des calques (Hébergements, Transports…). | Le panneau passe au-dessus du crédit. |
| D-33 | Départ › tuiles d'activité (et autres boutons à icône) | Le nom accessible est « footprints Randonnée » : l'icône n'est pas masquée (`role="img"` + `aria-label`). Idem « check Appliquer (1) ». | Nom « Randonnée » ; icône `aria-hidden`. |

Captures : `proof/compas-full/dcv-9/test-results/commun-controles--…-lisible…/` et `depart-controles--…-footprints…/`.

## Contrôles non testables en session (raison précise)

- Départ › profil voyageur (4 : liste, « Lyon », « Enregistrement… », « Passer ») : demandé seulement à un compte non anonyme jamais interrogé ; l'essai sans compte ne le reçoit jamais.
- Départ › invitations (3 : « Refuser », « Accepter », « Voir ») : exigent deux comptes réels qui s'invitent.
- Commun › page d'erreur (2 : « Réessayer », « Retour au hub ») : exige une panne serveur, aucune injection de panne possible sur l'aperçu.
- Commun › ligne de résumé en lien (`a.cp-fr`) : `SummaryRow` n'a aucun appelant qui passe `href` (branche jamais rendue) ; à retirer ou à utiliser.
- Commun › « Appliquer : … » (prochaine décision) : le moteur ne l'offre que pour « Répartir le matériel commun » entre plusieurs membres ; l'aventure de référence est solo (décision « Trouver : trousse… », « Voir » seul).
- Commun › « Garder mon voyage » : rendu seulement si `NEXT_PUBLIC_KEEP_TRIAL=on` ; éteint sur l'aperçu.
- Verdict › « Décaler » : proposé seulement si la prévision MET Norway (≈ 9 jours) donne un jour « mauvais » sur les dates et une meilleure fenêtre à ± 3 jours ; dépend de la météo réelle. Essayé avec des dates de février : aucune proposition (dates remises à 5–7 juin).
- Verdict › alertes officielles (4 : Meteoalarm, www.meteoalarm.org, texte officiel, alertes mondiales) : n'existent que si une alerte est en cours sur la zone.

## Notes sur le banc et l'environnement

- `npm run test:compas-full` échoue sous Windows (`spawnSync('npx')` sans shell : ENOENT, aucun test lancé). Contournement : `npx playwright test --config=playwright.compas-full.config.ts …` puis `node scripts/compas/coverage-report.mjs <dossier>`.
- « Essayer sans compte » est limité à 5 par heure et par adresse (`trial-login`) ; trois lots partagent l'adresse. Le lot garde donc son espace d'essai (`proof/compas-full/dcv-state/account.json`) et son aventure préparée d'un passage à l'autre (`commun/_fx.ts`).
- Dans Playwright Test, `browser.newContext()` reprend la session du test : la page « sans session » vide explicitement `storageState`.
- Le scénario Dis-le laisse l'enveloppe de l'aventure à 900 € (modification faite par le test, annulée une fois).
- Des enregistrements « non reconnus » apparaissent pour des clics internes à `cover.*` (« Ski », « Durée : plus »…) : les contrôles sont crédités par `{ control }`.
