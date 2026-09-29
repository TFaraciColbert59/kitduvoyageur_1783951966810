# I2, I4 et L3.9 - etat reel verifie le 2026-09-29

Ce document ne remplace pas la checklist : il en enregistre la **verification**,
faute de quoi les items restent ouverts sur une base obsolete. Aucun fichier
CHECKLIST-PREP.md n'a ete touche, conformement au perimetre.

---

## I2 - l'interface de routage n'est pas la ou la checklist l'annonce

**Ce que la checklist annonce** : un fichier `RoutingProvider.ts`.
**Etat reel** : **0 occurrence** de `RoutingProvider` dans tout le depot
(le seul fichier qui cite ce nom est `CHECKLIST-PREP.md` lui-meme, ligne 1902).
L'identifiant qui existe reellement est `RouteProvider`, et il ne vit pas dans
un fichier dedie : c'est un type de provenance
(`src/features/adventure-prep/engine/provenance.ts`), consomme par
`routingService.ts:16`.

L'equivalent fonctionnel de l'interface annoncee est donc, en deux morceaux :

| Role | Fichier reel |
|---|---|
| Types + orchestration du calcul d'itineraire | `src/features/adventure-prep/engine/routing.ts` |
| Acces aux fournisseurs (OSRM, Valhalla, BRouter, Open-Meteo) | `src/features/adventure-prep/routingService.ts` |
| Adaptateur navigateur (appels `/api/route`, `/api/weather`) | `src/features/adventure-prep/browserMeasurements.ts` |
| Raccordement au moteur | `src/features/adventure-prep/store/useAdventurePrepStore.ts:300` |

**Tranche** : l'item est une **erreur de nom dans la checklist**, pas une interface
manquante. La couche existe, elle est branchee, et elle a meme ete corrigee depuis
(les trois fournisseurs, les profils par mode, voir I1). **Le fichier n'a pas ete
renomme** : `routingService.ts` est hors du perimetre de cet agent, et un renommage
presenterait un cout de diff sans gain. Aligner la checklist sur
`routingService.ts` est la suite correcte.

---

## I4 - le cache de routage est bien en memoire seule

**Etat reel, cite** :

- `routingService.ts:133` — `const CACHE_TTL_MS = 60 * 60 * 1000;`
- `routingService.ts:134` — `const CACHE_MAX = 200;`
- `routingService.ts:136` — `const cache = new Map<string, { at: number; value: unknown }>();`
- `routingService.ts:146` — expiration des que `Date.now() - hit.at > CACHE_TTL_MS`
- `routingService.ts:154` — eviction des que `cache.size >= CACHE_MAX`

**Aucune table `route_cache`** : ni schema, ni migration, ni requete SQL dans le
depot. Le cache vit dans la memoire du processus et disparait a chaque redeploiement
ou redemarrage.

**Tranche** : l'item **reste ouvert**, et il ne peut pas etre ferme depuis le
perimetre de cet agent. Fermer I4 suppose une table, une migration et une politique
d'invalidation : trois artefacts dont aucun n'appartient a
`engine/itineraryPhases.ts`, `engine/generation.ts`,
`engine/aiItinerary.ts`, `AdventurePrepShell.tsx` ou `store/`.
Ce que le moteur garantit en revanche, et qui reste vrai quel que soit le support :
un cache perdu ou expire ne fait **jamais** perdre une distance. Le regime est
`null`, jamais `0`.

---

## L3.9 - Distance / Budget : le blocage par I1 etait perime

**Ce que la checklist dit** (ligne 2262) : « Distance / Budget affichent
« À vérifier » — **bloqué par I1** ».

**Tranche : ce blocage est perime, et l'item se decompose en deux causes distinctes,
aucune commune avec I1.** Preuve : `__tests__/gen-l39-mesures.test.ts` (7 tests).

### Distance - cause : le routeur, pas le mode

- La valeur lue est `model.totals.distanceKm` (`engine/metrics.ts:109-110`).
- Le seul code qui la renseigne est le runner `trace`
  (`engine/itineraryPhases.ts:748-750`). Son defaut, `NO_MEASUREMENTS`
  (`engine/measurements.ts:237-240`), est une identite : sans routeur, la
  distance reste `null` — donc « À vérifier ».
- Le mode de deplacement ne peut **pas** provoquer ce `null` :
  `travelModeFor` (`engine/routing.ts:55-57`) ne renvoie qu'un mode, et
  `routeItinerary` (`engine/routing.ts:356-363`) l'applique a toutes les
  journees. Un parcours **reussi** en `pieton` produit un nombre ; c'est
  l'absence de reponse du fournisseur qui produit « À vérifier ».

Tests : `L39-1` (absent => a_verifier, jamais 0), `L39-2` (present =>
nombre), `L39-5` / `L39-6` (le run complet, avec et sans routeur).

### Budget - cause : le montant saisi, pas le mode

- La valeur lue est `model.budgetPerPerson.amount` (`engine/metrics.ts:117-122`).
- Elle est copiee du brouillon, et **rien d'autre** ne l'ecrit
  (`engine/itineraryPhases.ts:431-435`) :
  `draft.preferences.budgetPerPerson === null ? { amount: null } : …`.
- Un palier de budget sans montant ne produit donc **aucune** valeur : l'item se
  ferme sur une entree de saisie, pas sur le profil de routage.

Tests : `L39-3` (absent => « À vérifier »), `L39-4` et `L39-7` (la valeur
suit le brouillon, elle ne suit ni le routeur ni le mode).

### Ce qui reste reellement ouvert

La tuile **Budget** ne peut pas afficher un nombre tant que le montant par personne
n'est pas saisi. C'est le reliquat de l'item **C13**, traite par un autre agent sur
`PrepSetupSheets.tsx` — hors de mon perimetre, non touche. La tuile
**Distance** n'a plus de blocage de mon cote : elle se deverouille des la phase
`trace` reussie.
