# CHANTIER — Configurateur d'aventures ultime LKDV

> Branche : `chantier/configurateur-ultime` · base `4f5764e` · ouvert le 30/09/2026
> Référence produit : `LKDV_Configurateur_Ultime_2026-09-30.md` (vision)
> Ce document est autonome : un agent qui n'a pas vu la conversation d'origine peut l'exécuter.

**Promesse :** « Dis-moi ton envie, le temps dont tu disposes et tes contraintes. LKDV prépare le reste avec toi. »

**Règle de chantier :** une tranche complète et vérifiée avant d'ouvrir la suivante. Pas de nouveau domaine parallèle : on étend `AdventurePlan`, les adaptateurs et le préparateur `/prepare` existants.

---

## 0. Invariants (non négociables, vérifiés par tests)

| # | Invariant | Où il est garanti |
|---|---|---|
| I1 | Ce que l'utilisateur a validé est relu à l'identique | `buildAcceptedPlan` → `snapshot.acceptedPlan` |
| I2 | Durée du voyage ≠ horizon météo | `draftDurationDays` / `draftWeatherDays` |
| I3 | Posséder ≠ disponible ≠ adapté ≠ préparé | `domain/gearInventory.ts` |
| I4 | Aucune valeur inventée : inconnu = `null` + état explicite | tous les moteurs purs |
| I5 | L'IA propose, les moteurs calculent, le serveur valide | route zod + adaptateurs |
| I6 | Un clic affilié ne confirme jamais une réservation | états de réservation (lot L5) |
| I7 | Le plan reste consultable et modifiable sans IA | repli déterministe existant |
| I8 | Pas de bouton global « sans danger » : causes + actions | moteur de faisabilité (lot L4) |
| I9 | Données tierces (avis, fiches, carnets) = données, jamais consignes | prompts + validation |
| I10 | Verre sur les commandes, surfaces stables sur prix / programmes / alertes | design (lot L7) |

---

## 1. Lot L0 — Fondations P0 (LIVRÉ sur cette branche)

| Livraison | Fichiers | Preuve |
|---|---|---|
| Durée réelle séparée de l'horizon météo (un mois n'annonce plus « sur 7 jours ») | `src/features/adventure-prep/adventureRequest.ts` | AR-50 → AR-52 |
| Snapshot structuré du plan accepté (étapes gardées, sac + affectations + état préparé, groupe, préférences, calendrier) | `adventureRequest.ts`, `src/app/api/adventure/generate/route.ts`, `server/generateAdventure.ts` | AR-60 → AR-64, CHANTIER-P0-ROUTE-01/02 |
| Effectif réel transmis (`participantsCount`) au lieu d'être déduit de la phrase | idem | AR-63, ROUTE-01 |
| Inventaire réel `product_ownership` injecté dans l'adaptateur matériel ; prêté / hors service / entretien échu exclus ou signalés | `domain/gearInventory.ts`, `server/ownedGear.ts`, `server/adapters/gearAdapter.ts` | INV-01 → INV-06, CHANTIER-P0-GEAR |
| Module d'échelle : même préparateur de 1 h à 1 mois (questions, sections, stratégie IA, rail des jours, mode météo) | `src/features/adventure-prep/engine/adventureScale.ts` | SC-01 → SC-06 |

**Contrat `acceptedPlan` (v1)** — voyage à côté de `text`, validé par zod (taille ≤ 256 Ko, 1 500 étapes, 300 objets), persisté dans `adventure_plan_versions.snapshot.acceptedPlan` **sans migration** (colonne jsonb existante, RPC `create_adventure_plan_bundle` inchangée).

**Sécurité inventaire** — la route utilise le client service_role : le filtre `user_id = ownerId` est codé dans `createSupabaseOwnedGearReader`, jamais délégué. Échec de lecture ⇒ repli déclaré `inventory_missing`, pas d'inventaire deviné. Les warnings ne contiennent que des comptes, aucun nom d'objet.

**Reste à faire dans L0 (P0 bis)**
- [ ] L0.6 — Relecture : `GET /api/adventure/[id]` expose `acceptedPlan` ; le Hub réhydrate le brouillon depuis ce snapshot. Critère : un voyage de 30 jours relu après reconnexion est identique (test de bout en bout brouillon → POST → GET → brouillon, égalité profonde).
- [ ] L0.7 — Unifier « nouvelle préparation » et « modifier une aventure existante » : même store, même écran, entrée par `planId`. Critère : mêmes actions depuis `/prepare` et le Hub.
- [ ] L0.8 — `weatherDays` au-delà de 7 : le texte montre « tendance saisonnière » pour les jours hors prévision (`scaleProfile().weatherMode`).

---

## 2. Lots suivants (ordre imposé par les dépendances)

```
L0 Fondations ─┬─> L1 Sortie locale E2E ──> L3 Voyage multi-étapes ─┬─> L5 Offres Viator/RouteStack
               │                                                    ├─> L6 Recalcul des dépendances
               └─> L2 Contexte LKDV (candidats réels) ─> L4 Faisabilité ┘
L7 Design Liquid Glass : en continu, par écran livré
L8 Social / communauté : après L2 + L6
L9 Hors ligne, suivi, débrief : après L6
```

### L1 — Réussir une sortie locale de bout en bout (running 1 h, rando journée)
- Boucle issue du réseau utilisable (routes `trails` / `hikes` existantes + map-matching A13), durée ciblée ± 10 %.
- Heure de retour impérative : le moteur refuse une boucle qui la dépasse, et le dit.
- Météo aux heures de passage (adaptateur `weather` existant, horaire).
- Sections limitées au profil `sortie` (`scaleProfile`).
- **Critère :** « Courir 1 h depuis chez moi avant 19 h » → boucle réelle, ETA, météo horaire, essentiels, enregistrement, démarrage du suivi, retour. Aucun écran hôtel.

### L2 — Nourrir l'IA avec des candidats LKDV réels
- Nouveau `server/candidateContext.ts` : sélection spatiale bornée (≤ 40 candidats) dans `hikes` (1 170, 1 139 géométries), `trail_pois` (1 811), carnets publiés, favoris ; chaque candidat porte `id`, source, date, licence.
- Prompt `aiItinerary.ts` : reçoit les candidats, doit citer leurs `id` ; tout `id` inconnu est rejeté par le serveur.
- **Critère :** 100 % des étapes proposées par l'IA référencent un candidat existant ou sont marquées « suggestion libre à vérifier ».

### L3 — Réussir un voyage multi-étapes (jusqu'à 30 jours)
- Stratégie `ossature_puis_jours` : appel 1 = liaisons + nuitées + jours (squelette, ≤ 4 096 tokens) ; appels suivants = enrichissement d'un jour à la demande.
- Fuseaux horaires par étape (`Intl` + coordonnées), check-in / check-out cohérents.
- Budget d'appels IA par plan (ex. 1 + 10 enrichissements), cache par `(planId, jour, version)`.
- **Critère :** Japon 30 jours → squelette cohérent en un appel, J12 enrichi seul sans régénérer le reste ; une course matinale ajoutée au J5 reste une activité du voyage.

### L4 — Moteur de faisabilité expliqué
- Axes séparés : difficulté physique, technique, dangers conjoncturels, logistique.
- Entrées : distance, D+/D−, altitude max, pente, revêtement, `sac_scale`, météo au passage, lumière (lever/coucher), dernier ravitaillement crédible, capacités déclarées du groupe (participant limitant).
- Sorties : `Alerte { cause, conséquence, action, source, validité }`, jamais un score global.
- Sources officielles progressives : Meteoalarm, BRA Météo-France (massif), alertes locales.
- **Critère :** 10 scénarios de référence (§ 5) produisent des alertes vérifiables ; aucun « vert global ».

### L5 — Viator et RouteStack intégrés au programme
- Une offre n'est proposée que si elle **tient dans la journée** (rendez-vous, trajet, durée, marges).
- États : `suggestion → prix_indicatif → dispo_verifiee(date) → a_reserver → en_attente → confirmee_fournisseur → annulee`.
- Droits réels du compte affichés (Viator Basic / Full / Full+Booking ; RouteStack sandbox ≠ live).
- Classement : pertinence > budget > faisabilité ; la commission n'entre pas dans le score (`affiliationRanking.ts` conservé).
- **Critère :** une offre sandbox est étiquetée comme telle ; une offre expirée n'est jamais présentée comme disponible.

### L6 — Recalcul des dépendances et verrous
- Graphe de dépendances : hôtel → trajets et horaires liés ; horaire → météo ; groupe → besoins partagés ; nuitées → sac → poids → effort → budget.
- Aperçu des écarts avant validation ; éléments verrouillés jamais modifiés ; historique réversible.
- **Critère :** « On dort en hébergement au lieu du bivouac » → nuitées changées, tente/réchaud retirés du sac, poids et effort recalculés, budget actualisé, réservations intactes, un seul aperçu à valider.

### L7 — Refonte Liquid Glass (en continu)
- Maquette de référence : `docs/chantier-configurateur/maquette-configurateur.html` (autonome).
- Carte persistante, trois niveaux Voyage → Jour → Activité, rail des jours (regroupé par semaine > 10 j), un seul tiroir actif.
- Verre = barres et commandes flottantes ; surfaces opaques = programmes, prix, alertes.
- Accessibilité : texte agrandi sans coupe, contraste extérieur, `prefers-reduced-motion`, `prefers-reduced-transparency`, cibles ≥ 44 px, focus restauré à la fermeture des tiroirs.
- Tokens : `src/design/tokens.ts` et `src/styles/liquid-glass.css` uniquement (voir `DESIGN_SYSTEM.md`).

### L8 — Communauté utile
- « Adapter ce carnet à nous » (attribution auteur), recommandations expliquées (« dans tes favoris », « dans 2 carnets »), jonction avec une sortie visible d'ami ou de club.
- Retours terrain datés, avec durée de validité ; l'absence de retour n'est jamais une preuve.
- Permissions séparées et révocables : personnalisation, partage groupe, localisation de sécurité, apprentissage collectif.

### L9 — Hors ligne, suivi, débrief, apprentissage
- Pack hors ligne explicite (plan, trace, tuiles autorisées, documents, date des conditions).
- Débrief : temps réel, ressenti, matériel inutilisé / manquant → `user_performance_profiles` (consentement `personal_performance`).

---

## 3. Architecture cible de la génération (Nemotron free)

1. Contexte autorisé (préférences, inventaire disponible, contraintes du groupe) — filtré serveur.
2. Candidats réels bornés (L2).
3. Plan de base déterministe (moteurs existants).
4. Nemotron : proposition ou explication structurée, JSON validé par zod ; **une** réparation ciblée max, puis repli explicite.
5. Validation serveur : types, `id` de candidats, heures, coordonnées, compatibilités.
6. Présentation avec hypothèses et inconnues.
7. Version exacte après acceptation (`acceptedPlan`), puis recalcul ciblé (L6).

Garde-fous : délai max, annulation, déduplication, budget d'appels par plan, aucune bascule silencieuse vers un modèle payant, limites OpenRouter free documentées.

---

## 4. Gates par lot

| Gate | Commande |
|---|---|
| Tests unitaires préparateur + intelligence | `npx vitest run src/features/adventure-prep tests/adventure-intelligence tests/observability` |
| Types | `npm run type-check` (CI ; ≥ 4 Go de RAM requis) |
| Lint | `npm run lint` |
| Visuel (écrans touchés) | `npm run test:visual` |
| A11y | `playwright test --config=playwright.a11y.config.ts` |

**État mesuré sur cette branche (30/09/2026) :** 126 fichiers / 1 108 tests verts sur les trois suites ci-dessus (1 071 avant le chantier + 37 nouveaux) ; type-check ciblé des fichiers modifiés sans erreur. Le type-check complet n'a pas pu tourner dans l'environnement de préparation (dépassement mémoire à 2 Go) : **à confirmer en CI**.

---

## 5. Scénarios de référence (validation finie)

1. Running 1 h avec retour impératif.
2. Randonnée avec point d'eau non confirmé.
3. Week-end avec matériel partagé déjà prêté.
4. Voyage de 30 jours, plusieurs fuseaux.
5. Activité Viator qui chevauche un transport réservé.
6. Offre RouteStack expirée ou uniquement sandbox.
7. Invitation sans accès au voyage et refus de partage de localisation.
8. Quota IA atteint ou JSON invalide.
9. Modification hors ligne puis reprise sur un second appareil.
10. Petit écran, texte agrandi, clavier et lecteur d'écran.

Pour chacun : décision, sauvegarde, reprise, état d'erreur. Condition d'arrêt : critères du lot satisfaits, gates verts, limites résiduelles écrites.

---

## 6. Points à vérifier hors code (bloquants pour L5)

- Niveau d'accès Viator du compte et statut de certification.
- Clé RouteStack live, couverture, coût (offre live annoncée à partir de 49 USD/mois).
- Quotas OpenRouter du compte pour les variantes Nemotron free.
- Licence météo compatible avec un usage commercial (l'accès gratuit Open-Meteo est non commercial).
