# Compas v6 — refonte du moteur de préparation

> Spécification d'exécution pour Claude Code. À ranger dans `docs/compas/SPEC-V6-MOTEUR.md`.
> Rédigée le 10 novembre 2026 à partir de la lecture de `main` (commit `571142e`).
> Orchestrateur : session principale **Claude Fable 5.2**. Exécution : sous-agents routés (section 3).
> Budget : 0 €. Aucun changement d'interface dans ce chantier, sauf ce que la section 9 autorise.

---

## 1. But

Aujourd'hui une phrase donne un voyage « prêt » mais souvent mince : lieux justes, contenu des journées pauvre, peu de variables réellement prises en compte.

Cible : **une phrase + ce qu'on sait de la personne = un projet complet, faisable et détaillé, produit sans intervention**, quel que soit le type de projet (footing d'une heure, randonnée, road trip, voyage d'un mois, expédition). Chaque valeur produite est **modifiable** et **dit d'où elle vient**.

« Complet » n'est plus une impression : c'est un score mesuré par le banc (section 5). Aucune phase n'est déclarée finie sans que ce score monte, preuve à l'appui.

---

## 2. Constat de départ (faits lus dans le code)

| # | Fait | Où | Conséquence |
|---|---|---|---|
| F1 | La compréhension de la phrase repose sur des règles écrites à la main, en cinq langues | `engine/intent.ts` (2 595 lignes), `intentEn/Es/De/It.ts`, `intentWords.ts` | Chaque phrase ratée ajoute une règle (C-001 à C-021). Ne converge pas vers « n'importe quelle phrase » |
| F2 | 12 activités, 7 profils de déplacement décrits par trois distances par jour ; le reste est un « séjour sur une base » | `engine/activityProfile.ts` (95 lignes), `COMPAS_ACTIVITIES` | Le moteur ne sait pas ce qu'est une journée de plongée, de ski de randonnée ou de visite |
| F3 | L'itinéraire choisit des lieux à bonne distance ; il n'optimise pas sous contraintes | `engine/itinerary.ts` (1 079 lignes) | Pas d'horaire de journée, pas de variantes, pas d'arbitrage temps / budget / fatigue |
| F4 | La préparation est une seule action de 1 600 lignes dans un fichier de 3 329 | `server/autofillActions.ts`, `compasAutofillAction` | Difficile à tester par morceaux, à reprendre en cours, à étendre |
| F5 | Le recalcul partiel existe, à gros grain : 5 parties (`steps`, `nights`, `transport`, `kit`, `budget`) et une empreinte de 15 réglages | `engine/dependencies.ts` (`ProjectBasis`, `AutofillPart`) | Bonne base, à affiner : c'est le point d'ancrage de la phase 5 |
| F6 | La géographie est en partie interrogée en direct au moment de préparer | `server/placeLookup.ts`, `stagePoiLookup.ts` (Photon 3 req/s pour tout le site, Overpass souvent en erreur 500) | Même phrase, résultat différent selon l'heure (C-017, C-020) |
| F7 | L'allure réelle de la personne existe en base et n'entre pas dans le calcul | `hike_sessions` (distance, durée, dénivelé) | Les journées sont calculées pour un marcheur moyen |
| F8 | Le banc mesure « prête » et « lieu juste » | `scripts/compas/validate-online.mjs`, `phase7/` | La richesse et la faisabilité du plan ne sont pas mesurées |

Ce qui est solide et **doit être gardé** : `engine/tripContext.ts` (lecture unique des réglages), les référentiels `geo_*`, les règles de vie privée du profil voyageur, la mention IA, les barèmes sourcés et datés, la boucle test → constat → correction → rejeu.

---

## 3. Routage des agents

La session principale (**Fable 5.2**) orchestre : elle découpe, rédige les briefs, intègre, relit les preuves, décide des escalades. Elle n'écrit pas elle-même le code de volume.

**Première tâche du chantier (T0.0)** : mettre à jour `CLAUDE.md` §1.9 (l'orchestrateur y est encore « Opus high ») et le trailer de commit du §1.6 pour refléter le modèle réellement utilisé. Les définitions de `.claude/agents/` restent telles quelles.

| Agent | Modèle, effort | Sert à | Dans ce chantier |
|---|---|---|---|
| `scout` | Haiku, bas | Lire, inventorier, compter. Lecture seule | Cartographier les appels, lister les chaînes, extraire des barèmes existants |
| `chore` | Haiku, bas | Édition mécanique entièrement décrite | Renommages, déplacements de fichiers, saisie de lignes d'archétypes déjà rédigées |
| `builder` | Sonnet, moyen | Module au périmètre clair, avec ses tests | Un invariant, un validateur, un calcul pur, un script d'import |
| `engineer` | Sonnet, élevé | Plusieurs modules, données, performance, débogage dur | Découpage de `autofillActions`, graphe de tâches, planificateur |
| `architect` | Opus, élevé | Second regard indépendant, lecture seule | Relecture de chaque ADR, de chaque migration, de chaque fin de phase |
| Orchestrateur | Fable 5.2 | Architecture, schémas, sécurité, migrations, intégration | Schéma du Brief, ontologie, arbitrages, fusion |

Règles de routage :

1. Toujours l'agent le moins coûteux capable de réussir. Deux échecs du même agent sur la même tâche = escalade d'un cran, avec le journal des deux essais dans le brief.
2. Un brief de sous-agent contient : objectif en une phrase, fichiers autorisés, contrat (types, signatures), tests attendus, commande de preuve. Rien d'implicite.
3. Tâches indépendantes = sous-agents en parallèle dans des worktrees. Jamais deux agents sur le même fichier.
4. Un sous-agent ne déclare jamais « fait » : il rend la sortie brute de ses commandes. C'est l'orchestrateur qui constate.
5. `architect` relit avant toute fusion qui touche la base ou l'architecture (règle existante, `CLAUDE.md` §6).

---

## 4. Règles dures du chantier

Les règles de `CLAUDE.md` s'appliquent toutes. S'y ajoutent :

- **R1 — Rien d'inventé.** L'IA comprend la demande et propose des candidats. Elle ne fournit jamais une coordonnée, un prix, une date, un horaire ou une distance. Tout fait affiché vient d'une donnée vérifiable, avec sa source et sa date.
- **R2 — Chaque valeur extraite cite la phrase.** Une variable du Brief tirée de la phrase porte le passage qui la justifie. Sans passage retrouvé mot pour mot dans la phrase, la valeur est rejetée.
- **R3 — Tout est derrière un interrupteur, éteint par défaut** (`COMPAS_V6_BRIEF`, `COMPAS_V6_ARCHETYPES`, `COMPAS_V6_CHECKS`, `COMPAS_V6_PLANNER`, `COMPAS_V6_GRAPH`). L'ancien chemin reste le chemin de production tant que la phase n'a pas passé sa porte.
- **R4 — IA éteinte, le Compas marche encore.** `AI_MODE=off` doit toujours produire un voyage, par les règles actuelles, annoncé comme tel.
- **R5 — Vie privée inchangée.** Rien du profil (nationalité, domicile, allure) n'est envoyé à l'IA ni rangé sur le voyage partagé. Les verrous `traveller_privacy.mjs` et `identity_compliance.mjs` restent verts.
- **R6 — Aucune régression.** Avant chaque fusion : `npx tsc --noEmit -p .`, `npx vitest run src/features/compas`, `next build`, `npm run perf:budget`, et le banc de la section 5 comparé à la référence.
- **R7 — Preuves.** Chaque tâche laisse dans `docs/compas/v6/JOURNAL.md` : commande lancée, sortie brute, commit. Une case de `PLAN-100.md` n'est cochée qu'avec ce renvoi.
- **R8 — Migrations.** Chacune avec son retour arrière dans `supabase/migrations_down/`, RLS dès la création, relecture `architect`, advisors relancés après. Projet `icxyvwzfjbflcbqukpfz` uniquement.

---

## 5. Phase 0 — Mesurer avant de changer

**But : un nombre qui dit si un voyage est bon.** Sans lui, les phases suivantes se font à l'aveugle.

### Livrables

- `docs/compas/v6/ADR-V6-001-architecture.md` : cette architecture, relue par `architect`.
- `docs/compas/v6/demandes-or.json` : **300 demandes** au départ (500 en fin de chantier). Répartition imposée : 12 familles d'activités, 6 durées (1 h, journée, week-end, semaine, 2 semaines, 1 mois), 5 langues, solo / couple / famille avec enfants / groupe, 6 continents, 4 saisons, et 30 demandes volontairement floues ou contradictoires.
- `scripts/compas/score-trip.mjs` : lit un voyage en base et rend quatre notes sur 100.

### La grille de notation

| Axe | Ce qui est mesuré (uniquement par calcul, jamais par impression) |
|---|---|
| **Justesse** | Lieu dans le bon pays et à moins de X km de l'attendu ; durée, groupe, dates, activité conformes à la demande |
| **Complétude** | Part des éléments attendus pour cet archétype qui sont présents : chaque nuit a un hébergement ou un bivouac ; chaque jour a un contenu, une distance, un dénivelé, une heure de départ ; trajet aller et retour ; budget par poste ; sac ; papiers ; météo ; risques |
| **Faisabilité** | Part des invariants de la section 8 respectés |
| **Précision** | Part des valeurs issues d'une donnée réelle (et non d'un défaut ou d'un « non évalué ») |

Une cinquième note, facultative et affichée à part, peut venir d'un modèle relecteur. Elle ne décide jamais d'une porte.

### Tâches

| Id | Tâche | Agent |
|---|---|---|
| T0.0 | Mettre à jour `CLAUDE.md` §1.6 et §1.9 | orchestrateur |
| T0.1 | Inventorier ce que `getCompasData` rend réellement par voyage (champs remplis, vides, « non évalué ») | `scout` |
| T0.2 | Rédiger l'ADR | orchestrateur, relu `architect` |
| T0.3 | Écrire les 300 demandes avec l'attendu de chacune | `builder` (rédaction), orchestrateur (relecture d'un échantillon de 40) |
| T0.4 | `score-trip.mjs` + tests | `builder` |
| T0.5 | Passage de référence sur un aperçu, résultats rangés dans `docs/compas/v6/reference/` | orchestrateur |

### Porte 0

- Les 300 demandes sont jouées sur l'aperçu actuel, les quatre notes sont publiées par famille d'activité.
- Les dix voyages les plus mal notés sont relus à la main et confirment que la note dit vrai.
- **Ces notes deviennent la référence. Toute phase suivante doit les faire monter sans en faire baisser une de plus de 2 points.**

---

## 6. Phase 1 — Le Brief

**But : la phrase ne pilote plus le moteur. Elle produit un objet typé, complet, que le moteur lit.**

### Le contrat

Nouveau module pur `engine/brief/` :

```ts
type Source = 'dit' | 'profil' | 'historique' | 'deduit' | 'defaut';

interface BriefValue<T> {
  value: T | null;
  source: Source;
  confidence: number;      // 0 à 1
  evidence: string | null; // passage exact de la phrase quand source = 'dit'
  locked: boolean;         // vrai dès que la personne l'a modifiée : plus jamais écrasée
}
```

Le Brief regroupe ces valeurs en blocs. Liste minimale (à compléter dans l'ADR, cible 150 à 250 variables) :

| Bloc | Exemples de variables |
|---|---|
| Projet | forme (boucle, traversée, étoile, multi-bases, itinérant, séjour), segments, motif (repos, défi, découverte, fête) |
| Où | destination dite, envies, lieux à éviter, départ, retour ailleurs, rayon accepté |
| Quand | dates, durée, heures dans la journée, souplesse des dates, heure de départ |
| Qui | nombre, âges des enfants, animal, niveau du plus faible, allure, expérience par activité, peur du vide, mal des transports |
| Effort | distance par jour, dénivelé par jour, heures d'effort, jours de repos, rythme |
| Nuits | type par nuit, confort, autonomie, bivouac accepté |
| Repas | autonomie, régime, réchaud, restaurants |
| Transport | moyens acceptés, sans voiture, véhicule possédé, temps de trajet maximal |
| Budget | enveloppe, devise, par personne ou total, priorité (prix, confort, temps) |
| Risque | tolérance, engagement, isolement accepté, couverture réseau exigée |
| Matériel | ce qui est possédé (lu de l'inventaire), poids visé, location acceptée |

### Remplissage, dans cet ordre

1. **Extraction par l'IA en sortie contrainte** (schéma JSON dérivé du zod), toutes langues. Chaque valeur doit porter `evidence` (règle R2). Appel « fast », réponse mise en cache par empreinte de phrase.
2. **Les règles actuelles (`parseIntentRules`) tournent en parallèle.** Accord = confiance haute. Désaccord = la valeur des règles gagne si elle porte sur un nombre ou une date, celle de l'IA sinon ; le désaccord est journalisé.
3. **Profil** (`user_traveller`, `user_orientation`), côté serveur, jamais transmis à l'IA.
4. **Historique** : allure et dénivelé horaire réels tirés de `hike_sessions` (médiane des 10 dernières sorties, plancher 3 sorties), poids du sac tiré de l'inventaire.
5. **Défauts de l'archétype** (phase 2 ; en phase 1, les défauts actuels).

`intent.ts` n'est pas supprimé : il devient le vérificateur et le chemin `AI_MODE=off`. Plus aucune règle n'y est ajoutée pour corriger une phrase ; la correction se fait dans le schéma ou dans la consigne d'extraction, avec un test.

### Tâches

| Id | Tâche | Agent |
|---|---|---|
| T1.1 | Schéma zod du Brief + types + tests de forme | orchestrateur |
| T1.2 | Inventaire de tous les lecteurs de réglages hors `tripContext.ts` | `scout` |
| T1.3 | Extraction IA contrainte + vérification `evidence` + cache | `engine` |
| T1.4 | Fusion règles / IA / profil / historique, pure et testée | `builder` |
| T1.5 | Calcul de l'allure réelle depuis `hike_sessions` (pur + requête) | `builder` |
| T1.6 | Migration `trip_briefs` (une ligne par voyage, `jsonb`, RLS = celle de `trips`, rien du profil dedans) | orchestrateur, relu `architect` |
| T1.7 | `buildTripContext` lit le Brief quand `COMPAS_V6_BRIEF=1` | `engineer` |
| T1.8 | Passage du banc, constats, corrections | orchestrateur + `builder` |

### Porte 1

- Justesse ≥ référence + 10 points sur les demandes hors français, et ≥ référence partout ailleurs.
- 0 valeur `source = 'dit'` sans `evidence` retrouvée dans la phrase (test automatique sur les 300).
- `AI_MODE=off` : notes égales à la référence (aucune régression du chemin sans IA).
- Verrous de vie privée verts ; lecture en base : aucun champ du profil dans `trip_briefs`.

---

## 7. Phase 2 — Archétypes d'activité et segments

**But : le moteur sait ce qu'est chaque type de projet. Ajouter une activité = ajouter une ligne.**

### Données

Fichier versionné `engine/archetypes/archetypes.json` (pas de table au départ : c'est du savoir du moteur, relu en revue de code), validé par zod. Cible : **60 archétypes** en fin de phase, en commençant par les 12 activités actuelles réécrites sans changement de comportement.

Chaque archétype décrit :

- **Progression** : unité (km, D+, milles, longueurs, plongées, visites), valeurs min / cible / max par niveau, modèle de temps.
- **Journée type** : blocs ordonnés (approche, effort, pause, repas, retour), heure de départ selon la saison et la lumière.
- **Nuits** : types possibles, type par défaut.
- **Lieux** : natures de lieux recherchées, infrastructure requise (falaise, rivière navigable, domaine, port, club).
- **Saison** : mois favorables par zone climatique, conditions bloquantes.
- **Matériel** : liens vers les règles de `kitRules.ts`.
- **Risques** : liens vers `danger.ts`.
- **Règles locales** : permis, bivouac, encadrement obligatoire (clé vers une table par pays, vide quand la source manque : « non évalué », jamais inventé).
- **Sources** : d'où vient chaque barème, avec date.

### Segments

Un voyage devient une suite de segments, chacun avec son archétype, ses dates et sa zone (« 2 semaines au Pérou dont 4 jours de trek » = séjour → trek → séjour). `trip_steps` garde sa forme ; un champ `segment` s'y ajoute (migration, retour arrière fourni).

### Tâches

| Id | Tâche | Agent |
|---|---|---|
| T2.1 | Schéma d'archétype + chargeur + tests | orchestrateur |
| T2.2 | Réécrire les 12 activités actuelles en archétypes, comportement identique prouvé par les tests existants | `engineer` |
| T2.3 | Rédiger les 48 archétypes suivants, barèmes sourcés | `builder` par lots de 8, en parallèle ; relecture orchestrateur |
| T2.4 | Découpage en segments (pur) + migration | `engineer`, relu `architect` |
| T2.5 | `itinerary.ts`, `costs.ts`, `kitRules.ts`, `danger.ts` lisent l'archétype | `engineer` |
| T2.6 | Banc, constats, corrections | orchestrateur + `builder` |

### Porte 2

- Tests existants du Compas verts avec `COMPAS_V6_ARCHETYPES=1` (comportement des 12 activités inchangé).
- Complétude ≥ référence + 15 points sur les familles qui tombaient en « séjour sur une base ».
- Les 20 demandes à plusieurs activités du jeu produisent chacune au moins deux segments justes.
- Chaque barème d'archétype porte une source et une date (test).

---

## 8. Phase 3 — Invariants, critique, réparation

**But : rien de faux ou d'incomplet n'est affiché sans être dit. C'est la phase qui retire le plus de « brouillon » pour le moins de risque.**

### Mécanisme

Module pur `engine/checks/` : chaque invariant est une fonction `(voyage, brief, archétype) → { ok, gravité, cible, réparation proposée }`.

- **Bloquant** : le segment fautif est recalculé (trois essais au plus), sinon le voyage est rendu avec le défaut dit en clair.
- **Avertissement** : affiché dans « Vérifications ».
- **Information** : compte seulement dans la note.

### Première liste (60 invariants à la porte, 100 en fin de chantier)

| Famille | Exemples |
|---|---|
| Effort | Aucune journée au-dessus de la capacité du plus faible ; pas plus de N jours durs d'affilée ; jour de repos après X heures cumulées |
| Temps | Arrivée avant la nuit avec marge ; journée entière dans la lumière du jour ; trajet aller compatible avec l'heure de départ ; dernier transport atteignable |
| Nuits | Chaque nuit a un lieu réel ou un bivouac permis ; refuge dans sa période de gardiennage quand elle est connue ; capacité ≥ groupe |
| Eau et vivres | Point d'eau ou ravitaillement dans l'autonomie déclarée |
| Altitude | Paliers de couchage (déjà dans `acclimatisation.ts`) ; col ou sommet dans sa saison |
| Géographie | Chaque point dans la zone demandée ; pas de saut incohérent entre deux jours ; boucle qui revient ; traversée qui a un retour |
| Budget | Somme des postes = total ; total ≤ enveloppe ou écart dit ; chaque montant a une base et une date |
| Groupe | Enfants : distances et durées adaptées à l'âge ; animal accepté sur les nuits et dans les parcs |
| Papiers et santé | Ligne présente pour chaque pays traversé ; jamais muette sur un risque connu |
| Cohérence | Sac conforme à la météo et aux nuits ; moyen de la journée conforme à l'archétype |

### Tâches

| Id | Tâche | Agent |
|---|---|---|
| T3.1 | Contrat d'un invariant, moteur d'exécution, journal | orchestrateur |
| T3.2 | Les 60 invariants, un fichier et un test chacun | `builder` par lots de 6, en parallèle |
| T3.3 | Boucle de réparation par segment | `engineer` |
| T3.4 | Branchement sur le tiroir « Vérifications » existant (données seulement) | `builder` |
| T3.5 | `score-trip.mjs` lit les mêmes invariants (une seule définition) | `builder` |

### Porte 3

- Faisabilité ≥ 90 sur le jeu entier ; 0 invariant bloquant non signalé.
- Chaque invariant a un test qui échoue sur un voyage fautif construit exprès.
- Durée médiane de préparation ≤ référence + 20 %.

---

## 9. Phase 4 — Le monde en base

**But : aucun appel externe pour la géographie pendant une préparation.**

- Import hors ligne en CI depuis les extraits OpenStreetMap (Geofabrik), sans Overpass : itinéraires nommés avec leur tracé, hébergements, eau, gares, sites d'activité. Complète les tables `geo_*` existantes.
- Noms alternatifs GeoNames dans toutes les langues pour `geo_places` (règle « Sicilia », « Tokio », « Грузии » sans table écrite à la main).
- Importance et durée de visite des lieux depuis Wikidata et Wikivoyage, licence respectée et créditée.
- Photon, Nominatim, Geoapify deviennent un dernier recours, compté et journalisé.

**Limite à trancher par Tony avant de lancer (décision D2)** : la base gratuite ne peut pas porter le monde entier. Deux voies : fichiers par cellule géographique dans le stockage, lus à la demande ; ou couverture par zones prioritaires seulement. La phase ne démarre pas sans cette décision et sans une mesure de taille faite par `scout` sur trois pays tests.

| Id | Tâche | Agent |
|---|---|---|
| T4.1 | Mesure de taille sur trois pays, note de décision | `scout` puis orchestrateur |
| T4.2 | Chaîne d'import par extrait, reprise sur erreur, crédits | `engineer` |
| T4.3 | Noms alternatifs + recherche | `builder` |
| T4.4 | Bascule des lectures, externes en dernier recours | `engineer`, relu `architect` |

### Porte 4

- Sur les zones couvertes : 0 appel externe de géographie pendant la préparation (compteur en base).
- Même demande jouée 5 fois à des heures différentes = même voyage.
- Justesse ≥ 95 sur le jeu monde.

---

## 10. Phase 5 — Planificateur et graphe de tâches

**But : le meilleur plan sous contraintes, et un recalcul fin quand une variable change.**

### Planificateur à trois niveaux (`engine/planner/`, pur)

1. **Macro** : zones, nombre de nuits par zone, ordre. Recherche du meilleur compromis entre intérêt des lieux et coût de déplacement, sous les contraintes du Brief.
2. **Méso** : tracé de chaque jour sur le réseau réel, temps calculé avec le dénivelé, l'allure réelle et le poids du sac ; le groupe avance au rythme du plus faible.
3. **Micro** : horaire de la journée (départ, pauses, eau, repas, horaires d'ouverture quand ils sont connus, échappatoires, plan de repli météo).

Le planificateur rend **trois candidats notés** par les invariants et la grille : le retenu, plus deux variantes nommées (« plus tranquille », « moins cher »).

### Graphe de tâches

`compasAutofillAction` est découpé en tâches nommées, chacune avec ses entrées, sa sortie, son empreinte et son cache. `engine/dependencies.ts` passe de 5 parties à ce graphe : modifier une variable du Brief ne relance que les tâches qui en dépendent. L'avancement de chaque tâche alimente l'îlot et la carte (aucun nouveau composant).

| Id | Tâche | Agent |
|---|---|---|
| T5.1 | ADR du planificateur et du graphe | orchestrateur, relu `architect` |
| T5.2 | Cartographie des 1 600 lignes de `compasAutofillAction` en tâches | `scout` puis orchestrateur |
| T5.3 | Découpage sans changement de comportement, tests existants verts | `engineer` |
| T5.4 | Niveaux macro, méso, micro, un module et un jeu de tests chacun | `engineer` (trois worktrees) |
| T5.5 | Candidats, notation, variantes | `engineer` |
| T5.6 | Graphe, empreintes, recalcul fin | `engineer`, relu `architect` |

### Porte 5

- Complétude ≥ 90 et Précision ≥ 80 sur le jeu entier.
- Changer une variable sans effet géographique (budget, régime, confort) : aucun recalcul d'itinéraire, prouvé par le journal des tâches.
- Chaque journée de chaque voyage du jeu a un horaire.
- Préparation médiane ≤ 30 s, 95ᵉ centile ≤ 90 s.

---

## 11. Phase 6 — Bascule

- Interrupteurs allumés un à la fois en production, chacun après un passage complet du banc sur l'aperçu.
- Jeu porté à 500 demandes.
- Retrait du code mort seulement quand un interrupteur est resté allumé 14 jours sans constat ouvert.
- `ETAT.md`, `PLAN-100.md` et `CLAUDE.md` §3 mis à jour.

---

## 12. Ce que ce chantier ne touche pas

- L'écran v5, les tiroirs, la carte : aucun nouveau composant. Seules les données qu'ils affichent s'enrichissent. Rendre chaque variable du Brief modifiable à l'écran est un chantier d'interface séparé, à spécifier après la porte 1.
- Réservations réelles, affiliation, Stripe, Hub, Kit Studio.
- Le fournisseur d'IA (NVIDIA NIM en direct, décision du 7 octobre).

---

## 13. Décisions qui n'appartiennent qu'à Tony

| Id | Question | Bloque |
|---|---|---|
| D1 | Autoriser l'IA à **extraire** le Brief (elle comprend, elle ne fournit aucun fait) : c'est un élargissement de la règle du 14 octobre | Phase 1 |
| D2 | Stockage du monde : fichiers hors base, ou zones prioritaires seulement | Phase 4 |
| D3 | Zones prioritaires pour l'import (proposition : Europe, puis les 30 pays les plus demandés du jeu) | Phase 4 |
| D4 | L'allure réelle tirée des sorties peut-elle régler les journées sans demander ? (elle reste privée et annoncée comme source « historique ») | Phase 1, tâche T1.5 |
| D5 | Quand un invariant bloquant ne se répare pas : rendre le voyage avec le défaut dit, ou refuser de le rendre | Phase 3 |

Sans réponse, l'orchestrateur avance sur tout ce qui ne dépend pas de la décision et le note dans `docs/compas/v6/JOURNAL.md`.

---

## 14. Consigne de lancement (à coller dans Claude Code)

```
Tu es l'orchestrateur du chantier Compas v6 (modèle Fable 5.2).
Lis dans l'ordre : CLAUDE.md, docs/compas/SPEC-V6-MOTEUR.md, docs/compas/ETAT.md,
docs/compas/phase7/CONSTATS.md, puis git log -10.

Crée la branche claude/compas-v6-moteur depuis main et le dossier docs/compas/v6/
avec JOURNAL.md.

Exécute les phases dans l'ordre, en commençant par la phase 0. Pour chaque tâche :
1. choisis l'agent selon la section 3 (le moins coûteux capable de réussir) ;
2. écris-lui un brief complet (objectif, fichiers autorisés, contrat, tests, commande de preuve) ;
3. lance en parallèle tout ce qui est indépendant, dans des worktrees ;
4. lis toi-même la sortie brute des commandes avant d'accepter le travail ;
5. consigne commande, sortie et commit dans JOURNAL.md.

Ne passe à la phase suivante que si la porte de la phase est franchie, chiffres à l'appui.
Une porte manquée = constats, causes, corrections, rejeu. Jamais de contournement du test.

Fais relire par architect chaque ADR, chaque migration et chaque fin de phase.
Respecte les règles R1 à R8 et tout CLAUDE.md. Tout nouveau code est derrière son
interrupteur, éteint par défaut.

Ne t'arrête que pour : une décision D1 à D5, un secret manquant, une suppression de
données irréversible. Dans ces cas, avance sur le reste et dis précisément ce qui attend.
```
