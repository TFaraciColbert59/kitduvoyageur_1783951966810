# Compas — banc de test complet (phase 7)

But : tester **100 % des boutons, fonctionnalités et possibilités du Compas** sur un aperçu
Vercel réel, avec une preuve par contrôle. Le banc a trois pièces :

1. **Inventaire statique** — `scripts/compas/inventory-controls.mjs` lit le code et liste
   chaque contrôle interactif (`docs/compas/phase7/inventaire-controles.{json,md}`).
2. **Banc E2E** — `tests/e2e-compas-full/` (projet Playwright `compas-full`,
   `playwright.compas-full.config.ts`) joue les scénarios dans un vrai navigateur, en ligne, et
   enregistre chaque contrôle réellement exercé.
3. **Rapport de couverture** — `scripts/compas/coverage-report.mjs` croise les deux : pourcentage
   par étape, et liste exacte de ce qui n'a pas été exercé, avec la raison.

Le banc ne touche ni `npm test` (Vitest exclut `tests/e2e-compas-full/`), ni le job CI
`e2e-compas` (`playwright.compas.config.ts`, hors réseau), ni aucun interrupteur.

---

## 1. Lancer

```bash
export COMPAS_BASE_URL=https://<déploiement>.vercel.app
export VERCEL_SHARE=<jeton du lien partagé Vercel>   # aperçu protégé ; JAMAIS dans un fichier
export PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome   # conteneur cloud

npm run test:compas-full                         # tout
npm run test:compas-full -- tests/e2e-compas-full/kit   # une étape
npm run test:compas-full -- --grep @etape:nous   # par étiquette
COMPAS_WORKERS=1 npm run test:compas-full        # un seul espace d'essai
```

Chaque passage écrit dans `proof/compas-full/<date>/` (non versionné) :

| Fichier | Contenu |
|---|---|
| `scoreboard.md` | tableau de bord : scénarios réussis / échoués / ignorés et contrôles vérifiés, par étape |
| `coverage-report.md` / `.json` | le même, plus **chaque contrôle non exercé et sa raison** |
| `coverage-runtime.json` | tous les enregistrements du navigateur (vérifiés ou non) |
| `report.json`, `html/` | rapports Playwright |
| `test-results/` | traces, vidéos et captures **des échecs** (`npx playwright show-trace …`) |
| `captures/` | captures demandées par les scénarios (`capture(page, 'nom')`) |
| `preparations.jsonl` | chaque préparation lancée : phrase, issue, durée, attente dans la file |
| `reprises.jsonl` | chaque reprise après une coupure réseau (jamais silencieuse) |
| `file-attente.jsonl` | attentes dues à la limite de préparations |

Relancer le rapport seul : `npm run compas:coverage -- proof/compas-full/<date>` (plusieurs dossiers :
leurs enregistrements sont réunis). `--strict` : code 1 tant que ce n'est pas 100 %.

### Ce que fait le banc pour vous

- **Connexion** : « Essayer sans compte » (un espace propre **par worker**), sinon « Connexion démo »
  (partagé : la file le traite comme une seule personne). Session réenregistrée après chaque test.
- **Aperçu protégé** : le lien `?_vercel_share=` est ouvert d'abord ; le cookie suit le contexte.
- **Téléphone** 393 × 852, densité 2, tactile, `fr-FR`, Europe/Paris, position simulée (Annecy).
- **Cookies refusés** d'avance (aucun traceur).
- **File des préparations** partagée entre workers **et entre passages**
  (`proof/compas-full/prep-ledger.json`, verrou) : 6 lancements / 10 min / personne
  (`COMPAS_PREP_PER_PERSON`), 12 / 10 min pour tout le banc (`COMPAS_PREP_GLOBAL`). Le délai du
  test est allongé du temps d'attente.
- **Reprise sur échec réseau** (`gotoRetry`) : 3 essais sur coupure, délai, 502/503/504 ; une
  erreur de l'application n'est jamais reprise. **Aucune reprise de test** (`retries: 0`) : un
  scénario qui ne passe qu'au deuxième essai est instable, compté échoué.

---

## 2. Ajouter un scénario

Un dossier par étape : `tests/e2e-compas-full/{ou,nous,resa,verdict,kit}/`. Le titre du
`describe` porte l'étiquette `@etape:<id>` (c'est elle qui range les résultats).

```ts
import { capture, expect, test } from '../_lib/fixtures';
import { detailsButton, flowTab, openStep, sheet } from '../_lib/compas';

test.describe('@etape:kit trouver', () => {
  test('« Trouver » → « Louer » montre les locations', async ({ page, cover, preparedTrip }) => {
    await openStep(page, 'kit');
    await cover.click(detailsButton(page, 'kit'), 'le tiroir du kit s’ouvre', () => expect(sheet(page)).toBeVisible());
    await cover.click(flowTab(page, 'Trouver'), 'l’onglet devient actif', () =>
      expect(flowTab(page, 'Trouver')).toHaveAttribute('aria-pressed', 'true'));
    await capture(page, 'trouver');
  });
});
```

**Règle d'or : un contrôle n'est crédité que par `cover.*`**, qui le décrit, l'active, puis
exécute l'assertion de son **effet** (décrit en mots). Un clic fait avec `locator.click()` est
enregistré (« activé sans assertion ») mais **ne compte pas**.

| Aide `cover.` | Geste |
|---|---|
| `click`, `check` | toucher, case |
| `fill`, `type` | saisie (d'un coup / touche par touche) |
| `select`, `setRange`, `press` | liste, curseur, touche clavier |
| `drag(loc, {dx, dy})` | glisser (poignée des tiroirs, capsule d'étapes, ligne d'objet) |
| `longPress`, `doubleTap` | appui long (fiche en grand), double-touche |

Option `{ control: '<id de l'inventaire>' }` : force le rattachement quand deux contrôles se
ressemblent (le rapport les liste « ambigus » sinon, et ne crédite aucun des deux).

Fixtures : `account` (espace du worker), `preparedTrip` (une aventure **réellement** préparée
par worker, phrase de référence « 3 jours de randonnée dans le Vercors à 2 »), `freshAccount`
(un espace neuf, sans voyage), `goOffline(true|false)` (hors ligne), `cover`.
Aides (`_lib/compas.ts`) : `openStart`, `openStep(page, etape)`, `stepButton`, `detailsButton`,
`sheet`, `flowTab`, `grab`, `setDetent`, `dragGrab`, `expectDetent`, `typeRequest`,
`launchPreparation` (passe par la file), `waitPrepOutcome`, `aiState` (IA allumée/éteinte,
observable sur le Compas vide), `expectNoHorizontalScroll`, `capture`.

Après un passage : `npm run compas:coverage -- proof/compas-full/<date> --update-registry`
inscrit au registre le scénario de chaque contrôle vérifié qui était « en attente ».

### Nouveau contrôle dans le code

`npm test` échoue (`tests/compas-bench/coverage-registry.spec.ts`) tant que le contrôle n'a pas
d'entrée au registre. Faire :

```bash
npm run compas:inventory                 # régénère l'inventaire
npm run compas:inventory -- --sync-registry   # ajoute « en_attente » (lot de l'étape)
```

puis écrire le scénario, ou remplacer `en_attente` par `raison_non_testable` (honnête et précise).
Un nouveau composant doit être classé (étape, écran) dans `scripts/compas/lib/inventory-config.mjs`,
sinon l'inventaire refuse de tourner.

---

## 3. Lire le rapport

- **Couverture = contrôles vérifiés / contrôles inventoriés**, par étape et au total, arrondie
  par défaut (99,96 % s'affiche 99,9 %). Une deuxième ligne donne le chiffre hors contrôles
  déclarés non testables — c'est un chiffre d'appoint, pas l'objectif.
- Raisons d'un contrôle non exercé : `non testable : …` · `activé sans assertion` · `déclaré
  couvert par « … » mais non exercé` (le registre ment : à corriger) · `en attente : lot …` ·
  `aucune entrée au registre`.
- **Ambigus** : un enregistrement qui ressemble à deux contrôles à égalité (même balise, nom
  calculé) ; ajouter `{ control }` au `cover.*`.
- **Non reconnus** : activations hors inventaire (coquille du site, bandeau, ou contrôle oublié
  par l'inventaire : à signaler).

### Comment un enregistrement est rattaché à l'inventaire

La sonde (`_lib/probe.ts`) décrit l'élément : balise, rôle, classes, nom accessible, classes des
parents, étape courante (capsule), écran (tiroir + onglet + hauteur). L'inventaire donne pour
chaque contrôle : balise, rôle, classes sûres, classes des parents dans son composant, et un
**motif** du nom (clés i18n résolues ; « … » = donnée). Le contrôle retenu est le plus spécifique
(texte littéral, classes, étape) ; à égalité, personne n'est crédité.

---

## 4. Inventaire : périmètre et conventions

- Parcourus : `src/features/compas/components/*.tsx`, `src/app/compas/*.tsx`, la carte
  `HubGlobeMap` et le profil `TravellerCard` (rendus dans le Compas). **Hors périmètre** : la
  coquille du site (barre d'onglets, bandeau cookies), `/connexion`, `/hub`, la boutique.
- Tables dépliées en un contrôle par ligne : capsule d'étapes (`COMPAS_STEPS`), 26 onglets de
  tiroir (`STEP_FLOWS`), tuiles d'activité (`ACTIVITY_ORDER`), options littérales de `<Segments>`.
- Un groupe `<Segments>` aux options calculées compte pour **un** contrôle (nom « … ») ; un
  `<button>` dans un `.map()` de données (liste d'objets, de jours, de membres) aussi : on teste le
  geste, pas chaque ligne de données.
- Le bouton générique de `<Segments>` est « délégué » (non compté) : chaque usage l'est.
- Identifiant stable : `fichier::composant::balise::clé i18n` (+ `#2`… pour les homonymes) ;
  il ne dépend jamais du numéro de ligne.

---

## 5. Ce qui ne peut pas se tester en session (honnêtement)

Ces contrôles resteront à **0 % automatisé** ou demandent une vérification à la main. Ils ne
sont pas marqués `raison_non_testable` d'office : le lot de l'étape tranche après essai.

| Contrôle(s) | Pourquoi | À la place |
|---|---|---|
| Paiement : « Voir le panier » puis commande (fiche objet › trouver) | Stripe réel : aucun paiement en test | vérifier l'ajout au panier et le lien, pas le paiement |
| « Voir l'offre », liens partenaires / affiliation (Résa › offres, nuits) | site tiers ; une réservation réelle n'est jamais lancée | vérifier `href`, `rel="sponsored nofollow"`, le bandeau de transparence |
| Recherche d'hébergement RouteStack, « Noter » une offre | seulement si la clé est active sur l'aperçu (mode test) | sauter proprement si absente (`test.skip` avec la raison) |
| Invitations « Accepter / Refuser / Voir » (Compas vide), « Qui doit quoi » | il faut DEUX comptes réels qui s'invitent ; un essai anonyme n'est pas invitable | à la main, deux comptes |
| Annonce « Bouteille » : « Lancer », « Retirer de la communauté », « J'ai 18 ans ou plus » | publie dans la communauté (public) ; à vérifier sur un compte de test non anonyme | à la main ou compte de test dédié |
| Profil voyageur (`TravellerCard`) | demandé seulement à un compte non anonyme jamais interrogé | compte de test neuf, non anonyme |
| Page d'erreur `/compas` (« Réessayer », « Retour au hub ») | exige une panne serveur ; aucune injection de panne sur l'aperçu | test unitaire / à la main |
| Alertes officielles (Meteoalarm, alertes mondiales) et leurs liens | n'apparaissent que si une alerte est en cours sur la zone | rejouer quand une alerte existe, ou en hors réseau (CI) |
| Explication IA du verdict, « Compris par l'IA » | dépend de l'interrupteur IA de l'aperçu (`aiState`) ; réponse non déterministe | vérifier la forme, jamais le texte |
| Carte 3D (`HubGlobeMap`), glisser/zoomer la carte | WebGL logiciel en tête ; gestes à plusieurs doigts impossibles à la souris | captures ; pincer = appareil réel |
| Haptique, vrai toucher, WKWebView (app Capacitor) | Chromium émule le tactile, pas un iPhone | passage sur appareil (check-list `TEST_REEL.md`) |
| Position réelle, capteurs | la position est simulée (Annecy) | appareil réel |
| Annonce « Annuler » au clavier (Ctrl/⌘ + Z) dans le délai | testable, mais dépend d'une modification préalable du voyage | scénario dédié dans le lot concerné |

---

## 6. Premier passage réel (18 oct. 2026, aperçu `kitduvoyageur-1783951966810-6p4jp5ff0`)

Chromium 1194, 2 workers, « Essayer sans compte » ouvert, IA allumée (mention visible sur le
Compas vide). Deux passages :

1. **3 / 5** : Verdict et Kit échouaient — le nom réel du bouton d'étape est « Kit , alerte : objet
   vital à trouver » (espace avant la virgule) ; l'aide `stepButton` et les motifs ne la
   toléraient pas. Le premier rapport créditait aussi l'onglet « Budget » à un bouton anonyme de la
   fiche objet : faux positif, supprimé (un nom entièrement calculé sans indice n'est plus jamais
   crédité par ressemblance).
2. **5 / 5 réussis** en 2,5 min, 3 préparations réelles « prêtes » (18 à 62 s), aucune attente dans
   la file, aucune reprise réseau. **18 / 302 contrôles vérifiés (5,9 %)** : Départ 2/38,
   Commun 7/49, Où 1/66, Nous 1/44, Résa 2/22, Verdict 2/13, Kit 3/70. 0 ambigu, 0 non reconnu.

Constats sur l'application (captures du passage, à vérifier par le lot concerné) :
- Résa › Nuits, aventure dans le **Vercors** : le lien partenaire proposé est « Hôtels, Chalets &
  Lodges à **Chamonix-Mont-Blanc** » (Booking.com) — l'écart déjà noté le 1er oct. réapparaît.
- Tiroir en grand : le crédit de carte « Powered by Esri · © OpenStreetMap » passe **par-dessus** le
  libellé « Chercher un hébergement pour ».

## 7. Limites connues du banc

- Le rattachement par motif est heuristique : il refuse de choisir en cas d'égalité, mais un
  contrôle au nom entièrement calculé (« … ») peut être crédité à son homonyme d'une autre étape
  s'il a plus de classes en commun. `{ control }` lève le doute.
- Un composant qui reçoit ses libellés d'une table non dépliée apparaît comme un seul contrôle.
- Les données réelles de l'aperçu changent (lieux, météo) : les scénarios vérifient la forme et
  la présence, pas les valeurs.
