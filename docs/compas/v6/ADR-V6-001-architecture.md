# ADR-V6-001 — Architecture du moteur de préparation Compas v6

**Date :** 2026-11-10
**Statut :** Accepté sous réserve (seconde relecture `architect`, 10 novembre) ; révision 3, qui traite les six réserves (section 11). Historique : révision 2 — la relecture `architect` du 10 novembre a rendu « à revoir » (17 constats, dont 3 bloquants) ; cette révision les traite un à un (section 10). La migration `trip_briefs` est **reportée** (section 3.5).
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

Un seul lecteur : `engine/v6Flags.ts`, fonction pure `v6Flags(env)` qui rend `{ brief, archetypes, checks, planner, graph }`. Une valeur est allumée seulement si la variable vaut exactement `1`. Dépendances imposées : `archetypes`, `checks` et `graph` exigent `brief` ; `planner` exige `archetypes` et `checks`. Une combinaison incohérente éteint le maillon dépendant (jamais d'erreur à l'exécution). Les variables sont lues côté serveur uniquement (aucun `NEXT_PUBLIC_`).

**Le chemin réellement pris est rangé.** Chaque préparation écrit dans `metadata.compas.autofill.engine` la liste des maillons actifs (`[]` pour l'ancien chemin). Le banc relit cette liste : un passage qui croit mesurer v6 et lit `[]` est rejeté. L'aperçu et la production partagent la même base ; un rafraîchissement partiel sur un voyage préparé par un autre chemin que le chemin courant devient une préparation complète, annoncée. La migration `trip_briefs` est appliquée en production avant tout aperçu dont le code s'en sert.

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

- **R1.** Aucune variable du Brief n'est une coordonnée, un prix constaté, un horaire réel ou une distance mesurée. Le Brief contient des *souhaits* (« 15 km par jour », « 800 € » sont des souhaits de la personne, pas des faits fournis par l'IA) et des *noms* (« Annecy »). Le lieu est retrouvé ensuite par `resolvePlaceByName`, inchangé. Aucun champ `lat` / `lon` dans le schéma (test).
- **R2, en deux contrôles faits par le code.** Pour une valeur `dit` : (a) le passage cité est dans la phrase après normalisation NFKC (chiffres pleine chasse, ligatures), casse, apostrophes, espaces, et fait au moins deux signes (un signe seul se retrouve toujours en japonais ou en chinois) ; (b) **la valeur sort du passage** : un nom y figure tel quel ; un nombre y figure en chiffres ou en lettres (table des cinq langues) ; un choix dans une liste ou un oui/non est une lecture, le passage suffit. « En famille » ne prouve pas « 4 » : la valeur est rejetée.
- **Dates.** L'IA ne fournit jamais une date (`CLAUDE.md` §2). Une date du Brief ne vient que de l'analyseur déterministe (`parseIntentRules`), d'un réglage posé par la personne, ou reste absente. L'extraction peut dire « le week-end prochain » comme passage d'un *moment* (mois, saison, moment de la journée) ; la date se calcule par les règles.
- **Origine du contrôle.** `briefIssues(brief, phrase, 'regles' | 'ia')` : les règles calculent leurs nombres et leurs dates (le passage doit exister, la valeur n'est pas recomptée) ; l'IA subit les deux contrôles.
- **Ordre de priorité à la fusion** : réglage posé par la personne > dit > profil > historique > déduit > défaut.
- **Désaccord règles / IA** sur une valeur dite : la valeur des règles gagne pour un nombre ou une date, celle de l'IA sinon (spec §6) ; accord = confiance 0,95 ; désaccord = confiance 0,6, compté (section 3.6). Risque connu : sur un nom, « l'IA gagne » peut contredire une règle acquise par un constat (C-001 à C-021). Garde-fou : la porte 1 exige une justesse ≥ référence partout, IA allumée, et chaque désaccord sur `ou.destination` est relu au premier passage du banc.

### 3.3 Vie privée (R5) — décision structurante

Un voyage se partage, parfois publiquement. Le profil (`user_traveller`, `user_orientation`), l'historique (`hike_sessions`) et la phrase elle-même sont privés. Donc :

1. **Marque de confidentialité portée par chaque valeur.** `BriefValue.prive` est vrai pour toute valeur de source `profil` ou `historique` **et pour toute valeur qui en est déduite** (devise tirée du pays de résidence, niveau tiré de l'allure, « à l'étranger » tiré du domicile) : une déduction hérite de la source la plus privée de ses entrées. La fusion force `prive` sur tout ce qui vient des surcouches.
2. **Rien de privé n'est rangé.** `briefForStorage` rend « absente » toute valeur privée, verrou ou non, et un contrôle (`isStorable`) précède l'écriture. Tests à l'appui ; la porte 1 le relit en base.
3. **Aucun passage de la phrase n'est rangé.** `evidence` sert au contrôle pendant la préparation, puis est vidé avant écriture : la phrase peut dire des choses intimes (santé, peur, enfants) et `start_say` est déjà effacé du voyage après application (`compasActions.ts:2096-2110`). Aucune empreinte de la phrase n'est rangée non plus.
4. **Lecture réservée à ceux qui peuvent modifier.** `trip_briefs` n'est lisible que par `can_edit_trip` (propriétaire, éditeurs). `can_read_trip` rend vrai pour un voyage public ou non répertorié, y compris pour `anon` : il n'ouvre **pas** le Brief.
5. **La surcouche privée est celle de la personne qui lance la préparation**, lue par sa propre session (RLS), jamais par une clé de service. Le résultat peut donc différer selon qui lance. Ce qui est rangé : l'identifiant du lanceur et un oui/non « profil appliqué », sans aucune valeur. Quand le lanceur change, les tâches qui dépendent du profil sont refaites. **Jamais le profil ni l'historique d'un autre membre sans son accord explicite** : « au rythme du plus faible » (phase 5) attend la décision D6.
6. **Rien de privé dans l'empreinte de recalcul** (elle est rangée sur le voyage, `autofillActions.ts:3033`) : une allure n'a que quelques valeurs possibles, la hacher la révélerait. L'empreinte porte seulement le marqueur du point 5.
7. Rien du profil ni de l'historique n'entre dans la consigne donnée à l'IA : l'extraction ne reçoit que la phrase, la langue et la date du jour.

### 3.4 Les réglages modifiables restent où ils sont

Aucun écran n'écrit le Brief dans ce chantier (spec §12). Les colonnes de `trips` et `metadata.compas.prefs` restent la vérité des réglages que la personne modifie ; le Brief ne les double pas. Conséquences :

- `locked` n'est pas saisi : il est **déduit** au chargement, quand la valeur actuelle d'un réglage diffère de la dernière que le moteur a écrite (même idée que `untouchedSince`, `dependencies.ts:173`). La valeur du réglage entre alors dans le Brief par `lockValue` (source `dit`, verrouillée, publique).
- Poser soi-même une valeur que le moteur proposait depuis le profil en fait un réglage du voyage, donc partagé avec lui : l'écran devra l'annoncer (chantier d'interface, après la porte 1).

### 3.5 Stockage et cache

**Pas de table `trip_briefs` pour l'instant** (décision de la révision 3). Rien ne la lit : aucun écran n'écrit le Brief, les réglages modifiables restent dans `trips` et les préférences (§3.4), et une valeur dite rangée sans son passage ne peut pas être revérifiée à la relance. Le Brief vit donc **en mémoire, le temps d'une préparation**, reconstruit à chaque fois depuis la phrase (tant qu'elle est sur le voyage), les réglages du voyage, le profil du lanceur et les défauts. La règle « une variable que rien ne lit n'entre pas » vaut aussi pour une table. Elle sera créée quand un lecteur existera (écran d'édition du Brief, ou graphe de la phase 5), avec la forme arrêtée par la seconde relecture :

- `trip_id uuid` clé primaire, `references trips on delete cascade` ; `brief jsonb not null` (objet, taille bornée) ; `schema_version int not null` ; `engine jsonb` (tableau) ; `launched_by uuid references auth.users on delete set null` ; `profile_applied boolean not null default false` ; `updated_at` par déclencheur ;
- défense en base : `check (not jsonb_path_exists(brief, '$.*.* ? (@.prive == true || @.evidence != null)'))` ;
- RLS `enable` + `force`, `revoke all` à `anon` (car `can_edit_trip` reste exécutable par `anon`), politiques `to authenticated` : lecture `using (can_edit_trip(trip_id))`, insertion et mise à jour `with check (can_edit_trip(trip_id) and launched_by = auth.uid())`, pas de suppression directe ;
- retour arrière : `drop table`.

`briefForStorage` et `isStorable` existent et sont testés dès maintenant : ce sont eux qui diront ce qui a le droit d'entrer dans cette table, et dans tout ce que les adaptateurs écrivent sur le voyage (§3.6).

Cache d'extraction : en mémoire de l'instance seulement en phase 1 (dit tel quel : sur Vercel il ne vit que le temps de l'instance ; `geo_cache` ne convient pas, sa contrainte `kind` exclut un Brief). Clé = SHA-256 de (phrase normalisée, langue, version du schéma, version de la consigne). La date du jour n'a pas à y entrer : la valeur en cache ne contient jamais de date absolue (section 3.2). Un cache en base ne sera proposé qu'avec une mesure du taux de réutilisation.

### 3.6 Branchement et journal

- `buildTripContext` garde sa signature. Avec `COMPAS_V6_BRIEF=1`, un adaptateur pur `briefToTripContextInput(brief, trip)` produit son entrée (jours, heures, groupe, activité, destination).
- `TripContextInput` ne porte ni effort, ni nuits, ni repas : ces variables passent par un **second adaptateur**, `briefToPreferences(brief)`, vers la forme lue aujourd'hui par `readCompasMeta` et `resolveProjectContext` (`autofillActions.ts:1551-1560`). Les lecteurs qui contournent ces deux entrées (inventaire T1.2) y sont ramenés avant la bascule.
- **Les adaptateurs n'écrivent jamais une valeur privée ou sensible sur le voyage.** `trips` et `metadata.compas.prefs` sont lisibles par `anon` sur un voyage public (`trips_core.sql:406-409`) : toute écriture issue du Brief passe d'abord par `briefForStorage`, et un test le prouvera à l'écriture des adaptateurs (T1.7).
- Désaccords : `ops_preparation_events` n'a que `at` et un `kind` fermé à cinq valeurs. La migration de la phase 1 y ajoute un `kind` « brief_disagreement », compté sans valeur ni identifiant de voyage. Le détail (chemin de la variable, source retenue) va dans le résultat du banc, pas en base.

## 4. Archétypes et segments

- `engine/archetypes/archetypes.json`, validé par zod au chargement et en test. Chaque barème porte `source` et `date` ; un test échoue sinon. Une règle locale sans source vaut « non évalué », jamais une valeur.
- Les 12 premiers archétypes reproduisent `activityProfile.ts` à l'identique ; la preuve est la suite de tests existante, rejouée avec l'interrupteur allumé.
- Un voyage est une suite de **segments** (archétype, dates, zone). `trip_steps` gagne une colonne `segment smallint null` (migration avec retour arrière). Un voyage sans segment se lit comme un segment unique : aucune reprise de données.

## 5. Invariants

`(voyage, brief, archétype) → { id, ok, gravite: 'bloquant' | 'avertissement' | 'information', cible, reparation | null }`. Un fichier et un test par invariant ; chaque test contient un voyage fautif construit exprès. La note de faisabilité du banc **est** l'exécution de ces mêmes fonctions (une seule définition) : `score-trip.mjs` charge le module TypeScript par `tsx`, il ne le recopie pas.

En phase 0, avant que `engine/checks/` existe, la faisabilité est mesurée par un premier jeu de contrôles vérifiables sur les données d'aujourd'hui (section 6). Ce jeu est versionné (`grille: 'F0'`) ; quand la phase 3 le remplace, la référence est rejouée avec la nouvelle grille sur les mêmes voyages, pour que la comparaison reste juste.

## 6. La mesure (phase 0)

`engine/score/` est pur : il reçoit un **instantané** du voyage (ligne `trips`, étapes, objets, dépenses) et, quand elle existe, la demande attendue du jeu. Le script `scripts/compas/score-trip.mjs` ne fait que lire (base ou fichier d'instantané) et appeler ce module, chargé par `tsx`.

| Axe (grille) | Calcul | Hors total |
|---|---|---|
| Justesse (J0) | part des critères attendus tenus : pays, distance au lieu ≤ rayon, jours (avec tolérance quand la phrase ne dit pas un nombre), heures, personnes, activité, mois | un attendu `null` ; les enfants (rangés nulle part aujourd'hui : « non mesurable », dit) |
| Complétude (C0) | part des éléments attendus présents (spec §5) | les nuits d'une sortie à la journée ; la météo et les risques, calculés à la lecture et non rangés (« non mesurables en base », dit) |
| Faisabilité (F0, puis `engine/checks/`) | part des invariants tenus | ce qui est sans objet par structure seulement |
| Précision (P0) | moyenne de quatre familles (étapes, dépenses, réglages, sac), chacune = part de ses valeurs **attendues** qui viennent d'une donnée réelle | les lignes saisies à la main |

Règles contre une note qui monte sans que le voyage s'améliore :

- `note = null` quand rien n'est mesurable (jamais 100 par absence de critère).
- **Une donnée manquante est un échec, pas un « sans objet ».** Un invariant qui ne peut pas tourner faute de coordonnées ou de distance compte comme raté.
- **Une valeur par défaut ne compte pas comme présente.** Une heure de départ identique partout, sans source, ne tient pas le critère.
- **L'inconnu ne vaut pas mesure.** Une distance sans source dite n'est pas réelle.
- **Pas de biais commercial.** Un objet du sac est « réel » s'il vient de l'inventaire de la personne ; un lien vers la boutique ne compte pas.
- **Chaque famille pèse autant** dans la précision, quel que soit son nombre de lignes.
- Une demande dont l'issue attendue est `precision` est notée sur le fait que le Compas a signalé le manque.
- Aucun modèle n'intervient dans ces quatre notes.

**Comparabilité de la référence.** Chaque axe porte sa version de grille (`J0`, `C0`, `F0`, `P0`). Les instantanés JSON du passage de référence sont archivés dans `docs/compas/v6/reference/instantanes/` (sans phrase ni donnée de personne au-delà de ce que le voyage de test contient) : quand une grille change (la faisabilité en phase 3, la complétude quand la météo et les risques seront rangés), la référence est **renotée sur les mêmes instantanés** avec la nouvelle grille. Un invariant qui exige un Brief absent (voyages de référence) est « sans objet » pour ce voyage, et le nombre de tels cas est publié.

**Seuil de non-régression.** La règle des 2 points s'applique au jeu entier. Par famille (20 à 52 demandes, soit 2 à 5 points par demande), une baisse n'est retenue que si elle dépasse 2 points **et** porte sur plus d'une demande, après rejeu des demandes en cause : la géographie interrogée en direct (constat F6) fait bouger une demande d'un passage à l'autre. Le taux d'échec externe du passage est publié avec les notes.

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
| D1 | L'IA peut-elle extraire le Brief ? (elle lit des souhaits et des noms ; jamais une date, jamais un nombre absent de la phrase) | T1.3 codé et testé hors ligne, jamais appelé ; **la porte 1 entière est infranchissable** (son premier critère), donc la phase 2 ne peut pas être déclarée ouverte |
| D2, D3 | Stockage et zones du monde | phase 4 à l'arrêt |
| D4 | L'allure réelle règle-t-elle les journées sans demander ? | T1.5 calculé, non branché |
| D5 | Invariant bloquant non réparé : rendre ou refuser | T3.3 codé avec « rendre, défaut dit » par défaut (le comportement le plus proche d'aujourd'hui), réversible par un réglage |
| D7 (nouvelle) | Les variables sensibles dites dans la phrase (régime, allergies, peur du vide, mal des transports, mobilité réduite — santé ou conviction, RGPD art. 9) peuvent-elles être rangées sur le voyage ? | elles servent à la préparation en cours et ne sont jamais rangées (`SENSITIVE_PATHS`) |
| D6 (nouvelle) | Le profil ou l'historique d'un autre membre du groupe peut-il régler le voyage (« au rythme du plus faible »), et avec quel accord ? | seul le profil de la personne qui lance est lu |

## 10. Relecture `architect` du 10 novembre 2026 — verdict « à revoir », traitement

| # | Constat (gravité) | Traitement dans cette révision |
|---|---|---|
| 1 | Brief lisible sur un voyage public ; phrase gardée par `evidence` (bloquant) | lecture par `can_edit_trip` seulement ; `evidence` vidé avant écriture ; aucune empreinte de phrase (§3.3 points 3 et 4 ; `briefForStorage`, tests) |
| 2 | Une valeur déduite du profil passait le filtre (bloquant) | marque `prive` héritée, filtre sur la marque (§3.3 points 1 et 2 ; tests) |
| 3 | Relance par un collaborateur non couverte (bloquant) | surcouche du lanceur, marqueur sans valeur, D6 ouverte (§3.3 point 5) |
| 4 | Valeur privée dans l'empreinte | exclue (§3.3 point 6) |
| 5 | Verrou sans producteur, deux sources de vérité | `trips` et préférences restent la vérité ; verrou déduit ; `lockValue` (§3.4) |
| 6 | R1/R2 ne tenaient pas pour nombres et dates | contrôle « la valeur sort du passage », dates jamais par l'IA (§3.2 ; `valueInEvidence`, tests) |
| 7 | Trous de la comparaison mot pour mot | NFKC, longueur minimale, nombres en lettres, tests ja (§3.2). Reste ouvert : un même passage peut servir deux variables (voulu : « avec mes 2 enfants » dit le groupe et les enfants) |
| 8 | Cache d'extraction | mémoire seule, sans date dans la valeur (§3.5) |
| 9 | Journal impossible en l'état | nouveau `kind` compté sans valeur, par migration (§3.6) |
| 10 | `checks` sans `brief` ; extinction muette | dépendance ajoutée ; chemin pris rangé et relu par le banc (§2.1) |
| 11 | États incohérents entre chemins | version du moteur rangée, rafraîchissement croisé = préparation complète (§2.1) |
| 12 | Précision gonflable, biais boutique | familles à poids égal, attendus au dénominateur, inventaire seul (§6) |
| 13 | Complétude et faisabilité contournables | défaut non compté, donnée manquante = échec (§6) |
| 14 | Référence non comparable | grille versionnée par axe, instantanés archivés, renotation (§6) |
| 15 | Seuil sous le bruit | seuil sur le jeu entier, règle par famille avec rejeu (§6) |
| 16 | Second adaptateur non nommé | `briefToPreferences` (§3.6) |
| 17 | « L'IA gagne » sur les noms ; portée de D1 | risque écrit avec son garde-fou (§3.2) ; portée de D1 corrigée (§9) |

Le relecteur a aussi relevé que l'empreinte compte 16 réglages (la spec en dit 15) : le chiffre du code est retenu en section 1.

## 11. Seconde relecture `architect` du 10 novembre 2026 — verdict « accepté sous réserve », traitement

Les trois bloquants de la première relecture ont été jugés « levés en partie » ; six réserves vérifiables ont été posées, plus un contournement reproduit par script.

| Réserve | Ce qui était faux | Traitement (code et test) |
|---|---|---|
| R1 | Une date ou un nombre de l'IA étiqueté `deduit`, ou une valeur marquée `locked`, échappait aux deux contrôles | un lecteur de phrase ne peut ni verrouiller ni se donner une autre source que `dit` / `deduit` ; l'IA ne rend aucune date quelle que soit la source, ni aucun nombre « déduit » (`briefIssues`, tests « contournements fermés ») |
| R2 | Un passage restait sur une valeur nulle et `isStorable` l'acceptait | `briefForStorage` vide et `isStorable` exige `evidence = null` partout |
| R3 | L'héritage de confidentialité d'une déduction n'était garanti par aucun code | `derive(valeur, entrées)` : `prive` = OU des entrées ; règle des adaptateurs écrite en §3.6 |
| R4 | `readRealPace(supabase, userId)` acceptait n'importe quel identifiant, alors que la RLS de `hike_sessions` ouvre les sorties d'un carnet public | l'identifiant vient de `auth.getUser()` |
| R5 | « septembre » prouvait 7, « une semaine » prouvait 1, « 2 adultes et 3 enfants » prouvait enfants = 2, la phrase entière servait de passage | mot entier, articles retirés, un seul nombre par passage, passage ≤ 60 signes, nom ≥ 2 signes ; un mois se prouve par son nom |
| R6, point 6 | Régime, allergies, peur du vide, mobilité : données de santé ou de conviction qu'aucun réglage ne range aujourd'hui | jamais rangées (`SENSITIVE_PATHS`), décision D7 ouverte |
| R6, point 7 | Rôle de la table flou, deux producteurs de verrou | pas de table maintenant (§3.5) ; le verrou a un seul producteur, `lockValue`, alimenté par les réglages du voyage |

Limites qui restent, dites : « due to » prouve 2 (mot italien) ; une durée dite en semaines ou en mois (« 2 semaines », « un mois ») n'est pas prouvable par l'IA et vient des règles ; une valeur que la phrase écrit elle-même dans les bornes du schéma passe les deux contrôles (acceptable tant que la phrase vient de la personne, à revoir si une phrase vient un jour d'un tiers) ; `launched_by` et `profile_applied` ne sont pas encore codés (ils le seront avec le branchement, T1.7).
