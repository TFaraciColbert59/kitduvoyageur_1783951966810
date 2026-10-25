# H.0 — CARTOGRAPHIE COMPLÈTE DES 102 ROUTES

**Date** : 09/09/2026 · **Branche** : `chantier/z-materiel-hub` (Z2 non encore mergé) · **Méthode** : inventaire `src/app/**/page.tsx` + greps d'entrants (qui lie chaque route) + lecture des headers. Zéro modification de code.

**Chiffres clés** : 102 routes · 1,39 Mo de code page · 42 liens morts ou quasi-mortels détectés · 3 hubs concurrents déjà écrits.

---

## 1. LES TROIS HUBS CONCURRENTS — LA DÉCOUVERTE MAJEURE

Le hub que le chantier H prévoit de construire **existe déjà trois fois**, et personne ne l'a fusionné :

| Hub | Route | Taille | État |
|---|---|---|---|
| **Hub terrain « Base Camp / Action Mode »** | `/terrain` → `features/hub/` | 46 ko (HubShell, HubTopBar, BaseCampView, ActionModeView, widgets SOS/hydratation/eau, PrepScoreGauge, SmartPromptsList, store zustand 6,8 ko avec GPS + batterie + ultra-save) | **Orphelin** : une seule page l'utilise, aucun lien n'y mène |
| **Hub voyage (chantier Y)** | `/voyages/[slug]` | 10 sections + 12 widgets + registres | Actif, canonique, testé |
| **Cockpit rando GPS** | `/randonnee-active` → `features/hiking/HikingCockpitPage` | + `/naviguer` (mode GPS/SOS, 200 lignes, SOS maison en dur #DC2626) + `/boussole` (caméra AR, boussole iOS) | Actifs, tous hors périmètre design |

**Décision D1** : le hub du chantier H **absorbe** `/terrain` (features/hub devient la base du HubShell H — BaseCampView ≈ vue possession, ActionModeView ≈ mode live déjà pensé §10.5). Le store `useHubStore` (batterie, GPS, ultra-save) est un **actif** : il préfigure ce que le mode live du hub doit faire. Ne pas reconstruire, migrer.

**Décision D2** : `/naviguer`, `/randonnee-active`, `/boussole` = **mode live GPS** unifié. Trois entrées pour la même chose. `/randonnee-active` (HikingCockpitPage, le plus complet) devient l'unique destination ; `/naviguer` et `/boussole` redirigent, leurs capacités uniques (SOS, boussole AR) migrent comme widgets du cockpit. Les violations design de `/naviguer` (#DC2626, #0d1a12, emojis 🆘, styles inline) disparaissent avec.

---

## 2. LE TRIANGLE DE PRÉPARATION — QUATRIÈME CONCURRENCE

| Route | Taille | Rôle | Entrants |
|---|---|---|---|
| `/materiel/preparation` | wrapper → PreparationCockpit (117 ko feature) | Simulateur/audit sac | BottomTabBar |
| `/preparation` (racine) | 1,8 ko | **Deuxième** centre de préparation trek | BottomTabBar (matchPaths !) |
| `/materiel/depart/[id]` | DepartCockpit 28,7 ko + DepartEquipmentHub 49,7 ko | Check-in/out terrain | — |
| `/preparer-randonnee` | 496 o | Redirect propre → /materiel/depart | ExplorerClient, TrailDetailPanel |

**Décision D3** : `/preparation` racine **n'a pas de raison d'exister** en parallèle de `/materiel/preparation`. Z1 a tranché les responsabilités (Hub = aventure, Prep = simulateur, Depart = check-in). `/preparation` → redirect 307 vers `/hub/preparation` en H5. Le matchPaths de BottomTabBar est déjà compatible.

---

## 3. LES RESSORTISSES DU FUTUR HUB (inventaire par nature)

### Nature possession — l'équipement (8 routes)
| Route | Taille | Devenir |
|---|---|---|
| `/materiel` (DepartCockpit) | 51 lignes, composant 28,7 ko | **Remplacée** : redirect → `/hub` |
| `/materiel/inventaire` | — | section hub `inventaire` |
| `/materiel/kits` | KitsCockpit | section hub `kit` (fusion avec section gear voyage ? → D5) |
| `/materiel/preparation` | simulateur | section hub `preparation` |
| `/materiel/depart/[id]` | check-in/out | section hub `depart` |
| `/materiel/disponibilite` | — | section hub `disponibilite` |
| `/materiel/alertes` | — | section hub `alertes` |
| `/materiel/forget` | — | section hub (ou fusion alertes → D4) |
| `/alertes` (racine) | 32,9 ko | **Doublon probable de /materiel/alertes** → audit Z2, fusion en une seule section `alertes` du hub |

### Nature sortie — le voyage (13 routes)
`/voyages` (liste) · `/voyages/nouveau` · `/voyages/[slug]` + 9 sous-sections · `/mes-aventures` (19,6 ko, favoris/reprise — **à auditer vs switcher**, même doublon que ResumeActiveTripCard en Y0.2) · `/rapport-expedition` (57 ko, bilan post-voyage IA = phase `recount` → devient un mode de la section journal/overview, pas une route concurrente) · `/rapport-kit` (77,6 ko, générateur de rapport kit = **candidat fusion avec /ai-configurator**, les deux sont des wizards de recommandation) 

**Décision D5** : `/rapport-kit` + `/ai-configurator` = deux interfaces pour la même fonction (configurer/recommander un kit). Z1 avait sanctuarisé le configurateur. Arbitrage H1 : un seul wizard, l'autre redirect. 77 ko en jeu.

### Nature collectif — les gens (8 routes)
`/groupes` (43,6 ko monolithe) · `/groupes/[groupId]` · `/nouveau-groupe` (38,5 ko !) · `/equipages` + `/equipages/[slug]` (**doublon conceptuel de groupes** : crews = crews, tables distinctes mais fonction recouverte — AppShell pointe vers les deux) · `/nouveau-groupe` vs invitation equipage.

**Décision D6** : `groupes` et `equipages` sont **le même concept à deux étages** (groupe = communauté, équipage = expédition partagée). Le hub expose une seule nature `collectif` ; la distinction devient un filtre, pas deux routes racines. `/nouveau-groupe` à 38,5 ko est suspect — audit : pourquoi créer un groupe coûte plus que créer un voyage ?

### Mode live — le terrain (3 routes → 1)
`/randonnee-active` (canonique, cf. D2) · `/naviguer` (redirect) · `/boussole` (widget AR du mode live)

### Découvrir — hors hub (reste des tabs existants)
`/explorer` (carte sentiers) · `/carte-interactive` (doublon partiel d'explorer ? matchPaths partagés mais contenus distincts — refuge/eau vs sentiers. Garder comme vue d'explorer ? → D6) · `/pays` + `/pays/[code]` (guides) · `/guides` + `/guides/[slug]` · `/lieux` + `/lieux/[slug]` · `/outils` + `/outils/[slug]` (63 ko !) · `/boussole` (→ widget mode live).

### Communauté — reste intact (le 4e tab)
`/communaute` · `/feed` · `/clubs` (64,8 ko !) · `/carnets` (59,5 ko) · `/evenements` (45,2 ko) · `/groupes` → hub · `/entraide` · `/createurs` · `/experts` · `/messagerie` · `/ambassadeurs` · `/avis`.

### Commerce & compte — hors hub
`/panier` · `/checkout` · `/produit/[slug]` · `/kits` + `/kits/[slug]` (kits prêts-à-partir = **produits**, ne pas confondre avec /materiel/kits = inventaire) · `/boutique` **lien mort depuis l'accueil (3 occurrences !)** · `/compte` · `/profil` · `/abonnements` · `/fidelite` (30,9 ko) · `/recompenses` (27,5 ko) · `/gamification` (53 lignes = stub ?).

### À arbitrer : la nébuleuse « social-lite »
`/activite` (9,3 ko, feed d'activité brut — doublon de /feed ?) · `/recommandations` (1,6 ko, page vitrine IA sans fonction — **candidat suppression**) · `/copilote` (5,2 ko, chat IA branché GEMINI via useChat — **à fusionner dans le hub comme assistant contextuel**, il lit déjà ActiveTrip !) · `/encheres` (2,9 ko stub) · `/occasion` (40,9 ko) · `/location` (41,5 ko) · `/blog` · `/pro` · `/communaute-pro`.

**Décision D7** : `/recommandations` (vitrine sans back-end détectée) et `/activite` (redondant avec `/feed`) = candidats suppression/redirect, preuve grep exigée. `/copilote` devient l'assistant IA **dans le hub** (il consomme déjà ActiveTripContext — c'est l'IA explicative §10.5 qui existe déjà !).

---

## 4. LES LIENS MORTS — BUGS RÉELS DÉJÀ EN PROD

Vérifié par lecture directe de `src/app/page.tsx` :

| Lien | Où | Verdict |
|---|---|---|
| `/manifeste` | accueil hero + footer | **404** |
| `/boutique` | accueil ×4 (nav + footer catégories) | **404** |
| `/ateliers` | accueil | **404** |
| `/presse` | accueil footer | **404** |
| `/confidentialite` | accueil footer | 404 (existe : `/politique-confidentialite`) |

**Décision D8** : correction immédiate en H0.5 (pré-hub) — ces 404 sont visibles depuis la page d'accueil en production. `/manifeste` et `/presse` : soit contenu à créer, soit liens à retirer. Ce sont des bugs, pas des choix.

---

## 5. TOPOLOGIE CIBLE POST-HUB

```
                    ┌─ / (accueil)
   TAB BAR (5)      │
  ┌─────────────┐   ├─ /hub  ← LE HUB (fusionne materiel, voyages-nature, groupes, terrain, live)
  │ Pays        │   │    ├─ nature possession : inventaire·kits·preparation·depart·alertes·dispo
  │ Explorer    │   │    ├─ nature sortie : overview·itinéraire·kit·equipage·budget·documents·
  │ ★ HUB ★     │◄──┤    │   checklist·sécurité·journal·export (+ mode live randonnée)
  │ Communauté  │   │    └─ nature collectif : equipage·invitations·voyages-liés
  │ Profil      │   ├─ /explorer · /pays/* · /guides · /lieux · /carte-interactive(?D6)
  └─────────────┘   ├─ /communaute + feuilles (clubs·carnets·events·entraide·createurs·experts)
                    ├─ commerce : panier·checkout·produit·kits(prêts-à-partir)·boutique(à créer)
                    ├─ compte : compte·profil·abonnements·fidelite·recompenses
                    └─ static : cgv·cgu·cookies·contact·faq·mentions·confidentialité·blog·hors-ligne
```

**Comptage cible** : 102 routes → ~78 routes actives (−24 : redirects/suppressions ci-dessus), dont **23 absorbées par le hub** (8 materiel + 13 voyage-nature + terrain + preparer-randonnee + preparation) sans perte de fonction : chaque URL actuelle garde une destination (redirect 307 ou section).

---

## 6. TABLEAU DES DÉCISIONS À FIGER (avant H1)

| # | Arbitrage | Recommandation | Statut |
|---|---|---|---|
| D1 | features/hub (terrain) → socle du HubShell H | Absorber, migrer le store (GPS/batterie) | à valider |
| D2 | 3 entrées mode live GPS → 1 | /randonnee-active canonique, /naviguer + /boussole redirigés, capacités → widgets | à valider |
| D3 | /preparation racine | Redirect → /hub/preparation | à valider |
| D4 | /alertes racine vs /materiel/alertes | Audit Z2, une seule section `alertes` du hub | à valider |
| D5 | /rapport-kit + /ai-configurator | Un seul wizard IA kit (77 ko + 51 ko → 1) | à valider |
| D6 | /carte-interactive vs /explorer | Diff fonctionnel ; si chevauchement > 70 % → /explorer absorbe | à valider |
| D7 | /recommandations, /activite, /encheres | Suppression si greps d'entrants vides (preuve obligatoire) | à valider |
| D8 | Liens morts accueil (/boutique, /manifeste…) | Correction immédiate H0.5 | à valider |
| D9 | /mes-aventures vs AdventureSwitcher | Même doublon que ResumeActiveTripCard (Y0.2) : audit, absorption probable | à valider |
| D10 | /groupes + /equipages + /nouveau-groupe | Une nature `collectif`, filtres internes ; /nouveau-groupe audit (38,5 ko suspect) | à valider |

**Aucune suppression n'est décrétée ici** — ce sont des recommandations chiffrées. Chaque suppression exigera : grep d'entrants à zéro collé dans le commit + redirect ou remplacement pour tout URL public + portes vertes + compteur de tests non décroissant (les conventions du plan H §9.4 s'appliquent).

---

## 7. CE QUE CET AUDIT CHANGE AU PLAN H

1. **H0.4 (nouveau)** : exécuter les arbitrages D1–D10 avec preuves (grep + diff fonctionnel), écrits dans `docs/H_DECISIONS.md`. C'est le Z1 du hub — **bloquant avant H1**, car le HubShell doit savoir s'il absorbe features/hub ou part de zéro.
2. **H3 change de point de départ** : si D1 validée, la coquille H hérite de BaseCampView/ActionModeView/useHubStore (46 ko d'actif) au lieu de tout écrire — gain estimé 15–20 h sur H3+H6 (le mode live §10.5 est déjà écrit à 60 %).
3. **H4 gagne un pilier** : la nature possession n'est pas seulement /materiel — elle inclut les capacités terrain (SOS, boussole, batterie) qui rendent le hub crédible « en montagne ».
4. **Nouveau sous-chantier H0.5** : liens morts accueil (D8) — petits fixs, gros signal qualité.
5. **La zone « découverte » s'éclaircit** : explorer/pays/guides restent des tabs d'entrée ; le hub est le tab d'**action**. Ça valide la bottom bar à 5 sans déplacer Earth/Aventures.