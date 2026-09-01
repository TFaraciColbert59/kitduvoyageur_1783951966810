# 🚀 MASTER PROMPT ANTIGRAVITY — LKDV — V2
## RECONSTRUCTION CIBLÉE : `/materiel/depart/...` — Cockpit matériel de départ

**Projet :** Le Kit du Voyageur (LKDV)

**Repository :** https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810

**Zone unique de travail autorisée :**
- `http://localhost:4000/materiel/depart/...`
- routes réelles confirmées : `src/app/materiel/depart/page.tsx`, `src/app/materiel/depart/[id]/page.tsx`
- composant orchestrateur réel confirmé : `src/features/materiel/components/depart/DepartCockpit.tsx`

**Environnement cible :** Google Antigravity IDE

**Date de référence :** 31 août 2026 — cette version V2 remplace et corrige la V1 (dont le §1 "comportement confirmé" était partiellement obsolète : le composant carte s'appelle `DepartMap.tsx`, pas `LazyExplorerMap` ; la page ne redirige plus vers `/materiel/depart/none`, elle rend directement le cockpit ; `getMaterielSummary.ts` n'est plus la source utilisée par cette page, c'est `getDepartDetail.ts`).

---

# 0. MISSION ABSOLUE

Tu es l'agent principal chargé de **reconstruire, refondre et fiabiliser exclusivement l'expérience de la page `/materiel/depart/...` de LKDV**.

Tu ne travailles PAS sur toute l'application.

Tu ne dois PAS refondre les pages suivantes sauf nécessité technique directe et documentée :

- `/`
- `/materiel`
- `/materiel/forget`
- `/materiel/kits`
- `/materiel/inventaire`
- `/materiel/alertes`
- `/materiel/dispo`
- `/preparer-randonnee`
- `/mes-aventures`
- exploration globale, autres dashboards, commerce global

Toute modification extérieure à `/materiel/depart/...` doit être strictement nécessaire, minimale, justifiée, réversible et documentée dans le journal de travail (`MISSION_LOG.md`, section dédiée `/materiel/depart`).

**Objectif : transformer ce parcours en cockpit matériel de départ ultra-rapide, premium, tactique, mobile-first, robuste, honnête (données réelles, jamais de décor) et production-ready, sans casser le reste du projet.**

---

# 1. LE DIAGNOSTIC — CE QUI NE VA PAS AUJOURD'HUI (vérifié dans le code, pas supposé)

Avant toute reconstruction visuelle, ces sept défauts de fond doivent être compris et corrigés en priorité :

1. **Il n'existe pas de "départ" réel.** Le cockpit prend le *premier kit actif* et l'appelle départ. Aucune colonne `starts_at` / `trail_id` fiable ne relie un kit à une date et à un tracé réels — d'où des incohérences observées (titre "Trek Jura 2 jours (copie)" affiché avec la carte "Boucle Val de Sambre et Maroilles").
2. **`EXAMPLE_TRAIL` ("Tour du Mont-Blanc", 28,6 km) sert de fallback silencieux** quand aucune route n'est trouvée dans `resolveTrail()` — c'est un faux contenu affiché comme réel.
3. **Distances non formatées** : `distance_km` peut s'afficher avec de multiples décimales brutes au lieu d'un nombre lisible.
4. **`calcBaseWeight` ne respecte pas la distinction porté/consommable/base** : il somme tous les poids sans exclure `isWorn` ni `isConsumable`. Le poids affiché n'est donc pas le "poids au dos" réel.
5. **`readinessPct` est un ratio brut coché/total**, sans pondération des items vitaux : un sac avec la veste cochée mais la tente et la trousse de secours oubliées affiche le même score qu'un sac presque bouclé.
6. **Double appel serveur** : `getDepartDetail()` est actuellement invoqué deux fois dans la page (une fois pour le départ, une fois en entrée de la résolution météo) → requêtes dupliquées à chaque chargement.
7. **Redondance UI** : le compte à rebours, le poids et le statut se répètent à plusieurs endroits de l'écran (header, sidebar, section 1), sans hiérarchie claire de "ce qu'il faut regarder en premier".

Ne corrige aucun de ces points sans le vérifier toi-même dans le code actuel — ce diagnostic date d'une lecture précédente et le code a pu évoluer entre-temps.

---

# 2. RÈGLE ABSOLUE : NE JAMAIS HALLUCINER — NI LE CODE, NI LES SKILLS

Avant toute affirmation sur l'état du repository, avant toute invocation de skill :

1. inspecte le code réel — ne réutilise jamais une description antérieure sans la revérifier ;
2. recherche les noms exacts des fichiers/composants/services ;
3. si un skill/agent nommé dans ce prompt n'existe pas réellement dans Antigravity, sélectionne l'équivalent réel le plus proche et note la substitution ;
4. n'invente jamais une commande, un agent, un champ de données ou un comportement observé ;
5. si tu affirmes qu'un test passe, un lint est vert, ou un build réussit, tu dois avoir réellement exécuté la commande et en montrer la sortie — jamais de simulation.

Le repository `rmyndharis/antigravity-skills` reste le catalogue réel si disponible (voir §5-6 de la V1, inchangés, non reproduits ici pour éviter la duplication — consulte-les si besoin de la procédure d'installation token-efficient).

---

# 3. VISION PRODUIT CIBLE

## 3.1 Le principe fondateur

> **Le cockpit répond à une seule question : « Mon départ est-il prêt, et que dois-je faire maintenant ? »**

Tout ce qui ne répond pas à cette question est relégué, fusionné dans un accordéon, ou supprimé. On passe de « 7 sections à explorer » à **« un écran qui dit où j'en suis + un bouton qui fait avancer »**.

## 3.2 Architecture cible : 3 niveaux au lieu de 8 sections/onglets

```
┌─────────────────────────────────────────────┐
│  NIVEAU 1 — LE STATUT (toujours visible)     │
│  Destination · J-x · Badge statut · CTA      │
├─────────────────────────────────────────────┤
│  NIVEAU 2 — LE BLOCAGE (ce qui empêche       │
│  de partir) : 3 items max, actionnables      │
├─────────────────────────────────────────────┤
│  NIVEAU 3 — LE DÉTAIL (progressif, à la      │
│  demande) : checklist, poids, météo, carte   │
└─────────────────────────────────────────────┘
```

## 3.3 Correspondance ancien → nouveau

| Section actuelle | Devenir |
|---|---|
| 1. Départ & synthèse | **Header permanent** (destination, J-x, statut) — plus une section à part |
| 2. Progression | **Fusionnée dans le header** (barre + %, pas un écran séparé) |
| 3. Alertes | **Cœur du Niveau 2**, renommée « À régler avant le départ », 3 items max, actionnables |
| 4. Checklist | **Écran de travail principal**, ouvert par le CTA |
| 5. Poids | **Une ligne dans le header** + accordéon de détail |
| 6. Consommables | **Fusionnée dans la checklist** comme catégorie auto-calculée cochable |
| 7. Terrain & Météo | **Panneau contextuel** : météo condensée + carte plein écran au tap |
| Sidebar droite (desktop) | **Supprimée** — contenu migré dans le header ou le contexte, jamais dupliqué |
| Vue "complète" | **Mode par défaut** : scroll unique ordonné ; les anciens onglets deviennent des ancres de scroll, pas des écrans isolés |

## 3.4 La donnée manquante fondatrice : le départ réel

Avant toute refonte UI, créer la notion de départ persistante :

```sql
-- Table dédiée (ou extension ciblée de materiel_kits)
departures (
  id, user_id, kit_id → materiel_kits,
  trail_id → hiking_routes,        -- le lien qui manque
  starts_at timestamptz,           -- la date réelle
  ends_at, participants_count,
  status: draft | ready | active | done
)
```

Sans cette table, le compte à rebours, les notifications J-7/J-2/J-1, la météo du bon jour et l'autonomie calculée sur la vraie distance restent du décor, jamais de la donnée réelle. **Cette migration est la décision structurante de tout le projet — elle doit faire l'objet d'un ADR avant implémentation** (voir §8).

---

# 4. CONTENU PRÉCIS DE CHAQUE SECTION CIBLE

### A — Header de statut (remplace sections 1+2+sidebar droite)

Contenu :
- Destination éditable inline (jamais de suffixe "(copie)" affiché — nettoyer le nom à la duplication en amont) + nom du tracé lié en sous-titre
- J-x en langage humain (« demain », « dans 3 jours ») ; le compte à rebours précis à la seconde n'apparaît qu'à J-1
- Badge de statut textuel : `Prêt` / `À finaliser` / `Critique — départ déconseillé` (jamais la couleur seule)
- Une barre de progression alimentée par le score pondéré (voir logique ci-dessous)
- 3 chiffres vitaux en une ligne : poids au dos · articles prêts (x/y) · autonomie (j jours)
- Un CTA contextuel unique, piloté par machine à états : `Compléter mon sac (2 manquants)` → `Vérifier les alertes (1 critique)` → `Tout est prêt ✓ Voir la fiche de départ`

Disparaît du header : météo détaillée, mini-carte, contact ICE (relégués au contexte), grade lettré (remplacé par des mots).

Logique de statut (fonction pure, testable) :
```text
Critique si : ≥1 item vital manquant (tente, eau, trousse, couches pluie/froid selon météo)
Warning  si : checklist < 100% OU alerte météo active OU poids > seuil profil utilisateur
Prêt     si : tout coché + vitaux présents + météo compatible + contact ICE renseigné
```

### B — « À régler avant le départ » (ex-Alertes, rang 2)

- Maximum 3 cartes, triées par criticité, chacune actionnable en un tap :
  - « Pluie jeudi (55%) » → `[Ajouter la veste au sac ✓]` (coche/ajoute l'item directement)
  - « 2 vitaux manquants » → `[Voir les 2 items]` (scroll direct vers eux dans la checklist, surlignés)
  - « Eau : prévoir 3 L, sources peu fréquentes » → `[Marquer comme prévu]`
- Si plus de 3 problèmes → « +2 autres » en accordéon
- Si zéro problème → **la section disparaît entièrement** (pas de "aucune alerte" décoratif)
- Dismiss persistant avec horodatage
- Alerte critique non résolue à J-1 → notification push (table `push_subscriptions` existante à réutiliser)

### C — Checklist (écran de travail, absorbe les Consommables)

- Vue par défaut = « Ce qui reste » : items non cochés dépliés, catégories complètes repliées et estompées
- Chaque item : nom, poids, case tactile ≥44px, badge `Vital` si applicable, photo miniature si disponible (champs déjà présents dans `DepartDetail`)
- Catégorie « Vivres & eau » générée automatiquement depuis le moteur de consommables existant (eau, repas, gaz) → devient des items cochables, plus une simple estimation informative
- Résumé sticky en haut : « 4/6 · encore 2 : tente, trousse »
- Check optimiste conservé (`useOptimistic` déjà en place) + haptique légère mobile si disponible + toast uniquement en cas d'erreur réseau, avec retry

### D — Poids (accordéon)

- Une ligne dans le header : « 4,3 kg au dos (+1,1 kg eau/nourriture) »
- Accordéon détaillé avec le calcul corrigé : poids de base (exclut porté + consommables), poids porté sur soi, consommables, total porté réel
- Un seul insight automatique au lieu d'un tableau : « Votre tente représente 42% du poids de base » ou « 2 doublons détectés »
- Jamais de recommandation boutique bloquante ; lien discret « Alléger ce poste » vers l'inventaire existant (alternatives déjà possédées d'abord, boutique ensuite)

### E — Terrain & Météo (panneau contextuel)

- Météo condensée aux seuls jours du départ (pas 5 jours génériques) : « Jeu 23°/14° · 55% pluie · Ven 20° » ; détail heure par heure en accordéon
- Carte unique dans toute l'expérience : vignette statique dans le flux → tap = carte plein écran interactive (réutiliser `DepartMap.tsx`, déjà bien construit — gestes tactiles, couches topo/OSM/satellite)
- Bouton « Préparer hors-ligne » : télécharge tracé GPX + tuiles du secteur + checklist, état explicite « ✓ Disponible hors-ligne · 12 Mo »
- Équipe & sécurité : participants + contact ICE avec bouton Appeler (existant, à conserver) + « Partager ma fiche de départ » (lien lecture seule)

### F — Fiche de départ (nouvelle, l'aboutissement)

Quand tout est prêt, le CTA ouvre une fiche compacte, exportable et consultable hors-ligne : destination, dates, tracé, météo du jour, liste vitaux ✓, poids, ICE, consommables. Boutons : Imprimer, Partager, Mode hors-ligne. Bascule le statut `draft → ready → active → done`.

---

# 5. LIENS ET INTERACTIONS ENTRE SECTIONS

```text
Météo pluie (E) ──déclenche──→ Alerte (B) ──action──→ Item ajouté/coché (C)
Distance tracé (E) ──calcule──→ Consommables (C) : eau/repas selon km, jours, participants
Checklist vitaux (C) ──alimente──→ Statut global (A) ──conditionne──→ CTA (A)
Participants (E) ──multiplie──→ Consommables (C)
Poids (D) ──seuil dépassé──→ Alerte (B) « sac trop lourd pour votre profil »
Date départ (A) ──ordonnance──→ Notifications J-7 (vitaux), J-2 (météo), J-1 (ICE + hors-ligne)
Tout prêt (A) ──débloque──→ Fiche de départ (F) + bascule statut → "ready"
```

**Principe non négociable** : aucune donnée n'est saisie deux fois, aucune section ne répète une information affichée ailleurs, et toute information affichée porte une action associée — sinon elle ne s'affiche pas.

---

# 6. CONTRAINTES PRIORITAIRES (en cas de conflit, respecter cet ordre)

1. sécurité et confidentialité (RLS, `user_id`, pas d'exposition d'ID arbitraire)
2. intégrité et véracité des données (zéro faux contenu, zéro donnée devinée présentée comme réelle)
3. absence de régression fonctionnelle
4. bon fonctionnement du cockpit de départ
5. performance et sensation d'instantanéité
6. responsive et compatibilité iPhone
7. accessibilité
8. architecture maintenable
9. esthétique Liquid Glass
10. effets visuels

Aucun effet de verre, animation ou graphique ne justifie une régression de performance, d'accessibilité, de stabilité ou de véracité des données.

---

# 7. RÈGLES TECHNIQUES TRANSVERSALES (héritées de la V1, à respecter intégralement)

- **Safe areas** : `env(safe-area-inset-*)` appliqué une seule fois par conteneur fixe (déjà centralisé dans `src/app/materiel/layout.tsx` — ne pas dupliquer dans les composants enfants).
- **Motion** : transitions rapides et utiles uniquement ; `@media (prefers-reduced-motion: reduce)` respecté côté CSS **et** côté `framer-motion` via `useReducedMotion()` sur toutes les transitions du cockpit (`DepartCockpit.tsx` ne le fait pas aujourd'hui — à corriger).
- **Mode Ultra-Save** : à brancher réellement sur ce cockpit (batterie faible, `prefers-reduced-motion`, mode économie d'énergie) — `backdrop-filter: none; box-shadow: none; animation: none; transition: none;` sans perte de fonctionnalité.
- **TypeScript strict** : pas de `any`, pas de cast massif, types partagés pour toute donnée utilisée dans plusieurs composants.
- **État** : ne pas dupliquer côté client une valeur déjà calculée côté serveur (`readinessPct`, statut). Le client affiche, il ne recalcule pas.
- **Icônes** : `aria-label` obligatoire sur toute action icon-only ; jamais d'information critique portée uniquement par une icône ou une couleur.
- **Logging** : jamais de tokens, secrets, clés Supabase, ou données excessives dans les logs de cette page.
- **Git & vérification** : après chaque lot, `git diff`, puis `npm run lint`, `npm test`, `npx tsc --noEmit`, `npm run build` — adapter aux scripts réels du projet. Ne jamais prétendre qu'une commande a été exécutée si elle ne l'a pas été.
- **Protocole anti-bug** : reproduire → identifier la couche → cause racine → corriger → écrire un test → relancer → vérifier les effets de bord. Interdit : timeout arbitraire, `catch` qui avale l'erreur, suppression de test, désactivation d'une sécurité, code temporaire non signalé.

---

# 8. ADR OBLIGATOIRE AVANT LA PHASE 0

Créer un ADR (`docs/obsidian/13 — 📋 DÉCISIONS/ADR/ADR-XXX-departures-entity.md`) sur la décision structurante du §3.4 (table `departures` vs extension de `materiel_kits`), avant toute migration. Format standard :

```md
# ADR-XXX — Titre
## Contexte
## Problème
## Options
## Décision
## Conséquences
## Migration
## Rollback
```

---

# 9. WORKFLOW OBLIGATOIRE — PHASES ET GATES

Tu dois travailler en gates. Ne saute aucune gate. Chaque phase se termine par **STOP + validation utilisateur** avant la suivante.

## PHASE 0 — Fondations données (bloquant, avant toute UI)

| # | Tâche | Dépendances | Priorité |
|---|---|---|---|
| 0.1 | Migration : table `departures` (ou colonnes `starts_at`/`trail_id`/`ends_at`/`status` sur `materiel_kits`) | ADR §8 | P0 |
| 0.2 | RLS sur tables trail + conversion vues `SECURITY DEFINER` → `SECURITY INVOKER` | — | P0 |
| 0.3 | Corriger `calcBaseWeight` : exclure porté (`isWorn`) + consommables ; tests unitaires étendus | — | P0 |
| 0.4 | Supprimer `EXAMPLE_TRAIL` et le fallback trompeur ; état vide honnête à la place | 0.1 | P0 |
| 0.5 | Éliminer le double appel `getDepartDetail()` ; fetch serveur agrégé unique | — | P0 |
| 0.6 | Score de statut pondéré (vitaux > météo > poids > %), fonction pure testée | 0.1, 0.3 | P0 |

Résultat attendu : données réelles, poids juste, statut qui signifie quelque chose. Aucun changement visuel encore. **STOP + validation.**

## PHASE 1 — Header de statut

| # | Tâche | Dépendances | Priorité |
|---|---|---|---|
| 1.1 | Header sticky : destination, J-x humain, badge textuel, barre, 3 métriques | 0.1, 0.6 | P0 |
| 1.2 | CTA contextuel unique, machine à états | 0.6 | P0 |
| 1.3 | Édition inline destination + date | 0.1 | P1 |
| 1.4 | Formatage distances, nettoyage des noms dupliqués | — | P1 |
| 1.5 | Suppression sidebar droite (migration du contenu utile) | 1.1 | P0 |

**STOP + validation.**

## PHASE 2 — « À régler avant le départ »

| # | Tâche | Dépendances | Priorité |
|---|---|---|---|
| 2.1 | Refonte : max 3 cartes actionnables, boutons « Corriger » fonctionnels | 0.6 | P0 |
| 2.2 | Persistance des dismiss + horodatage | — | P1 |
| 2.3 | Disparition de la section quand vide | 2.1 | P0 |
| 2.4 | Ancrage alerte → item checklist (scroll + surlignage) | Phase 3 partiellement parallélisable | P1 |

**STOP + validation.**

## PHASE 3 — Checklist de travail (absorbe Consommables)

| # | Tâche | Dépendances | Priorité |
|---|---|---|---|
| 3.1 | Vue « reste à faire », catégories complètes repliées, résumé sticky | — | P0 |
| 3.2 | Consommables convertis en items cochables auto-générés | 0.1 | P0 |
| 3.3 | Badges Vital, photos, haptique, retry offline des toggles | — | P1 |
| 3.4 | Suppression de l'onglet Consommables séparé | 3.2 | P0 |

**STOP + validation.**

## PHASE 4 — Poids corrigé + Terrain/Météo contextuel

| # | Tâche | Dépendances | Priorité |
|---|---|---|---|
| 4.1 | Accordéon poids : base/porté/consommables, 1 insight auto, lien « alléger » | 0.3 | P1 |
| 4.2 | Météo condensée aux jours du départ + accordéon 24h | 0.1 | P0 |
| 4.3 | Carte unique : vignette statique → plein écran (`DepartMap` réutilisé) | — | P0 |
| 4.4 | « Préparer hors-ligne » (GPX + tuiles + checklist) + état explicite | — | P1 |
| 4.5 | Partage fiche ICE en lecture seule | — | P2 |

**STOP + validation.**

## PHASE 5 — Fiche de départ + notifications

| # | Tâche | Dépendances | Priorité |
|---|---|---|---|
| 5.1 | Fiche de départ compacte, impression + partage + hors-ligne | Phases 1–4 | P1 |
| 5.2 | Notifications J-7/J-2/J-1 + rupture météo | 0.1, 4.2 | P1 |
| 5.3 | Bascule statut draft→ready→active→done ; suggestion « recréer ce trek » | 5.1 | P2 |

**STOP + validation.**

## PHASE 6 — Durcissement

| # | Tâche | Dépendances | Priorité |
|---|---|---|---|
| 6.1 | États loading/empty/error/offline/stale sur chaque bloc ; `error.tsx` dédié à la route | Toutes | P0 |
| 6.2 | Matrice responsive 320→1440px, Dynamic Island, safe areas, texte agrandi | Toutes | P0 |
| 6.3 | Tests E2E parcours complet + sécurité (ID d'un autre utilisateur, XSS noms d'items) | Toutes | P0 |
| 6.4 | Audit perf : LCP < 2,5s, requêtes uniques, blur limité, Ultra-Save branché | Toutes | P1 |
| 6.5 | Accessibilité : clavier, lecteur d'écran, `aria-live` sur statut, contrastes ≥12px | Toutes | P1 |

**STOP final.**

---

# 10. DÉFINITION DU DONE

La page `/materiel/depart/...` est DONE uniquement lorsque :

```text
ADR validé (entité departures)
+ Phase 0 (données réelles) validée
+ SPEC de chaque phase validée avant build
+ reconstruction réalisée par phases, chaque STOP respecté
+ fonctionnalités existantes conservées ou migrées proprement
+ zéro faux contenu affiché comme réel (EXAMPLE_TRAIL supprimé)
+ poids et readiness calculés selon la logique corrigée
+ mobile validé, iPhone validé, carte tactile validée
+ états loading/empty/error/offline/stale couverts
+ sécurité revue (RLS, isolation user_id, XSS)
+ performance revue (fetch unique, Ultra-Save actif)
+ accessibilité revue (aria-live, reduced-motion réel, contrastes)
+ tests verts, lint vert, typecheck vert, build vert
+ MISSION_LOG.md mis à jour à chaque phase
+ aucun effet de bord critique identifié
= DONE
```

---

# 11. INTERDICTIONS FINALES

Tu ne dois pas :

- refaire toute l'application, ni refondre `/materiel` en entier ;
- créer une nouvelle architecture globale sans nécessité ;
- remplacer Supabase ou Next.js sans raison documentée ;
- inventer des données, un skill, un agent, ou un comportement de code non vérifié ;
- supprimer des composants existants sans audit préalable ;
- afficher un tracé, une date ou un poids fictif comme s'il était réel ;
- dupliquer une même information affichée ailleurs à l'écran ;
- multiplier les dépendances ou les bibliothèques d'icônes ;
- charger toute la carte ou toute la boutique d'un coup ;
- exposer des données inutiles au client ;
- casser le tactile mobile ;
- faire des animations décoratives lourdes ou ignorer `prefers-reduced-motion` ;
- cacher une erreur ou un état de chargement.

---

# 12. OBJECTIF VISUEL ET PRODUIT FINAL

La page doit donner la sensation :

> **« Je regarde mon départ, je sais immédiatement s'il est prêt, ce qui manque, combien il pèse, et je peux agir sans réfléchir — et tout ce que je vois est vrai. »**

Le résultat doit être premium, clair, compact, tactile, rapide, honnête, robuste, mobile-first, compatible iPhone, sans surcharge visuelle et sans redondance d'information.

Le Liquid Glass est un langage visuel, pas l'objectif. L'objectif est la **qualité opérationnelle et la véracité du cockpit matériel de départ**.

---

# 13. FORMAT DE RÉPONSE APRÈS CHAQUE PHASE

### 1. Ce qui a été inspecté
### 2. Ce qui a été décidé
### 3. Ce qui a été modifié
### 4. Les validations effectuées (commandes réellement exécutées, avec sortie)
### 5. Les risques / points d'attention
### 6. Le point où l'agent s'arrête

---

# 14. DÉMARRAGE IMMÉDIAT

Commence maintenant uniquement par :

```text
DISCOVERY (re-vérification du diagnostic §1) → ADR (§8) → SPEC PHASE 0 → STOP
```

Ne touche à aucune UI avant validation de l'ADR et de la spec Phase 0.

---

# FIN — INSTRUCTION À L'AGENT

**Travaille exclusivement sur `/materiel/depart/...`.**

**Vérifie l'existant toi-même, ne suppose rien. Comprends le diagnostic. Pose l'ADR. Spécifie chaque phase. Arrête-toi à chaque gate. Attends validation. Puis construis.**
