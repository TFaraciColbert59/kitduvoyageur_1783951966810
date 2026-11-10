# ADR-V6-001 — Architecture du moteur de préparation Compas v6

**Date :** 2026-11-10
**Statut :** Proposé — relecture `architect` consignée en fin de document.
**Source :** `docs/compas/SPEC-V6-MOTEUR.md`, lecture de `main` au commit `571142e`.
**Décideur des points ouverts :** Tony (D1 à D5, section 9).

---

## 1. Contexte

Le moteur actuel va de la phrase au voyage par une seule action serveur (`runAutofill`, `server/autofillActions.ts`, lignes 1447 à 3067). La phrase est lue par des règles écrites à la main (`engine/intent.ts` et quatre fichiers par langue), qui produisent des actions (`set_destination`, `set_duration`…) appliquées une à une au voyage. Les réglages sont ensuite relus par `engine/tripContext.ts`, l'itinéraire choisit des lieux à bonne distance (`engine/itinerary.ts` + `engine/activityProfile.ts`), et le recalcul partiel compare une empreinte de 16 réglages pour 5 parties (`engine/dependencies.ts`).

Trois limites structurent ce chantier :

1. **Pas d'objet intermédiaire.** Ce que le moteur a compris n'existe nulle part en un seul endroit : c'est la somme de colonnes de `trips`, de clés de `metadata.compas` et de préférences. On ne peut ni le montrer, ni dire d'où vient chaque valeur, ni empêcher une valeur modifiée par la personne d'être écrasée.
2. **Pas de savoir par activité.** Sept profils de déplacement à trois distances ; tout le reste est un « séjour sur une base ».
3. **Pas de mesure.** Le banc dit « prête » et « lieu juste » ; il ne dit pas si le plan est complet ni faisable.

## 2. Décision d'ensemble

Le moteur devient une chaîne de cinq maillons purs, chacun derrière son interrupteur, éteint par défaut. L'ancien chemin reste celui de la production tant que la porte de la phase n'est pas franchie.

```
phrase ──► Brief ──► segments (archétypes) ──► planificateur ──► invariants ──► voyage
            │              │                        │                │
   COMPAS_V6_BRIEF  COMPAS_V6_ARCHETYPES   COMPAS_V6_PLANNER  COMPAS_V6_CHECKS
                        le tout ordonné par le graphe de tâches (COMPAS_V6_GRAPH)
```

| Maillon | Module (pur) | Entrée | Sortie | Phase |
|---|---|---|---|---|
| Mesure | `engine/score/` | voyage lu en base + demande attendue | 4 notes sur 100, détail par critère | 0 |
| Brief | `engine/brief/` | phrase, règles, IA (si D1), profil, historique | `Brief` typé | 1 |
| Archétypes | `engine/archetypes/` | activité, niveau, saison | barèmes sourcés, journée type | 2 |
| Segments | `engine/archetypes/segments.ts` | Brief | suite de segments datés | 2 |
| Invariants | `engine/checks/` | voyage, Brief, archétype | constats avec gravité et réparation | 3 |
| Planificateur | `engine/planner/` | Brief, segments, monde | 3 candidats notés | 5 |
| Graphe | `engine/graph/` (remplace `dependencies.ts`) | Brief d'avant, Brief d'après | tâches à relancer | 5 |

Les modules `engine/` restent sans entrée-sortie. Tout accès (base, IA, réseau) vit dans `server/`.

### 2.1 Interrupteurs

Un seul lecteur : `engine/v6Flags.ts`, fonction pure `v6Flags(env)` qui rend `{ brief, archetypes, checks, planner, graph }`. Une valeur est allumée seulement si la variable vaut exactement `1`. Dépendances imposées : `archetypes` exige `brief` ; `planner` exige `archetypes` et `checks` ; `graph` exige `brief`. Une combinaison incohérente éteint le maillon dépendant (jamais d'erreur à l'exécution). Les variables sont lues côté serveur uniquement (aucun `NEXT_PUBLIC_`).

### 2.2 IA éteinte (R4)

`AI_MODE=off` court-circuite l'extraction : le Brief est alors rempli par les règles, le profil, l'historique et les défauts. Le voyage annonce « compris par les règles » comme aujourd'hui. `intent.ts` n'est jamais supprimé.

## 3. Le Brief

### 3.1 Forme

```ts
type Source = 'dit' | 'profil' | 'historique' | 'deduit' | 'defaut';
interface BriefValue<T> {
  value: T | null;
  source: Source;
  confidence: number;      // 0 à 1
  evidence: string | null; // passage exact de la phrase quand source = 'dit'
  locked: boolean;         // modifiée par la personne : plus jamais écrasée
}
```

Le Brief est un objet à onze blocs (`projet`, `ou`, `quand`, `qui`, `effort`, `nuits`, `repas`, `transport`, `budget`, `risque`, `materiel`), chaque feuille étant une `BriefValue`. Le schéma zod est la seule source du type, du schéma JSON donné à l'IA et de la liste des variables. La première version compte 76 variables (celles que le moteur sait déjà consommer ou que le banc mesure) ; la cible de 150 à 250 est atteinte par ajouts successifs, chacun avec son consommateur : une variable que rien ne lit n'entre pas.

### 3.2 Règles de valeur

- **R2, vérifiée par le code et non par confiance** : `source = 'dit'` exige que `evidence` soit retrouvée dans la phrase après normalisation (casse, espaces, apostrophes typographiques, forme Unicode NFC). Sinon la valeur est rejetée et la variable retombe sur la source suivante. Cela vaut pour l'IA comme pour les règles.
- **R1** : aucune variable du Brief n'est une coordonnée, un prix constaté, un horaire ou une distance réelle. Le Brief contient des *souhaits* (« 15 km par jour », « 800 € ») et des *noms* (« Annecy »). Le lieu est retrouvé ensuite par `resolvePlaceByName`, inchangé. Les types le garantissent : aucun champ `lat` / `lon` dans le schéma.
- **Verrou** : `locked = true` ne peut être levé que par la personne. La fusion ne remplace jamais une valeur verrouillée, quelle que soit la source entrante.
- **Ordre de priorité à la fusion** : verrouillée > dit > profil > historique > déduit > défaut. À source égale, la confiance la plus haute gagne.
- **Désaccord règles / IA** sur une valeur dite : la valeur des règles gagne pour un nombre ou une date, celle de l'IA sinon ; accord = confiance 0,95 ; désaccord = confiance 0,6 et une ligne de journal (`ops_preparation_events`, sans la phrase entière).

### 3.3 Vie privée (R5) — décision structurante

Un voyage se partage ; son Brief aussi. Or le profil (`user_traveller`, `user_orientation`) et l'historique (`hike_sessions`) sont privés. Donc :

- La table `trip_briefs` ne range **que** les valeurs de source `dit`, `deduit`, `defaut` et les valeurs verrouillées par la personne. Une valeur de source `profil` ou `historique` n'est **jamais écrite** : elle est recalculée côté serveur, pour le propriétaire, au moment de préparer (« surcouche privée »).
- Conséquence assumée : un collaborateur voit le résultat (des journées plus courtes), pas la valeur privée ni sa source. C'est déjà le cas aujourd'hui pour les préférences.
- Un contrôle à l'écriture (`briefForStorage`) retire toute valeur `profil` / `historique` et un test le prouve ; la porte 1 le relit en base.
- Rien du profil ni de l'historique n'entre dans la consigne donnée à l'IA : l'extraction ne reçoit que la phrase et la date du jour.

### 3.4 Stockage

`trip_briefs` : une ligne par voyage (`trip_id` clé primaire, `brief jsonb`, `schema_version int`, `phrase_hash text`, `updated_at`). RLS activée à la création, politiques calquées sur `trips` via `can_read_trip` / `can_edit_trip`. Retour arrière fourni. La phrase elle-même n'y est pas recopiée (elle est déjà sur le voyage).

Cache d'extraction : clé = empreinte SHA-256 de (phrase normalisée, langue de l'interface, version du schéma, version de la consigne, date du jour quand la phrase contient un repère relatif). Table `geo_cache` existante si elle convient, sinon mémoire seule en phase 1 ; pas de nouvelle table sans mesure.

### 3.5 Branchement

`buildTripContext` garde sa signature. Avec `COMPAS_V6_BRIEF=1`, un adaptateur pur `briefToTripContextInput(brief, trip)` produit son entrée ; sans l'interrupteur, rien ne change. Les lecteurs de réglages qui contournent `tripContext.ts` (inventaire T1.2) sont ramenés derrière lui avant la bascule.

## 4. Archétypes et segments

- `engine/archetypes/archetypes.json`, validé par zod au chargement et en test. Chaque barème porte `source` et `date` ; un test échoue sinon. Une règle locale sans source vaut « non évalué », jamais une valeur.
- Les 12 premiers archétypes reproduisent `activityProfile.ts` à l'identique ; la preuve est la suite de tests existante, rejouée avec l'interrupteur allumé.
- Un voyage est une suite de **segments** (archétype, dates, zone). `trip_steps` gagne une colonne `segment smallint null` (migration avec retour arrière). Un voyage sans segment se lit comme un segment unique : aucune reprise de données.

## 5. Invariants

`(voyage, brief, archétype) → { id, ok, gravite: 'bloquant' | 'avertissement' | 'information', cible, reparation | null }`. Un fichier et un test par invariant ; chaque test contient un voyage fautif construit exprès. La note de faisabilité du banc **est** l'exécution de ces mêmes fonctions (une seule définition) : `score-trip.mjs` charge le module TypeScript par `tsx`, il ne le recopie pas.

En phase 0, avant que `engine/checks/` existe, la faisabilité est mesurée par un premier jeu de contrôles vérifiables sur les données d'aujourd'hui (section 6). Ce jeu est versionné (`grille: 'F0'`) ; quand la phase 3 le remplace, la référence est rejouée avec la nouvelle grille sur les mêmes voyages, pour que la comparaison reste juste.

## 6. La mesure (phase 0)

`engine/score/` est pur : il reçoit un **instantané** du voyage (ligne `trips`, étapes, objets, dépenses, documents, événements de préparation) et, quand elle existe, la demande attendue du jeu. Le script `scripts/compas/score-trip.mjs` ne fait que lire la base (ou un fichier d'instantané) et appeler ce module.

| Axe | Calcul | Sans objet |
|---|---|---|
| Justesse | part des critères attendus tenus : pays, distance au lieu ≤ rayon, jours, heures, personnes, enfants, activité, mois | un critère dont l'attendu est `null` ne compte pas ; sans demande attendue, l'axe est « non mesuré » |
| Complétude | part des éléments attendus présents (liste de la spec §5) | les nuits ne comptent pas pour une sortie à la journée |
| Faisabilité | part des invariants tenus (grille F0, puis `engine/checks/`) | un invariant inapplicable ne compte pas |
| Précision | part des valeurs présentes qui viennent d'une donnée réelle et non d'un défaut ou d'un « non évalué » | — |

Règles : chaque axe rend `{ note, tenus, total, details[] }` ; `note = null` quand `total = 0` (jamais 100 par absence de critère) ; une demande dont l'issue attendue est `precision` est notée sur le fait que le Compas a signalé le manque, pas sur un voyage. Aucun modèle n'intervient dans ces quatre notes.

Référence (porte 0) : les notes par famille, rangées dans `docs/compas/v6/reference/`. Règle de non-régression : aucune note ne baisse de plus de 2 points d'une phase à l'autre.

## 7. Le monde en base, planificateur, graphe

Cadrés ici, décidés dans leurs propres ADR (T4.1, T5.1) : la phase 4 ne démarre pas sans D2 et sans mesure de taille ; le planificateur rend trois candidats notés par les invariants ; le graphe de tâches généralise `DEPENDS` / `FOLLOWS` de `dependencies.ts` en gardant ses garanties (ordre stable, empreinte sans coordonnée fine).

## 8. Conséquences et risques

- **Double chemin pendant le chantier.** Coût de maintenance accepté ; borné par la règle de retrait (14 jours allumé sans constat).
- **Dérive du schéma du Brief.** `schema_version` sur chaque ligne ; une lecture d'une version inconnue rend « pas de Brief » et le chemin actuel s'applique.
- **Extraction lente ou muette.** Délai borné (appel « fast ») ; au-delà, les règles seules, annoncées. Le quota IA existant s'applique.
- **Injection par la phrase.** La sortie de l'IA est contrainte par schéma, chaque valeur dite est revérifiée mot pour mot, et aucune valeur extraite n'est un fait : le pire cas est une variable mal comprise, que les règles contredisent pour les nombres et les dates.
- **Référence instable.** La géographie interrogée en direct fait varier les résultats (constat F6) : la référence note l'heure du passage et le taux d'échec externe, et une baisse n'est retenue qu'après rejeu.

## 9. Points ouverts (Tony)

| Id | Question | Effet tant que c'est ouvert |
|---|---|---|
| D1 | L'IA peut-elle extraire le Brief ? | T1.3 codé et testé hors ligne, jamais appelé ; porte 1 non franchissable sur les langues hors français |
| D2, D3 | Stockage et zones du monde | phase 4 à l'arrêt |
| D4 | L'allure réelle règle-t-elle les journées sans demander ? | T1.5 calculé, non branché |
| D5 | Invariant bloquant non réparé : rendre ou refuser | T3.3 codé avec « rendre, défaut dit » par défaut (le comportement le plus proche d'aujourd'hui), réversible par un réglage |

## 10. Relecture

_À remplir par `architect`._
