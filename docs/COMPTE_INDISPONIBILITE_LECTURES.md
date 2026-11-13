# Compte — lectures indisponibles et slots du drawer Profil

Date : 12 novembre 2026.

Périmètre : constats majeurs de la revue `lkdv-p01-network-design-review.jsonl`
sur le commit `6756d6c` (slots Vitrine / Souvenirs / Communauté / Prêts,
détail de confiance, réessai après un premier bootstrap en échec).

## Corrections livrées

- **Vitrine** : `statsUnavailable` et `statsDependenciesUnavailable` ne sont plus
  rendus comme « Aucune sortie publiée ». Le slot affiche un état
  `data-state="error"` avec « Statistiques momentanément indisponibles. ».
- **Souvenirs** : `outingsUnavailable` protège la timeline (« Sorties
  momentanément indisponibles. ») et `statsUnavailable` /
  `statsDependenciesUnavailable` protègent le passeport
  (« Passeport momentanément indisponible. »).
- **Communauté** : `clubsUnavailable` protège la lentille Clubs
  (« Clubs momentanément indisponibles. ») au lieu de « Aucun club. ».
- **Prêts** : `trustUnavailable` (source `materiel_loans`) protège les lentilles
  « Je prête » / « J'emprunte » ; les cartes de confiance utilisent le même
  drapeau pour le score, les prêts actifs, le taux de retour et la note. L'icône
  « vérifié » est neutralisée quand la lecture est indisponible.
- **Détail de confiance** : `TrustDetailSheet` applique la variable locale
  `trustUnavailable` aux trois agrégats (`active`, `onTimeRate`, `rating`), pas
  seulement au score.
- **Réessai** : `directHydratedRef` mémorise qu'une hydratation directe a déjà
  eu lieu. Un premier bootstrap en échec suivi d'un « Réessayer » ne repasse
  plus par la branche « premier chargement » qui écrivait `[]` dans les
  collections déjà affichées.
- **Dépendances de lecture** : `hiking_routes` et `geo_massifs` sont maintenant
  lus avec `safeRowsOrNull`. Le payload expose `statsDependenciesUnavailable`
  quand l'une de ces lectures échoue, pour éviter des compteurs massifs/pays à
  zéro et un passeport vide présentés comme réels.
- **Cohérence d'état** : `KitSlot` expose `data-state="error"` quand une lecture
  de kits ou d'inventaire est indisponible (au lieu de `empty`).

## Tests comportementaux ajoutés

- `VitrineStats.test.tsx` : stats indisponibles et dépendances illisibles.
- `MemoriesSlot.test.tsx` : timeline indisponible, passeport indisponible,
  priorité des listes directes.
- `CommunityClubs.test.tsx` : clubs indisponibles, priorité des clubs directs.
- `LoansSlot.test.tsx` : prêts indisponibles, absence de faux résumé à zéro,
  badge de confiance non vert, priorité des prêts directs.
- `KitSlot.test.tsx` : `data-state="error"` sur les deux lectures indisponibles.
- `CompteOverlayHost.test.tsx` : les trois agrégats du détail de confiance
  affichent `—` et ne laissent passer ni `90 %` ni `4.5`.
- `ProfileDrawerBootstrap.test.tsx` : premier bootstrap en échec, lectures
  directes réussies, puis « Réessayer » avec lectures directes en échec ; les
  carnets, commandes et clubs connus restent affichés.
- `accountBootstrapFollowStates.test.ts` : `hiking_routes` et `geo_massifs`
  illisibles alimentent `statsDependenciesUnavailable`, et restent à `false`
  quand ces lectures réussissent.

## Limites restantes (documentées, non corrigées ici)

> Les limites de lectures secondaires ci-dessous sont fermées par la vague
> S6.19 décrite en fin de document.

- **Enrichissements non couverts par un drapeau** : les lectures
  `badgeRows`, `challengeRows`, `highlightRows`, les items/images/produits de
  kits, les photos de sortie et les albums `story_highlights` restent lus avec
  `safeRows` (ou sans indicateur dédié). Un échec de ces tables peut donc encore
  produire un contenu partiel ou un état vide local, sans que le slot le sache.
  En particulier, la lentille « Souvenirs » (albums À la une) n'a pas de flag
  dédié.
- **Kits partiels** : `kitsUnavailable` ne couvre que `materiel_kits`. Un échec
  de `materiel_kit_items` peut laisser des cartes de kits sans contenu alors que
  `kitsUnavailable` reste `false`.
- **Compatibilité ancien serveur** : les nouveaux drapeaux sont optionnels. Un
  serveur antérieur qui renvoie des tableaux vides sans drapeau conserve
  l'ancien comportement (faux vide) ; la protection n'est pas rétroactive.
- **`isUsableBootstrap`** : le contrat de l'overlay exige encore au moins un
  champ « meaningful » parmi `profile`, `stats`, etc. Un payload authentifié
  qui ne porterait que des drapeaux d'indisponibilité serait rejeté. Le cas est
  latent aujourd'hui car `mapStats([])` renvoie toujours un objet avec des clés.
- **Portée de `statsDependenciesUnavailable`** : si `hiking_routes` ou
  `geo_massifs` échoue, toute la Vitrine stats et le passeport sont marqués
  indisponibles, même si les kilomètres/dénivelés restent lisibles. C'est un
  choix conservateur (ne pas afficher de massifs/pays faux).
- **Test de conception** : `tests/design/compte-social-v21.spec.ts` reste un
  test par recherche de chaînes. Le garde-fou comportemental de référence est
  `ProfileDrawerBootstrap.test.tsx` ; le test de conception n'a pas été
  remplacé.
- **Vérification** : exécution ciblée uniquement (tests Compte et
  `tsc --noEmit`), conformément à la demande : pas de build global, pas de
  réseau externe au modèle, pas de commit, pas de délégation. Les parcours E2E
  réels ne sont donc pas rejoués ici.

## Vérification exécutée

```bash
./node_modules/.bin/vitest run src/components/compte src/features/compte --reporter=dot
# 46 fichiers, 443 tests passés

./node_modules/.bin/tsc --noEmit -p .
# exit 0

./node_modules/.bin/eslint <fichiers modifiés>
# 0 erreur (avertissements préexistants uniquement)
```

Le test de réessai a été vérifié en rouge sans `directHydratedRef` (les carnets
reviennent à `[]`), puis en vert avec le correctif.

---

# S6.19 — lectures secondaires (12 novembre 2026)

Cette vague ferme les limites listées ci-dessus sans modifier la base ni le
contrat des données existantes.

## Comportements livrés

- **Badges** : `badgesUnavailable` couvre le catalogue `badges` et les
  obtentions `user_badges`. La lentille Trophées affiche « Badges
  momentanément indisponibles. » au lieu de « Aucun badge pour le moment. ».
- **Défis** : `challengesUnavailable` couvre `challenges`, `user_challenges`,
  `progression_challenges` et `user_progression`. La lentille Défis affiche
  « Défis momentanément indisponibles. » au lieu d’un faux « Aucun défi ».
- **Albums À la une** : `highlightsUnavailable` protège la liste
  `story_highlights` (« Albums momentanément indisponibles. ») et
  `highlightContentUnavailable` signale seulement le contenu partiel
  (`story_highlight_items`, stories archivées) sans masquer les albums lisibles.
- **Photos de sortie** : `outingPhotosUnavailable` couvre
  `hike_session_photos` dans le bootstrap ; la timeline affiche une note
  « Photos de sortie momentanément indisponibles. » sans cacher les sorties.
  Le drawer Sortie reçoit `photosUnavailable` et montre « Photos
  momentanément indisponibles. » avec « Réessayer » au lieu de « Aucune photo ».
- **Contenu des kits** : `kitContentUnavailable` couvre
  `materiel_kit_items` et `kitVisualsUnavailable` couvre les visuels
  (`kit_items`, `product_ownership`). Les cartes restent affichées ; le nombre
  de pièces devient `—`, la composition affiche « Composition momentanément
  indisponible. » et une note explique la lecture partielle.
- **Flux déjà définis raccordés** : `outings[].coverImage` est maintenant lu
  comme couverture de carte (sans gonfler le nombre de photos) et
  `highlights[].coverImage` comme repli de couverture d’album. Aucun visuel
  n’est fabriqué.
- **Préservation** : le runtime ne remplace plus `highlights` par `[]` quand
  `highlightsUnavailable` est vrai ; les albums connus restent affichés.

## Fichiers touchés

`accountBootstrap.ts`, `sorties.ts`, `CompteLiquidGlassV8.tsx`,
`VitrineSlot.tsx`, `CommunitySlot.tsx`, `MemoriesSlot.tsx`, `KitSlot.tsx`,
`KitCard.tsx`, `OutingCard.tsx`, `memoriesModel.ts`, `SortieDrawer.tsx`,
`OutingPhotos.tsx`, `DrawerShell.tsx`, `DetailDrawers.tsx` et ce rapport.

Aucune migration, aucune modification RLS, aucun fichier de la branche
confidentialité.

## Vérifications

Conformément à la consigne de Tony, aucune suite de tests ni build global n’a
été lancé dans cette vague.

```bash
./node_modules/.bin/tsc --noEmit -p .
# exit 0

./node_modules/.bin/eslint <fichiers modifiés>
# 0 erreur (avertissements préexistants uniquement)
```

## Vérifications futures (à la charge de Tony)

- Rejouer les tests de slots : badges indisponibles, défis indisponibles,
  albums indisponibles, contenu d’album partiel, contenu de kit indisponible,
  photos de sortie indisponibles.
- Ajouter un test de mapping bootstrap vérifiant chaque nouveau drapeau quand
  la table correspondante renvoie une erreur.
- Vérifier le drawer Sortie avec `hike_session_photos` en erreur (message +
  « Réessayer »), puis avec des photos réelles (aucune régression).
- Vérifier visuellement la timeline avec `outingPhotosUnavailable` et une
  couverture `coverImage` réelle.
- E2E mobile : ouvrir le profil, parcourir Vitrine > Trophées, Communauté >
  Défis, Souvenirs > Souvenirs, Kit > Kits et Sortie > Photos.
