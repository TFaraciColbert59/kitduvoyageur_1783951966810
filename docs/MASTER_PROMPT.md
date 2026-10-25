<USER_REQUEST>
# CHANTIER UNIFICATION LKDV — Prompt d'exécution maître
Version 1.0 · Référence HEAD `f86ff69` (main, 2026-09-06T22:38:24Z)
Dépôt : `TFaraciColbert59/kitduvoyageur_1783951966810`

> Ce fichier est à la fois le plan et le prompt. L'agent qui l'exécute doit le lire
> intégralement avant toute action, puis travailler phase par phase, sous-phase par
> sous-phase, sans jamais sauter un point de contrôle.

---

## 0. MISSION

Unifier le module Voyage (livré C0→C8) et le module Groupes en **un seul système**
cohérent, connecté au reste du site, avec une seule identité visuelle, un seul
modèle de permissions, un seul bus d'événements — tout en corrigeant d'abord les
défauts fonctionnels qui empêchent aujourd'hui une démonstration.

Trois objectifs, dans cet ordre de priorité :

1. **Ça marche.** Un voyage créé produit un itinéraire non vide, une altitude
   cohérente, des poids réels, des compteurs justes.
2. **C'est un seul produit.** Groupes et Voyages ne sont plus deux applications
   qui se ressemblent : ce sont deux facettes du même objet, avec le même design
   system et le même shell.
3. **Tout est branché.** Boutique, carte, lieux, carnets, carbone, copilote,
   alertes, activité, abonnements, clubs consomment le contexte du voyage actif.

**Anti-objectif :** aucune réécriture de ce qui fonctionne. On refactorise par
extraction et adaptation, pas par table rase.

---

## 1. ÉTAT VÉRIFIÉ DU DÉPÔT (ne pas re-supposer)

### 1.1 Faits vérifiés par lecture de l'API GitHub et des fichiers bruts

| Élément | Valeur constatée |
|---|---|
| HEAD `main` | `f86ff69d280b783ac3c8e6116d250367a07781aa` — « merge: release/voyage-v1 -> main (Module Voyage C0-C8) » |
| Message de merge | revendique 572 tests Vitest, 7 tests Playwright E2E, snapshots visuels |
| `src/app/voyages/` | **existe** — `VoyagesClient.tsx` (5 964 o), `actions.ts` (~29 ko), `budget-actions.ts`, `collab-actions.ts` (947 o), `completion-actions.ts`, `document-actions.ts`, `share-actions.ts` (1 255 o), `[slug]/TripDetailClient.tsx` (10 728 o), `[slug]/export/` |
| `src/app/groupes/` | `page.tsx` (8 744 o), `layout.tsx` (824 o), `[groupId]/page.tsx` (9 164 o) |
| Shell Voyages | `AppShell`, `GlassCard`, icônes `lucide-react` |
| Shell Groupes | `Header` + `Footer` + `MobilePageShell` + `CompteBackground` + `CommunityHubNav` + `CommunityLeftSidebar` + `BackgroundVideo`, icônes `AppIcon` / `LkvIcon` |
| Accès data Groupes | `createClient()` **client** (`@/lib/supabase/client`), `useAuth`, `useToast` |
| Accès data Voyages | server actions `'use server'` + Zod (`inviteCollaboratorSchema`, etc.) + `revalidatePath` |
| Table `travel_groups` (champs lus dans l'interface TS) | `id, name, description, destination, theme, visibility, invite_code, max_members, departure_date, return_date, budget_target, group_level, optimization_score` |
| Composants Voyage | `TripHero`, `TripOverviewTab`, `TripItineraryTab`, `TripPlaceholderTab`, `TripBadge`, `TripKitView`, `TripTeamView`, `TripBudgetView`, `TripDocumentsView`, `TripAffiliateSection` |
| Types | `TripFull`, `TripStats`, `TripKitAnalysis` |
| Verts secondaires divergents | `#5C6B5E` (groupes) vs `#5B7F55` (voyages) — encre `#17402C` |
| Modules du site (dossiers `src/app`) | `abonnements, activite, admin, ai-configurator, alertes, … encheres, groupes, voyages, …` (listing partiel, à compléter en P0.1) |

### 1.2 Hypothèses à CONFIRMER en phase 0 (interdiction de coder dessus avant)

- [ ] H1 — La table de membres s'appelle bien `group_members` (et non `travel_group_members`).
- [ ] H2 — `trip_collaborators` existe avec rôles `owner|editor|viewer`.
- [ ] H3 — Le générateur d'itinéraire retourne `[]` hors des 5 routes pilotes.
- [ ] H4 — L'altitude affichée provient d'une constante pays, et les offres
      partenaires d'un mapping pays→destination distinct.
- [ ] H5 — Les items de kit ont un `weight_g` nullable non renseigné pour la
      trousse de secours.
- [ ] H6 — Playwright est installé et les 7 tests E2E annoncés existent réellement.
- [ ] H7 — Les tables `travel_groups` / `group_members` sont lues par d'autres
      modules (`clubs`, `communaute`, `activite`, `encheres`).

### 1.3 Défauts constatés sur captures (à corriger, traçables)

| # | Défaut | Gravité |
|---|---|---|
| D1 | Voyage 28 jours → « Étapes 0 jours · 0 km · +0 m D+ », « Aucune étape définie » après *Générer l'itinéraire*, sans message d'erreur | Bloquant |
| D2 | « Altitude maximale 54 m » (France) alors que les offres affichent Chamonix, Aiguille du Midi, secours en montagne | Bloquant |
| D3 | Trousse de secours 44 pièces à `0 g` | Majeur |
| D4 | Sac vide `0,0 kg` badgé **ULTRALIGHT** (faux positif) | Majeur |
| D5 | Badge « 14 équipements conseillés » vs 4–6 cartes rendues | Majeur |
| D6 | Onglet *Itinéraire* compteur `2` avec itinéraire vide | Majeur |
| D7 | 6/6 recommandations badgées « VITAL POUR LA SÉCURITÉ » | Majeur (conformité + confiance) |
| D8 | Dates 26 → 27 octobre selon l'écran (UTC vs local) | Majeur |
| D9 | Jargon interne exposé : « module C2 », « collaboration C3 », « Chantier 7 · Master Plan » | Majeur |
| D10 | Contrastes gris clair sur verre translucide < 4,5:1 | Majeur (a11y) |
| D11 | Deux thèmes visuels, deux shells, deux librairies d'icônes | Structurel |
| D12 | N+1 sur le comptage des membres de groupes | Perf |

---

## 2. RÈGLES NON NÉGOCIABLES

**R1 — Preuve brute.** Toute affirmation de succès est accompagnée de la sortie
console non reformatée, collée dans le rapport. Un test « qui devrait passer » est
un test échoué.

**R2 — Aucun test affaibli.** Interdiction de modifier, `skip`, `only`, ou
d'assouplir une assertion existante pour faire verdir une suite. Si un test doit
changer, ouvrir une entrée `## Dérogation` dans le rapport avec justification et
diff du test.

**R3 — Push obligatoire.** Fin de chaque sous-phase : `git add -A && git commit`
puis `git push`, puis **vérification distante** par
`git ls-remote --heads origin` et `git rev-parse HEAD` comparés. Un travail non
poussé est un travail inexistant.

**R4 — Arrêt sur outil indisponible.** Si un outil (Playwright, Supabase CLI,
`psql`, MCP) est absent ou en erreur, **arrêter** et le déclarer. Ne jamais
simuler une sortie, ne jamais inventer un SHA, ne jamais estimer un nombre de
tests.

**R5 — Validation à 4 conditions.** Une sous-phase n'est « faite » que si :
(a) tests unitaires verts, (b) `npm run lint` et `npm run build` verts,
(c) preuve E2E ou capture pour tout changement d'UI, (d) commit poussé et
vérifié à distance.

**R6 — Pas d'auto-félicitation.** Le rapport ne contient ni « 100 % validé », ni
« production ready », ni emoji de succès. Il contient des faits et des restes à
faire.

**R7 — Migration de données = irréversible.** Toute migration SQL exige : dump
préalable horodaté, script `down` testé, exécution d'abord sur base de staging,
et une vue de compatibilité tant que les écrans n'ont pas basculé.

**R8 — Une sous-phase = une session.** Pas de cumul. Si le contexte se remplit,
clôturer proprement (commit + push + rapport) avant de continuer.

**R9 — Feature flags.** Tout changement structurel visible passe derrière un flag
(`NEXT_PUBLIC_FF_*`) permettant un retour arrière sans revert Git.

**R10 — Zéro couleur en dur.** Après P2, toute couleur hexadécimale dans du JSX
fait échouer le lint. Pas d'exception.

---

## 3. AGENTS ET SKILLS

### 3.1 Répartition en sous-agents

Chaque sous-agent reçoit un périmètre de fichiers, des outils autorisés, et un
livrable unique. Aucun sous-agent n'a le droit de pousser sur `main`.

| Agent | Périmètre | Outils | Livrable |
|---|---|---|---|
| `agent-audit` | lecture seule totale | shell (lecture), grep, git log | `docs/AUDIT_UNIFICATION.md` |
| `agent-schema` | `supabase/migrations/**`, `docs/DATA_MODEL.md` | psql/supabase CLI sur **staging uniquement** | migrations `up`+`down` + matrice RLS |
| `agent-design` | `src/styles/**`, `src/components/ui/**` | édition, Storybook | tokens + primitives + rapport contraste |
| `agent-refactor` | `src/app/groupes/**`, `src/app/equipages/**`, `src/features/crews/**` | édition, tests | migration écrans client → server |
| `agent-trips` | `src/features/trips/**`, `src/app/voyages/**` | édition, tests | corrections D1–D8 + phases temporelles |
| `agent-glue` | `src/contexts/ActiveTripProvider.tsx`, points d'accroche par module | édition | interconnexions |
| `agent-events` | `src/lib/events/**`, triggers SQL | édition | bus `lkv_events` |
| `agent-test` | `tests/**`, `e2e/**` | Vitest, Playwright | suites + snapshots 390 px / 768 px / 1440 px |
| `agent-a11y` | transverse (lecture + correctifs ciblés) | axe-core, Lighthouse | rapport AA + correctifs |
| `agent-doc` | `docs/**` | édition | rapport de phase, changelog, script démo |

### 3.2 Skills à activer

- **plan-first** : produire le plan de la sous-phase et le faire valider avant
  d'écrire une ligne de code.
- **tdd** : test rouge → code → vert → refactor. Aucun correctif de D1–D8 sans
  test écrit avant.
- **repo-cartography** : cartographier imports et dépendances avant tout
  déplacement de fichier (`rg -l "travel_groups"`, graphe d'imports).
- **sql-migration-safety** : `up`/`down`, transaction, `IF EXISTS`, vue de
  compat, dump préalable.
- **a11y-audit** : axe-core sur chaque écran modifié, contraste calculé, cibles
  tactiles ≥ 44 px, navigation clavier, focus visible.
- **visual-regression** : snapshot avant/après sur 3 breakpoints.
- **evidence-logging** : chaque commande et sa sortie brute horodatées dans le
  rapport.

### 3.3 Protocole de session

```
1. Lire docs/CHANTIER_UNIFICATION_LKDV.md + le dernier rapport de phase
2. git pull --rebase && git status  (doit être clean)
3. Annoncer : phase, sous-phase, fichiers touchés, tests prévus
4. Écrire les tests (rouge) → coder → vert
5. lint + build + E2E si UI
6. commit + push + git ls-remote (preuve)
7. Mettre à jour docs/PROGRESS_UNIFICATION.md
8. Rapport de sortie au format §14
```

---

## 4. CONVENTIONS GLOBALES

**Branches.** `chantier/u{phase}-{slug}` (ex. `chantier/u1-itineraire-fallback`).
Une PR par sous-phase, squash-merge, jamais de commit direct sur `main`.

**Commits.** Conventional Commits + référence de sous-phase :
`fix(trips): fallback itinéraire hors routes pilotes [U1.1]`

**Nommage.** Domaine en anglais dans le code (`crew`, `trip`, `participant`),
interface en français. Un seul terme par concept — le glossaire de §13 est
contraignant.

**Structure cible.**
```
src/features/{trips,crews,places,kit,affiliation,events}/
  components/  hooks/  queries/  schemas/  types/  lib/
src/components/ui/          # primitives partagées uniquement
src/components/shell/       # AppShell unique
src/styles/tokens.css       # source unique des couleurs
```

**Definition of Done (par sous-phase).** Tests écrits avant · suite verte ·
lint + build verts · a11y AA sur écrans touchés · snapshots 3 breakpoints ·
aucun texte de jargon interne · flag posé · commit poussé et vérifié ·
`PROGRESS_UNIFICATION.md` à jour · rapport au format §14.

---

## PHASE 0 — AUDIT ET LIGNE DE BASE
*Agent : `agent-audit` · lecture seule · aucun code produit*

### 0.1 Ligne de base technique
- [ ] `git log --oneline -15 --all`, `git branch -a`, `git ls-remote --heads origin`
- [ ] `npm ci` puis `npm test -- --run` → **nombre exact** de tests, suites,
      échecs, durée (ne pas reprendre le chiffre 572 du message de merge sans
      l'avoir constaté)
- [ ] `npm run lint`, `npm run build`, `npx tsc --noEmit` → sorties brutes
- [ ] `npx playwright test --list` → confirmer ou infirmer H6
- [ ] Versions : Node, npm, Next, React, Supabase JS, Vitest, Playwright

### 0.2 Cartographie du modèle de données
- [ ] Lister **toutes** les tables et colonnes réelles (`information_schema`)
- [ ] Confirmer H1, H2 ; relever les FK, index, contraintes `CHECK`
- [ ] Dumper les policies RLS existantes table par table, produire la matrice
      `table × rôle × {select,insert,update,delete}`
- [ ] Compter les lignes de `travel_groups`, `group_members`, `trips`,
      `trip_collaborators` (volume de migration)

### 0.3 Cartographie des usages croisés (confirme H7)
- [ ] `rg -n "travel_groups|group_members|invite_code|group_level|optimization_score" src/`
- [ ] `rg -n "trip_collaborators|trips\b" src/`
- [ ] Produire la liste **exhaustive** des fichiers impactés par la migration
- [ ] Identifier les URLs publiques susceptibles d'avoir été partagées
      (`/groupes/[groupId]`, invitations `?code=`)

### 0.4 Cartographie UI
- [ ] Inventaire des shells : quels écrans utilisent `AppShell` vs `Header/Footer`
- [ ] Inventaire des icônes : occurrences `lucide-react` vs `AppIcon`/`LkvIcon`
- [ ] Extraction de **toutes** les couleurs hex du JSX (`rg -o "#[0-9a-fA-F]{3,8}" src/ | sort | uniq -c | sort -rn`)
- [ ] Inventaire des modales et des champs de formulaire réimplémentés
- [ ] Liste des occurrences de jargon (`rg -n "Chantier|chantierNumber|\bC[0-8]\b" src/`)

### 0.5 Reproduction des défauts
- [ ] Reproduire D1→D10 en local, une capture + un extrait de code fautif par défaut
- [ ] Pour D1 : localiser la fonction de génération, lire son code, **citer** la
      branche qui retourne `[]`
- [ ] Pour D2 : localiser les deux sources d'altitude et de destination partenaire
- [ ] Pour D8 : localiser le calcul de dates et le mélange UTC/local

### 0.6 Baseline mesurée
- [ ] Lighthouse (perf/a11y/SEO/best-practices) sur `/`, `/voyages`,
      `/voyages/[slug]`, `/groupes` — mobile ET desktop
- [ ] axe-core : nombre de violations par écran, par sévérité
- [ ] Poids JS transféré par route (`next build` analyse)
- [ ] Requêtes Supabase par écran (compteur réseau) — chiffrer le N+1 (D12)

### 0.7 Livrable
- [ ] `docs/AUDIT_UNIFICATION.md` : faits, sorties brutes, H1–H7 tranchées,
      liste de fichiers impactés, baseline chiffrée
- [ ] `docs/PROGRESS_UNIFICATION.md` initialisé (tableau des sous-phases)

**🛑 POINT D'ARRÊT DUR A.** Si `npm test` ne verdit pas sur `main`, ou si le
nombre de tests diffère de ce qu'annonce le message de merge, **arrêter** et
rapporter. Ne rien construire sur une base rouge ou mal décrite.

---

## PHASE 1 — CORRECTIONS FONCTIONNELLES BLOQUANTES (P0)
*Agent : `agent-trips` · skill `tdd` obligatoire*

### 1.1 Fallback du générateur d'itinéraire (D1)

Contrat à trois niveaux, dans cet ordre :

1. **Template** — slug de route pilote reconnu (GR20, Laugavegur, Annapurna,
   Salkantay, Toubkal) → découpage existant conservé tel quel.
2. **Paramétrique** — distance totale et/ou dénivelé saisis → répartition
   déterministe : Naismith (4 km/h + 1 h par 600 m D+), plafond de rythme
   quotidien configurable, un jour de repos tous les 6 jours de marche, arrondi
   au 0,5 km, report du reliquat sur le dernier jour.
3. **Squelette** — aucune donnée → `N` jours vides `Jour 1..N` + bandeau
   explicite : « Aucun tracé de référence pour cette destination. Ajoute tes
   étapes, les distances se calculeront automatiquement. »

Invariant : **jamais** de retour `[]`, **jamais** d'écran vide muet.

- [ ] Tests d'abord :
      `generateItinerary({days:28, slug:null, country:'FR'})` → `length === 28`
      `generateItinerary({days:1})` → `length === 1`
      `generateItinerary({days:400})` → borne respectée, pas de timeout
      distance totale reconstituée = somme des étapes (± 0,5 km)
      déterminisme : deux appels identiques → sorties identiques
      cas dégradés : `days:0`, `days:null`, distance négative, dénivelé nul
- [ ] Implémenter, typer le retour avec un discriminant `source: 'template' | 'computed' | 'skeleton'`
- [ ] Afficher la provenance dans l'UI (« calculé », « d'après le tracé GR20 »)
- [ ] Flag : `NEXT_PUBLIC_FF_ITINERARY_FALLBACK`

### 1.2 Source unique du profil d'altitude (D2)

```ts
// src/features/trips/lib/elevation.ts
export type ElevationProfile = {
  maxM: number;
  minM: number;
  gainM: number;
  source: 'stages' | 'route_template' | 'places' | 'country_fallback';
  confidence: 'high' | 'medium' | 'low';
};
export function getTripElevationProfile(trip: TripFull): ElevationProfile;
```

Priorité : `max(trip_stages.elevation_max)` → template de route → `max(places.elevation)`
→ valeur pays (marquée `low`).

- [ ] Tests : chaque niveau de priorité, cas mixtes, absence totale de données
- [ ] **Un seul consommateur** de cette fonction pour : bandeau contexte,
      règle des 2400 m, filtrage des offres partenaires, alertes sécurité
- [ ] Test d'intégration anti-D2 : un voyage France sans étape de montagne
      **ne doit pas** proposer Aiguille du Midi / secours héliporté
- [ ] Test de la règle d'altitude : `maxM > 2400` déclenche filtre à eau +
      doudoune grand froid + couverture de survie ; `maxM <= 2400` ne les
      déclenche pas
- [ ] Afficher la confiance à l'utilisateur quand `low` (« estimation pays »)

### 1.3 Cohérence des poids et des badges (D3, D4)
- [ ] Renseigner `weight_g` sur tous les items de kit par défaut (source citée
      dans `docs/DATA_KIT_SOURCES.md`)
- [ ] `computeKitWeight()` : distinguer `0` (pesé, vide) de `null` (non renseigné)
- [ ] Badges de charge conditionnés à `totalWeight > 0` ; sinon état
      « poids non renseigné » avec CTA de saisie
- [ ] Tests : sac vide → pas de badge ULTRALIGHT ; item sans poids → sac marqué
      « incomplet » et non « ultraléger » ; agrégation d'un contenant (trousse
      44 pièces) = somme de son contenu

### 1.4 Compteurs dérivés des données rendues (D5, D6)
- [ ] Un seul sélecteur `useTripCounters(trip)` alimente onglets ET badges
- [ ] Interdire tout compteur littéral dans le JSX (règle lint dédiée ou revue)
- [ ] Tests : `counters.itinerary === stages.length`,
      `counters.gear === renderedRecommendations.length`

### 1.5 Hiérarchie des recommandations (D7)
- [ ] Trois niveaux : `safety_critical`, `recommended`, `comfort`
- [ ] Plafond dur : **maximum 2** `safety_critical` par voyage, sélectionnés par
      score de risque (altitude, saison, isolement, autonomie en eau)
- [ ] Justification obligatoire affichée (« > 2400 m en octobre »)
- [ ] Séparer visuellement la recommandation (raison) de l'offre commerciale (achat)
- [ ] Tests : voyage plaine été → 0 `safety_critical` ; haute montagne hiver →
      ≤ 2 ; un item commercial ne peut pas être `safety_critical` sans raison
      technique attachée

### 1.6 Dates et fuseaux (D8)
- [ ] Choix explicite documenté : dates de voyage = **dates civiles** (`date`
      sans fuseau), stockées en `date`, jamais en `timestamptz`
- [ ] Un seul utilitaire `tripDates.ts` (jour N ↔ date, durée, chevauchement)
- [ ] Tests : passage à l'heure d'hiver (26→27 octobre), voyage à cheval sur le
      31 décembre, année bissextile, client en UTC+13 et UTC−10

### 1.7 Sortie de phase
- [ ] `npm test`, `lint`, `build` verts (sorties brutes)
- [ ] Démo enregistrée : voyage France libre 28 jours → itinéraire non vide,
      altitude cohérente, offres cohérentes, poids réels, ≤ 2 badges rouges
- [ ] PR `chantier/u1-*` mergée, push vérifié

**🛑 POINT D'ARRÊT DUR B.** Aucune phase suivante ne démarre si D1 et D2 ne sont
pas corrigés et prouvés. Refactoriser un moteur cassé ne fait que déplacer le bug.

---

## PHASE 2 — DESIGN SYSTEM ET SHELL UNIQUES
*Agent : `agent-design` + `agent-a11y` · flag `NEXT_PUBLIC_FF_UNIFIED_SHELL`*

### 2.1 Tokens — source unique
- [ ] `src/styles/tokens.css` : couleurs (`--lkv-ink: #17402C`, `--lkv-moss`,
      `--lkv-muted`, `--lkv-glass`, `--lkv-glass-border`, états `success/warn/danger/info`),
      rayons (`--r-sm/md/lg/xl` — aligner sur les `18px`/`[18px]` existants),
      ombres, flous, espacements, typographie, z-index, durées d'animation
- [ ] **Trancher `#5C6B5E` vs `#5B7F55`** : une seule valeur, documentée
- [ ] Recalculer `--lkv-muted` pour ≥ 4,5:1 sur `--lkv-glass` (D10) — fournir le
      tableau de ratios calculés
- [ ] Mapper les tokens dans `tailwind.config` (plus de valeurs arbitraires)
- [ ] Mode sombre : décider **maintenant** (supporté ou explicitement hors périmètre)
- [ ] `prefers-reduced-motion` respecté par toutes les animations

### 2.2 Codemod de dé-hardcoding
- [ ] Script de remplacement hex → token, avec rapport des cas ambigus
- [ ] Règle ESLint interdisant `#rrggbb` dans `src/**/*.tsx` (R10)
- [ ] Snapshots visuels avant/après : différence attendue **nulle** hors contrastes corrigés

### 2.3 Primitives partagées (une seule de chaque)
- [ ] `<GlassCard>` (conserver l'API existante, l'étendre)
- [ ] `<Sheet>` — modale desktop / bottom-sheet < 640 px, focus trap, `Esc`,
      `aria-modal`, restitution du focus
- [ ] `<Field>` — label, aide, erreur, `aria-describedby`, état invalide
- [ ] `<Tabs>` — rôles ARIA, navigation flèches, ancrage URL
- [ ] `<StatTile>` — libellé, valeur, unité, tendance, état « non renseigné »
- [ ] `<EmptyState>` — **jamais** de vide muet : titre, explication, action
- [ ] `<Badge>` — variantes alignées sur la hiérarchie §1.5
- [ ] `<Money>`, `<Distance>`, `<Elevation>`, `<Weight>`, `<DateRange>` :
      formatage centralisé (fr-FR, séparateurs, unités)
- [ ] Storybook pour chaque primitive, 3 breakpoints

### 2.4 Icônes
- [ ] `lucide-react` par défaut
- [ ] `LkvIcon` réduit aux pictos réellement propriétaires, inventoriés
- [ ] `AppIcon` : soit alias de compatibilité, soit supprimé — décision tracée
- [ ] Tailles et `stroke-width` normalisés par token

### 2.5 AppShell unique
- [ ] `AppShell` absorbe : `Header`, `Footer`, `MobilePageShell`,
      `CompteBackground`, `BackgroundVideo`, `CommunityHubNav`, `CommunityLeftSidebar`
- [ ] API : `<AppShell variant="app|community|public" sidebar={…} background={…} nav={…}>`
- [ ] Responsive interne (pas deux arbres de composants concurrents)
- [ ] `/groupes` et `/voyages` migrés en premier, puis les autres routes par lots
- [ ] Vérifier : pas de double rendu de `Header`, pas de CLS, `BackgroundVideo`
      désactivée si `prefers-reduced-motion` ou connexion lente

### 2.6 Purge du jargon (D9)
- [ ] Supprimer `TripPlaceholderTab` **et** son concept (`chantierNumber`)
- [ ] Remplacer tout texte « C2 / C3 / Chantier 7 / Master Plan » par du langage
      produit, ou par un `<EmptyState>` honnête
- [ ] Test automatisé : `rg` sur le rendu HTML des routes clés ne doit trouver
      aucun terme de la liste noire (`Chantier`, `C0`…`C8`, `Master Plan`, `MCP`)

### 2.7 Accessibilité de base
- [ ] Cibles tactiles ≥ 44 px vérifiées automatiquement
- [ ] Focus visible sur tous les interactifs
- [ ] Ordre de tabulation logique, skip-link
- [ ] `aria-live` pour les toasts
- [ ] axe-core : 0 violation critique/sérieuse sur les écrans migrés

---

## PHASE 3 — MODÈLE DE DONNÉES : CREWS / TRIPS / PARTICIPANTS
*Agent : `agent-schema` · skill `sql-migration-safety` · R7 s'applique*

### 3.1 Décision d'architecture (à figer avant tout SQL)

Séparer **qui** et **quand** :

- `crews` — identité sociale persistante : `name, slug, description, theme,
  visibility, invite_code, max_members, level, avatar, created_by`
- `trips` — objet daté : `destination, country_codes[], start_date, end_date,
  budget_target, itinerary, crew_id NULLABLE`
- `trip_participants` — qui part sur **ce** voyage (un équipage de 12 → 6 partants)
- `crew_members` — fusion de `group_members` + `trip_collaborators`

Rôles uniques : `owner`, `organizer`, `member`, `guest`.
Une seule fonction d'autorisation : `lkv_can(uid, action, scope_type, scope_id)`
appelée par **toutes** les policies RLS.

- [ ] Rédiger `docs/DATA_MODEL.md` : schéma, matrice de rôles × actions,
      diagramme des relations, règles de cardinalité
- [ ] Faire valider avant écriture du SQL

### 3.2 Migration `up` (squelette à compléter selon les tables réelles de P0.2)

```sql
BEGIN;

CREATE TABLE crews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  slug text UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9-]{3,80}$'),
  description text,
  theme text,
  visibility text NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private','link','public')),
  invite_code text UNIQUE,
  max_members int NOT NULL DEFAULT 12 CHECK (max_members BETWEEN 2 AND 200),
  level int NOT NULL DEFAULT 1,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  legacy_group_id uuid  -- traçabilité de migration
);

CREATE TABLE crew_members (
  crew_id uuid NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner','organizer','member','guest')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','pending','left','removed')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (crew_id, user_id)
);

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS crew_id uuid REFERENCES crews(id) ON DELETE SET NULL;

CREATE TABLE trip_participants (
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner','organizer','member','guest')),
  status text NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('invited','confirmed','declined','removed')),
  PRIMARY KEY (trip_id, user_id)
);

-- 1 groupe -> 1 crew
INSERT INTO crews (name, slug, description, theme, visibility, invite_code,
                   max_members, level, created_by, legacy_group_id)
SELECT g.name, /* slugify */ …, g.description, g.theme, g.visibility,
       g.invite_code, g.max_members, COALESCE(g.group_level,1),
       g.created_by, g.id
FROM travel_groups g;

-- 1 groupe daté ou destiné -> 1 trip rattaché
INSERT INTO trips (name, destination, start_date, end_date, budget_target, crew_id)
SELECT g.name, g.destination, g.departure_date, g.return_date, g.budget_target, c.id
FROM travel_groups g JOIN crews c ON c.legacy_group_id = g.id
WHERE g.destination IS NOT NULL OR g.departure_date IS NOT NULL;

-- Membres + collaborateurs dédupliqués
-- (mapping des anciens rôles : owner->owner, editor->organizer, viewer->guest)

CREATE VIEW travel_groups_legacy AS SELECT … FROM crews …;

COMMIT;
```

- [ ] Écrire le `down` complet et **le tester** (up → down → up)
- [ ] Slugification déterministe avec gestion des collisions
- [ ] Index : `crews(slug)`, `crews(invite_code)`, `crew_members(user_id)`,
      `trips(crew_id)`, `trips(start_date)`, `trip_participants(user_id)`
- [ ] Table de correspondance `legacy_group_id` conservée jusqu'à la fin du chantier

### 3.3 RLS unifiée
- [ ] `lkv_can()` en SQL, testée unitairement (pgTAP ou tests d'intégration)
- [ ] Policies réécrites pour **toutes** les tables du domaine
- [ ] Matrice de preuve : pour chaque table, tenter les 4 opérations en tant que
      owner / organizer / member / guest / non-membre / anonyme → **24+ cas par
      table**, résultat attendu vs obtenu, sortie brute
- [ ] Cas particuliers : voyage sans crew, crew sans voyage, membre `pending`,
      voyage public en lecture anonyme, ex-membre `left`

### 3.4 Exécution contrôlée
- [ ] Dump horodaté de la base (`docs/backups/` hors Git, chemin consigné)
- [ ] Exécution staging, comptages avant/après table par table
- [ ] Vérification d'intégrité : aucun groupe orphelin, aucun membre perdu,
      aucun doublon de rôle, tous les `invite_code` uniques
- [ ] Production : seulement après validation staging documentée

**🛑 POINT D'ARRÊT DUR C.** Pas de migration en production sans (a) dump vérifié,
(b) `down` testé, (c) matrice RLS complète verte, (d) comptages staging concordants.

---

## PHASE 4 — REFONTE DES ÉCRANS ÉQUIPAGE (SERVER-FIRST)
*Agent : `agent-refactor`*

### 4.1 Server components et server actions
- [ ] `/groupes` → `/equipages` : page serveur, données chargées côté serveur,
      client réduit aux interactions
- [ ] Remplacer `createClient()` navigateur par requêtes serveur
- [ ] **Éliminer le N+1** (D12) : une requête agrégée (compte de membres,
      prochain voyage, avancement) au lieu d'un `count` par groupe
- [ ] Toutes les mutations en server actions + Zod, sur le modèle propre de
      `collab-actions.ts` (validation → auth → query → `revalidatePath`)
- [ ] Retours d'erreur normalisés `{ success, error, fieldErrors }`

### 4.2 Invitations — un seul système
- [ ] Fusionner code court et invitation par identifiant en un seul flux :
      lien signé avec expiration + code court optionnel + invitation par email
- [ ] Écran de consentement avant rattachement (plus d'auto-join silencieux par
      `?code=`, qui est un risque de rattachement involontaire)
- [ ] Limitation de débit sur la consommation de code, révocation, rotation
- [ ] Tests : code expiré, code révoqué, équipage plein, utilisateur déjà membre,
      utilisateur non connecté (parcours de retour après login)

### 4.3 Redirections et compatibilité
- [ ] `/groupes` → `/equipages` en 308, `/groupes/[groupId]` → `/equipages/[slug]`
      via la table de correspondance
- [ ] Anciens liens d'invitation toujours fonctionnels
- [ ] Test E2E des redirections

### 4.4 UI équipage
- [ ] Fiche équipage : membres, rôles, voyages passés/à venir, statistiques,
      niveau, activité récente
- [ ] Création de voyage **depuis** l'équipage (pré-remplissage des participants)
- [ ] Création d'équipage **depuis** un voyage solo (« transformer en équipage »)
- [ ] Gestion des rôles avec confirmation pour les actions destructives
- [ ] `<EmptyState>` partout où il n'y a rien

---

## PHASE 5 — LES TROIS PHASES TEMPORELLES DU VOYAGE
*Agent : `agent-trips` · flag `NEXT_PUBLIC_FF_TRIP_PHASES`*

### 5.1 Principe

Remplacer 8 onglets par 3 phases dérivées de `now` vs dates du voyage :

| Phase | Condition | Contenu |
|---|---|---|
| **Préparer** | `now < start_date` | itinéraire, équipement, budget prévisionnel, documents, équipage, checklist J-30/J-7/J-1 |
| **Vivre** | `start_date ≤ now ≤ end_date` | jour en cours, étape du jour, sécurité, saisie de dépense, hors-ligne, contacts d'urgence |
| **Raconter** | `now > end_date` | carnet, budget réel vs prévu, notation des lieux, export, partage public |

- [ ] `getTripPhase(trip, now)` pur et testé (bornes incluses, voyage sans dates,
      voyage d'un jour, voyage passé, voyage lointain)
- [ ] Bascule manuelle possible (consulter « Préparer » pendant le voyage)
- [ ] État persistant de la phase consultée dans l'URL (`?phase=`)

### 5.2 Implémentation
- [ ] Une page, sections réordonnées par phase ; les vues existantes
      (`TripKitView`, `TripBudgetView`, `TripDocumentsView`, `TripTeamView`)
      sont **réutilisées**, pas réécrites
- [ ] Suppression de la barre à 8 onglets et de ses compteurs incohérents
- [ ] Navigation ancrée + sommaire collant sur desktop, accordéon sur mobile
- [ ] Tests E2E : un voyage dans chaque phase affiche la bonne section en premier

### 5.3 Mode « Vivre » (terrain)
- [ ] Vue jour courant : étape, distance restante, D+, météo saisonnière, points d'eau
- [ ] Saisie de dépense en 2 taps
- [ ] Mode hors-ligne (voir §10.4) et affichage lisible en plein soleil
      (contraste renforcé, gros caractères)
- [ ] Contacts d'urgence et informations de secours accessibles hors ligne

---

## PHASE 6 — CONTEXTE DE VOYAGE ACTIF ET INTERCONNEXIONS
*Agent : `agent-glue` · flag `NEXT_PUBLIC_FF_ACTIVE_TRIP`*

### 6.1 Le provider
- [ ] `ActiveTripProvider` : voyage actif persisté en cookie **httpOnly**,
      rehydraté côté serveur, exposé par `getActiveTrip()` (serveur) et
      `useActiveTrip()` (client)
- [ ] Sélecteur d'ateliers dans `AppShell` (changer de voyage actif partout)
- [ ] Invalidation propre à la suppression/fin du voyage
- [ ] Aucune donnée sensible dans le cookie (id + slug uniquement)

### 6.2 Interconnexions, une sous-tâche par module

- [ ] **Boutique / `/materiel`** — filtre et tri sur le déficit d'équipement du
      voyage actif, bandeau « il te manque 3 pièces pour le Toubkal », ajout au
      panier depuis la recommandation, retour au voyage après achat
- [ ] **`/carte-interactive`** — ouverture centrée sur l'itinéraire, lieux du
      voyage épinglés, ajout d'un lieu à une étape depuis la carte
- [ ] **`/lieux`** — spots des étapes en tête de liste ; noter un lieu depuis le
      voyage alimente le scoring bayésien ; **maintenir le floutage éthique des
      coordonnées** pour les sites fragiles, y compris dans les exports
- [ ] **`/carnets`** — sortie naturelle de la phase Raconter, page publique
      indexable, génération assistée depuis les étapes et photos
- [ ] **`/carbone`** — lit les segments de transport du voyage au lieu d'un
      formulaire vierge, restitue l'empreinte dans le bilan de voyage
- [ ] **`/copilote` et `/ai-configurator`** — reçoivent le voyage en contexte
      (destination, dates, altitude, équipement, budget) ; garde-fous : pas de
      conseil médical ou de sécurité en montagne présenté comme certain,
      renvoi vers les sources officielles
- [ ] **`/alertes`** — abonnement automatique aux dates et à la zone du voyage
- [ ] **`/activite` et `/communaute`** — événements du voyage dans le fil,
      respect de la visibilité (privé / lien / public)
- [ ] **`/abonnements`** — limites de plan réelles : nombre de voyages actifs,
      taille d'équipage, exports GPX, documents stockés ; dégradation gracieuse
      à l'expiration (lecture conservée, écriture bloquée)
- [ ] **`/clubs` et `/ambassadeurs`** — voyages officiels rattachés à un crew
- [ ] **`/encheres`** et autres modules listés en P0.1 — décider explicitement
      « connecté » ou « hors périmètre », et le tracer

### 6.3 Recherche et navigation globales
- [ ] Recherche unifiée (voyages, équipages, lieux, produits, carnets) avec
      raccourci clavier
- [ ] Fil d'Ariane cohérent : Équipage → Voyage → Phase → Section
- [ ] Reprise de parcours : « continuer la préparation » sur la page d'accueil

---

## PHASE 7 — BUS D'ÉVÉNEMENTS UNIQUE
*Agent : `agent-events`*

### 7.1 Table et émetteur
```sql
CREATE TABLE lkv_events (
  id bigserial PRIMARY KEY,
  actor_id uuid REFERENCES auth.users(id),
  verb text NOT NULL,                    -- trip.created, stage.added, place.rated…
  object_type text NOT NULL,
  object_id uuid NOT NULL,
  scope_type text,                       -- crew | trip | place | global
  scope_id uuid,
  visibility text NOT NULL DEFAULT 'private',
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
```
- [ ] Émetteur unique `emitEvent()` appelé depuis les server actions (jamais
      depuis le client)
- [ ] Vocabulaire de verbes fermé et documenté
- [ ] Index sur `(scope_type, scope_id, created_at desc)` et `(actor_id, created_at desc)`
- [ ] Idempotence sur les événements dérivés

### 7.2 Consommateurs dérivés
- [ ] Fil d'activité (`/activite`)
- [ ] Notifications (in-app, puis email selon préférences)
- [ ] Scoring bayésien des lieux
- [ ] Niveau et `optimization_score` d'équipage — **définir la formule** et la
      documenter (aujourd'hui opaque)
- [ ] Statistiques admin
- [ ] Objectif : aucun compteur recalculé localement dans un composant

### 7.3 Confidentialité
- [ ] Filtrage de visibilité au niveau RLS, pas dans l'UI
- [ ] Purge et rétention (aligner sur les 13 mois déjà retenus pour l'affiliation)
- [ ] Aucune donnée de document d'identité dans un `payload`

---

## PHASE 8 — FONCTIONS À VALEUR AJOUTÉE
*Agent : `agent-trips` + `agent-test`*

### 8.1 Export / import GPX réel
- [ ] Export GPX 1.1 valide (schéma XSD vérifié) : waypoints, tracés, altitudes
- [ ] Test d'import sur Garmin Connect et Suunto App — **procédure et preuve**
- [ ] Import GPX → création d'étapes (distance et D+ recalculés)
- [ ] Coordonnées des lieux fragiles dégradées à l'export aussi
- [ ] Formats complémentaires : GeoJSON, KML, PDF imprimable

### 8.2 Checklist pré-départ
- [ ] Générée : documents manquants, validité de passeport ≥ 6 mois, règle des
      180 jours (déjà implémentée — la réutiliser), vaccins recommandés, visa,
      assurance, équipement critique manquant
- [ ] Compte à rebours J-30 / J-7 / J-1 avec rappels
- [ ] **Mentions de prudence** : les informations d'entrée sur le territoire et
      de santé sont indicatives, avec lien vers les sources officielles
      (Conseils aux voyageurs, ambassades) et date de dernière mise à jour
- [ ] Tests : passeport expirant pendant le voyage, séjour Schengen > 90 jours,
      multi-pays avec règles différentes

### 8.3 Météo saisonnière (sans API payante)
- [ ] Normales mensuelles par zone (source citée, données statiques versionnées)
- [ ] Affichage par étape et par mois : température min/max, précipitations,
      vent, enneigement si pertinent
- [ ] Alimente les recommandations d'équipement conjointement avec l'altitude
- [ ] **Ne jamais** présenter une normale comme une prévision

### 8.4 Carnet public et SEO
- [ ] Page indexable `/carnets/[slug]` : métadonnées, OpenGraph, JSON-LD
      (`TouristTrip` / `Article`), sitemap dynamique, canonical
- [ ] Consentement explicite avant publication, anonymisation possible des
      participants, retrait à tout moment
- [ ] Le carnet publié alimente le scoring des lieux (via §7)
- [ ] Tests : rendu sans JS, temps de réponse, image de partage

### 8.5 Budget réel vs prévisionnel
- [ ] Écart par catégorie en fin de voyage, coût par jour et par personne
- [ ] Règlements optimaux entre participants (l'algorithme existe — le tester
      sur cas dégradés : 2 personnes, 12 personnes, remboursements partiels,
      devises multiples)
- [ ] Devises : taux figé à la date de la dépense, conversion documentée

### 8.6 Segments réutilisables
- [ ] Bibliothèque de segments (étapes types) réutilisables entre voyages
- [ ] Suggestions de lieux d'après les carnets similaires

---

## PHASE 9 — MONÉTISATION ET CONFORMITÉ
*Agent : `agent-doc` + `agent-trips`*

### 9.1 Ordre de monétisation
- [ ] Boutique en premier (déficit d'équipement), affiliation ensuite
      (hébergement, assurance, eSIM, location)
- [ ] **Aucune commission n'influence l'ordre d'affichage** — le tri est
      technique (pertinence, poids, prix), et c'est testé : un item mieux
      commissionné ne remonte pas
- [ ] Séparation visuelle claire entre conseil et offre commerciale

### 9.2 Conformité
- [ ] Mentions de partenariat visibles avant le clic, `rel="sponsored nofollow"`
- [ ] Conformité influence commerciale (loi du 9 juin 2023) et DGCCRF
- [ ] RGPD : IP hachées (SHA-256), rétention 13 mois, base légale documentée,
      registre de traitement, DPA des partenaires, export et suppression de compte
- [ ] Postbacks HMAC vérifiés, rejets loggés
- [ ] Consentement cookies effectif : aucun tracker avant acceptation
- [ ] Vérifier que les mentions restent visibles sur mobile (elles disparaissent
      souvent en responsive)

### 9.3 Sécurité applicative
- [ ] Documents d'identité : stockage privé, URLs signées à durée courte, jamais
      d'URL publique, chiffrement au repos, journal d'accès
- [ ] Limitation de débit sur invitations, exports, création de voyages
- [ ] Vérification systématique de l'autorisation côté serveur (jamais en UI seule)
- [ ] En-têtes de sécurité, CSP, protection CSRF des server actions
- [ ] `npm audit` et revue des dépendances

---

## PHASE 10 — PERFORMANCE, ACCESSIBILITÉ, HORS-LIGNE, I18N
*Agent : `agent-a11y` + `agent-refactor`*

### 10.1 Performance
- [ ] Budget par route : JS transféré, LCP, INP, CLS — cibles chiffrées vs baseline P0.6
- [ ] Server components par défaut, `'use client'` justifié fichier par fichier
- [ ] Élimination des N+1 restants, pagination et virtualisation des longues listes
- [ ] Images optimisées, `BackgroundVideo` chargée paresseusement ou remplacée
      par une image sur connexion lente

### 10.2 Accessibilité AA complète
- [ ] Tous les écrans : axe-core 0 violation critique/sérieuse
- [ ] Parcours clavier complet sur création de voyage et invitation
- [ ] Test lecteur d'écran sur les 3 parcours principaux
- [ ] Contrastes recalculés et documentés (tableau final)

### 10.3 Responsive
- [ ] 390 px, 768 px, 1440 px sur **tous** les écrans touchés
- [ ] Cibles ≥ 44 px, pas de défilement horizontal, tableaux adaptés en cartes

### 10.4 Hors-ligne
- [ ] Service worker : voyage actif, itinéraire, documents, contacts d'urgence,
      carte des étapes disponibles hors ligne
- [ ] File d'attente de synchronisation des dépenses et notes saisies hors ligne
- [ ] Résolution de conflits documentée (dernier écrivain gagne + journal)
- [ ] Indicateur d'état de synchronisation visible

### 10.5 Internationalisation (préparation)
- [ ] Extraire les chaînes en clés (pas de traduction encore)
- [ ] Formats de dates, nombres, unités (km/mi, m/ft, kg/lb) paramétrables
- [ ] Décision tracée : langues cibles et calendrier

---

## PHASE 11 — TESTS, PREUVES, QUALITÉ
*Agent : `agent-test`*

### 11.1 Tests unitaires
- [ ] Couverture des fonctions critiques : `generateItinerary`,
      `getTripElevationProfile`, `computeKitWeight`, `getTripPhase`,
      `tripDates`, répartition budgétaire, scoring bayésien, `lkv_can`
- [ ] Cas dégradés systématiques : null, zéro, négatif, très grand, unicode,
      fuseaux extrêmes

### 11.2 Tests d'intégration
- [ ] Chaque server action : succès, validation échouée, non authentifié,
      non autorisé, ressource absente, conflit
- [ ] Migration : `up` → `down` → `up` sur base jetable, comptages vérifiés

### 11.3 E2E Playwright
- [ ] Parcours 1 : inscription → création de voyage France 28 jours →
      itinéraire non vide → équipement → budget → export GPX
- [ ] Parcours 2 : création d'équipage → invitation → acceptation → voyage
      partagé → dépense partagée → règlement
- [ ] Parcours 3 : voyage en cours → mode Vivre → saisie hors ligne →
      synchronisation
- [ ] Parcours 4 : fin de voyage → carnet → publication → page publique indexable
- [ ] Parcours 5 : redirections `/groupes` → `/equipages`, anciens liens d'invitation
- [ ] Parcours 6 : altitude basse → aucune offre haute montagne (anti-régression D2)
- [ ] Snapshots visuels 390/768/1440 sur chaque parcours

### 11.4 Preuves de sécurité
- [ ] Matrice RLS complète (§3.3) rejouée en fin de chantier
- [ ] Tentatives d'accès horizontales (voyage d'autrui par id direct)
- [ ] Vérification que les documents ne sont pas accessibles sans signature

### 11.5 CI
- [ ] Portes qualité bloquantes : lint, `tsc`, tests, build, axe-core, budgets perf
- [ ] Exécution E2E sur PR, artefacts de snapshots conservés
- [ ] Interdiction de merge sans PR verte

---

## PHASE 12 — LIVRAISON ET DÉMONSTRATION
*Agent : `agent-doc`*

### 12.1 Documentation
- [ ] `docs/DATA_MODEL.md`, `docs/DESIGN_SYSTEM.md`, `docs/EVENTS.md`,
      `docs/PERMISSIONS.md`, `docs/OFFLINE.md`, `docs/COMPLIANCE.md`
- [ ] `docs/CHANGELOG_UNIFICATION.md` — ce qui change pour l'utilisateur
- [ ] `docs/RUNBOOK.md` — rollback, flags, migration, incident

### 12.2 Nettoyage
- [ ] Suppression des flags stabilisés, du code mort, de `travel_groups_legacy`
      (seulement après vérification qu'aucun code ne la lit)
- [ ] Suppression des composants doublons (anciens shells, anciennes modales)
- [ ] `rg` final sur la liste noire de jargon

### 12.3 Script de démonstration investisseur (7 minutes)
1. Accueil → « continuer la préparation » (contexte actif)
2. Création d'un voyage libre 28 jours → itinéraire non vide, provenance affichée
3. Rattachement à un équipage → invitation → rôles
4. Déficit d'équipement → boutique filtrée → panier
5. Altitude et saison → 2 recommandations critiques justifiées (pas 6)
6. Export GPX → import sur montre
7. Fin de voyage → carnet public indexable → scoring des lieux → boucle SEO

- [ ] Enregistrer la démo, jeu de données de démonstration reproductible
      (`npm run seed:demo`)

### 12.4 Rapport final
- [ ] Format §14, sans auto-validation, avec restes à faire et risques ouverts

---

## 13. GLOSSAIRE CONTRAIGNANT

| Concept | Code | Interface | Interdits |
|---|---|---|---|
| Équipage persistant | `crew` | « équipage » | groupe, group, team, clan |
| Voyage daté | `trip` | « voyage » | trek, aventure, séjour |
| Membre d'équipage | `crew_member` | « membre » | collaborateur |
| Partant d'un voyage | `trip_participant` | « participant » | invité |
| Étape | `stage` | « étape » | jour, segment |
| Lieu | `place` | « lieu » | spot, POI |
| Équipement | `kit_item` | « équipement » | matos, gear |
| Carnet | `journal` | « carnet » | blog, récit |

---

## 14. FORMAT DE RAPPORT DE SORTIE (obligatoire)

```markdown
# Rapport — Phase X.Y — {date ISO} — {branche}

## Périmètre annoncé
## Fichiers modifiés (liste + lignes ±)
## Tests écrits avant le code (liste + fichiers)
## Sorties brutes
### npm test
### npm run lint
### npm run build
### npx playwright test
### git ls-remote --heads origin | grep {branche}
### git rev-parse HEAD
## Preuves visuelles (chemins des captures 390/768/1440)
## Écarts par rapport au plan
## Dérogations R2 (si test modifié : diff + justification)
## Ce qui NE fonctionne pas encore
## Risques ouverts
## Prochaine sous-phase proposée
```

Sont **interdits** dans un rapport : « 100 % », « production ready »,
« tout est validé », un nombre de tests non issu d'une sortie collée, un SHA non
vérifié par `git rev-parse`.

---

## 15. POINTS D'ARRÊT DURS (récapitulatif)

- **A** — `npm test` rouge sur `main`, ou nombre de tests divergent du message de merge → arrêt
- **B** — D1 ou D2 non corrigés et prouvés → aucune phase ≥ 2
- **C** — Migration sans dump, sans `down` testé, sans matrice RLS verte → arrêt
- **D** — Playwright absent alors que le merge revendique 7 E2E → arrêt et déclaration
- **E** — Un outil (Supabase CLI, psql, MCP) indisponible → arrêt, jamais de sortie simulée
- **F** — Perte de données constatée après migration staging → `down` immédiat
- **G** — Régression a11y ou contraste après P2 → correction avant de continuer

---

## 16. ORDRE D'EXÉCUTION ET DÉPENDANCES

```
P0 (audit) ──► P1 (fonctionnel) ──► P2 (design system)
                                      │
                                      ├─► P3 (données) ──► P4 (équipages)
                                      │                       │
                                      └─► P5 (phases) ◄───────┘
                                             │
                                             ▼
                                        P6 (contexte actif)
                                             │
                                             ▼
                                        P7 (événements)
                                             │
                                             ▼
                                   P8 (valeur) ──► P9 (monétisation)
                                             │
                                             ▼
                                   P10 (perf/a11y/offline)
                                             │
                                             ▼
                                   P11 (tests) ──► P12 (livraison)
```

P2 et P3 peuvent avancer en parallèle (agents distincts, périmètres disjoints).
P5 dépend de P2 (primitives) et bénéficie de P3 mais peut démarrer sans.

---

## 17. PREMIÈRE INSTRUCTION À L'AGENT

> Lis ce fichier en entier. N'écris aucun code.
> Exécute uniquement la **phase 0**, sous-phases 0.1 à 0.7.
> Tranche les hypothèses H1 à H7 par des faits.
> Produis `docs/AUDIT_UNIFICATION.md` et `docs/PROGRESS_UNIFICATION.md`.
> Termine par le rapport au format §14 et par une recommandation :
> « prêt pour P1 » ou « point d'arrêt A atteint, voici pourquoi ».
> Si un outil manque, arrête-toi et dis-le. Ne simule rien.

</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-09-07T01:08:45+02:00.
</ADDITIONAL_METADATA>