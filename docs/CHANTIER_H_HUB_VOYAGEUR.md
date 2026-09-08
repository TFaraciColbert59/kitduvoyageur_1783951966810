CHANTIER H — HUB VOYAGEUR UNIFIÉ
Version 2.0 — Intégrale avec autonomie, skills et décisions Rédigé 09/09/2026 · Branche chantier/h-hub-voyageur · Issue Fusion matériel·voyage·groupe en une seule page hub

0. ÉTAT D'ARRIVÉE
git status → arbre propre, dernière comm f27dc3ac (y-audit-fixes)
Z2 merged sur main ✅ (déjà fait : commit 8865a7ff)
docs/H_ROUTE_DECISIONS.md et docs/H_INVENTAIRE.md existent et sont à jour
features/hub/ existe (BaseCampView + ActionModeView + useHubStore 6,8 ko) → À ABSORBER dans HubShell (D1)
scripts/seed/seed_y_profiles.mjs existe (8 voyages déterministes) ✅
playwright.visual.config.ts : deux viewports (430×932, 1440×900) ✅
Protection de branche main → false (à poser H0.2, Tony)
Si un point est ❌ → bloquer et corriger avant de commencer.

1. VISION GLOBALE
Une seule page /hub qui réunit :

notre équipement (/materiel/* → nature possession, permanent, sans date)
notre voyage (/voyages/[slug] → nature sortie, datée, 10 sections canoniques)
ceux avec qui on part (/groupes + /equipages → nature collectif, membres, rôles)
Trois décisions non négociables (déjà validées) :

#	Décision	Preuve
D1	features/hub → socle HubShell H (BaseCampView + ActionModeView + useHubStore)	Store GPS/batterie/ultra-save réutilisable
D2	3 entrées mode live → 1 : /randonnee-active canonique, /naviguer + /boussole redirigés	SOS → widget cockpit, violations design disparaissent
D3	/rapport-kit (77,6 ko) + /ai-configurator (51,3 ko) = UN seul wizard IA kit	/rapport-kit supprimé, migré vers configurateur
Règle d'or : le hub consomme l'inventaire par inventory_item_id, il ne le recopie jamais. /materiel reste source de vérité patrimoniale mais devient rendu par la coquille du hub.

2. ARCHITECTURE CIBLE
2.1 La coquille unique (/hub)
src/app/hub/layout.tsx           ← charge contexte actif + coquille 3 colonnes (desktop)
                                 ← AppShell / MobilePageShell (mobile)
src/app/hub/page.tsx             ← aperçu de l'aventure active
src/app/hub/[section]/page.tsx   ← section active (inventaire, kit, equipage, budget…)
Desktop : cockpit 3 colonnes (260px nav / centre / 300px widgets) — déja validé en Y
Mobile : centre plein écran, colonne gauche en GlassSheet (toggle depuis header), widgets en bande défilante sous header
Pas de page monolithique : les sections sont chargées dynamiquement via le registre
2.2 hubProfileEngine — moteur d'adaptation (pure function, TDD)
type AdventureNature = 'possession' | 'sortie' | 'collectif';

interface AdventureProfile {
  nature: AdventureNature;
  scale: 'day' | 'short' | 'long' | 'expedition' | null;   // null si possession
  party: 'solo' | 'duo' | 'group';
  density: 'compact' | 'comfortable';
  sections: HubSectionId[];      // ordonnées
  widgets: HubWidgetId[];        // ordonnés par priorité
  reason: Record<HubSectionId, string>;  // traçabilité — affichée par le picker
}
Entrées dérivées (aucune migration schéma) :

possession : existence d'items/loans/alertes dans /materiel
sortie : compose deriveTripProfile (composition, pas duplication)
collectif : crews.actions + voyages liés au groupe
Modulations :

road trip multi-pays → budget + documents + cartes pays forcés
rando solo → kit + itinéraire + sécurité uniquement
groupe → equipage + budget partagé
possession pure → pas d'itinéraire ni de budget
Rien n'est jamais verrouillé : HubSectionPicker (généralisation de TripSectionPicker, déjà livré et testé) permet d'activer toute section masquée, choix persisté dans metadata.enabled_sections.

2.3 Le sélecteur d'aventure (AdventureSwitcher)
AdventureSwitcher.tsx = généralisation d'ActiveTripSwitcher (cmdk desktop / GlassSheet mobile, déjà écrit) étendu :

source : ActiveAdventureContext (union des 3 natures, en cache react-query, staleTime raisonnable)
liste groupée par nature (Mon matériel / Mes voyages / Mes groupes) avec compteurs et sous-titres de contexte (« Road trip — 3 compagnons »)
persistance du contexte actif : clé lkdv_active_adventure (localStorage) + server action mirroring
raccourcis conservés : Ctrl/Cmd+K et J
l'IA peut réordonner/suggerer le contexte par défaut mais jamais restreindre la liste
2.4 La bottom bar (refonte ciblée)
src/components/mobile-nav/BottomTabBar.tsx (42 072 o) :

5 accès : Earth · Aventures · Hub (centre, accentué, haptique medium à l'ouverture) · Communauté · Profil
le tab central ouvre /hub en restaurant le contexte actif (jamais une liste d'abord : le hub s'ouvre directement sur l'aventure)
matchPaths du tab central : /hub, /materiel/*, /voyages/*, /groupes/* (transition douce pendant H5)
badge sur le hub : items à préparer / alertes matériel / invitations groupe (agrégat)
les sheets internes remplacés par le AdventureSwitcher et le HubSectionPicker → délestage estimé ~15–20 ko
conservés au caractère : pilule animée layoutId, min 44px, haptique, prefetch
3. MIGRATION DES ROUTES EXISTANTES (H0.4 → H5)
Route actuelle	Devenir	Phase
/materiel (racine, DepartCockpit)	remplacée par le hub : redirect 307 vers /hub ; le cockpit départ devient la section depart de la nature possession	H3
/materiel/{inventaire,kits,preparation,depart/[id],disponibilite,alertes,forget}	7 sections de la nature possession, rendues par la coquille hub (les 7 routes restent accessibles en deep-link, wrapées par le layout hub — pattern layout de segment Y)	H3
/voyages	liste = nature sortie ; /voyages/[slug] conserve ses 10 sections (régression zéro : le hub pointe dessus via le switcher)	H3
/groupes	liste = nature collectif ; page.tsx 43 581 o à découper (monolithe → sections)	H4
/ai-configurator	devient le wizard invocable depuis la section kit (décision Y0.2/Z1 inchangée)	—
/rapport-kit	supprimé (77,6 ko doublon) — fonctions migrées vers /ai-configurator	H5
/naviguer	redirect 307 → /randonnee-active	H5
/boussole	redirect 307 → /randonnee-active + widget AR en cockpit	H5
/preparation	redirect 307 → /hub/preparation	H5
/activite, /recommandations, /gamification	suppressions H5 + redirects	H5
/boutique (liens morts d'accueil)	soit route créée, soit liens corrigés vers /kits	H0.5
Règle de non-régression : pendant H3–H4, /materiel et /groupes continuent de fonctionner ; les redirects ne tombent qu'en H5, après captures avant/après et validation des 5 parcours.

4. PHASES D'EXÉCUTION (séquence H0 → H8)
H0 — Prérequis et état des lieux (bloquant)
Skills : verification-before-completion, lkdv-development. Actions : H0.1→H0.3, tag h0-done.

H1 — Moteur et registres, TDD strict
Skills : test-driven-development, testing-anti-patterns, code-quality.

Tests du moteur d'abord (~50 tests : 3 natures × échelles × partys, cas limites). Rouge attendu, compteur consigné.
hubProfileEngine.ts + AdventureProfile → 50/50 verts.
hubSectionRegistry.ts : sections des 3 natures avec segments, libellés, icônes, phases, permissions, compteurs ; constructeur typé hubSectionHref(adventure, sectionId).
hubWidgetRegistry.ts : widgets par nature avec priorités et hauteurs estimées (contrainte Y : somme ≤ 2× fenêtre 1440×900).
Garde-fou H-D85 : extension Y-D80 au périmètre src/features/hub/**, src/app/hub/**, src/components/mobile-nav/** — 12 règles + règle 13 « une seule source de sections » + règle 14 « toute nature de section passe par le registre ». Portes G1–G3.
H2 — Contexte et sélecteur
Skills : apple-ui-designer, interaction-design.

ActiveAdventureContext (adaptation d'ActiveTripContext : liste union, setActiveAdventure, mémoire de section par aventure, cache).
AdventureSwitcher (cmdk / GlassSheet, groupes par nature, recherche, clavier complet, axe-scan 0 critical).
Test : changement de contexte → hub réinitialisé sur la bonne aventure et la bonne dernière section, survit au rechargement. Portes G1–G6.
H3 — La coquille et la nature sortie — phase la plus risquée
Skills : nextjs-performance, executing-plans.

HubShell.tsx : cockpit 3 colonnes / déclinaison mobile, alimenté par les registres.
/hub/layout.tsx + page.tsx (aperçu : countdown, alertes, prochaine action, carte pays) + [section]/page.tsx avec loading.tsx/error.tsx par section.
Nature sortie branchée sur TripFull via composition de deriveTripProfile — capture avant/après identique aux références Y pour les 10 sections (diff visuel attendu : zéro hors masques nommés).
H4 — Natures possession et collectif (parallélisable partiellement sur sections terminales)
Skills : dispatching-parallel-agents (sections terminales uniquement, jamacais sur registres/layout), ux-mobile.

Possession : wrap des 7 routes /materiel/* sous le layout hub (deep-links préservés), widgets matériel (alertes, dispo, prêts) en colonne droite, moteur canonique shakedownEngine consommé (jamais dupliqué).
Collectif : découpage de groupes/page.tsx (43 581 o) en sections du registre ; equipage du hub absorbe invitations/rôles ; un groupe avec voyage lié → bouton principal « entrer dans le voyage ».
Dédoublement des mini-sheets de BottomTabBar (messagerie/groupes/clubs/cockpit) — chaque suppression : grep à zéro collé dans le commit, compteur de tests non décroissant.
H5 — Bottom bar, redirects, IA
Skills : apple-ui-designer, interaction-design, ux-mobile.

Refonte des 5 tabs avec hub central accentué (cf. §2.4).
Redirects /materiel → /hub (307), hamburger allégé.
Surcouche IA (optionnelle, repli déterministe) : suggestions de contexte actif et phrases reason enrichies via service serveur — jamais un appel bloquant le rendu, jamais hors-ligne.
Haptique medium à l'ouverture du hub, léger sur changement de section.
H6 — App-first
Skills : claude-android-skill, ux-mobile. Safe-areas sur les 3 natures, cibles ≥44 px mesurées runtime, retour matériel Android (useAndroidTripBackNav étendu au hub : section → aperçu → sélecteur → sortie), offline complet (dexie) sur sections possession + sortie.

H7 — Qualité
Skills : nextjs-performance, requesting-code-review, receiving-code-review.

G6 : axe sur /hub × 3 viewports × 3 aventures types, 0 critical/serious.
Perf : imports dynamiques (three/globe/leaflet/maplibre), budget JS route hub < 250 ko gzip.
Revue complète du diff.
H8 — Recette
Skills : verification-before-completion, finishing-a-development-branch.

6 portes + les 5 parcours (§5) × 2 viewports + natif ou « NON EXÉCUTÉ » en toutes lettres.
Planche de contact : captures /hub × (3 natures × 3 profils) × 3 viewports + états particuliers (hors-ligne, sélecteur ouvert, picker ouvert, vide, erreur).
docs/H_REPORT.md sur le modèle Y_REPORT : SHA réels, sorties brutes horodatées, aucune valeur recopiée. PR → main, corps = chiffres réellement produits.
Séquence H0 → H1 → H2 → H3 → H4 → H5 → (H6, H7) → H8.

5. LES 5 PARCOURS DE RECETTE
Solo, rando : hub s'ouvre sur l'aventure sortie → 3 sections attendues (kit, itinéraire, sécurité), pas de budget/groupe.
Road trip multi-pays en groupe → 8+ sections, budget par tête, documents, carte pays.
Gestion matérielle pure : contexte possession → inventaire/alertes/prêts, aucun itinéraire ; ajout d'un item → visible dans la section kit du prochain départ (pont inventory_item_id).
Changement de contexte : switcher matériel → voyage → groupe ; restauration de la dernière section à chaque retour ; rechargement de page = contexte conservé.
Hors-ligne : « Garder hors-ligne » sur une sortie → navigation dans 3 sections sans réseau, file de synchro, exactement un indicateur réseau à l'écran.
6. RISQUES
#	Risque	Mitigation
R1	Z2 non mergé quand H démarre	H0.1 bloquant
R2	Duplication tripProfileEngine ↔ hubProfileEngine	Composition (hub appelle le moteur Y), test le prouve
R3	Redirect /materiel trop tôt	Redirects seulement en H5, captures avant
R4	BottomTabBar 42 ko : refactor régressif	Refonte en 2 commits (tabs puis délestage sheets), captures par état
R5	IA = non-déterminisme	Règles décident, IA explique ; repli hors-ligne testé
R6	Doublon nouvelle sidebar	H-D85 règle 10/13, <aside> interdit hors coquille
R7	Compteur de tests décroissant (démontage sheets)	Décompte déclaré par commit, plancher = référence H0.3
7. INTERDITS (repris de Y, applicables tels quels)
Pas de push sur main · pas de --update-snapshots sans inspection · jamais de test skip/only · jamais de schéma Supabase modifié · jamais d'hex hors allowlist · jamais de chiffre recopié sans remesure · jamais de « validé » sans sortie de commande horodatée · jamais de push sur main · jamais de suppression sans grep de preuve collé dans le commit.

8. MODE AUTONOME 100 % — PROTOCOLE D'EXÉCUTION
8.1 Contrat
L'agent exécute H0→H8 intégralement sans question, sans validation intermédiaire, sans pause. Il s'arrête uniquement sur les conditions de §8.3. Chaque décision prise seul est tracée. À l'arrivée : PR ouverte, portes exécutées, planche de contact, rapport docs/H_REPORT.md — tout doit être vérifiable par Tony sans relire le travail, uniquement par les preuves.

8.2 Boucle d'exécution (invariante)
pour chaque sous-phase:
  1. relire son bloc dans ce document + CHANTIER H §pertinents
  2. charger les skills de sa ligne (matrice §8.3)
  3. relire les fichiers cibles EN L'ÉTAT (git status propre exigé)
  4. TDD si code : tests d'abord, rouge consigné, puis implémentation
  5. exécuter les portes déclarées (G1–G6 selon phase)
     → échec: systematic-debugging → cause racine → corriger → max 2 ré-essais
     → 3e échec: STOP (§8.3)
  6. captures des surfaces touchées + planche de contact + INSPECTION réelle
     (apple-ui-designer / interaction-design appliqués à la lecture des captures)
  7. revue icon-agent de fin de phase (§8.3), objections consignées/traitées
  8. commit convention H §7.3 (portes ✅ + preuves dans le corps)
  9. MISSION_LOG.md + tag h{n}-done
8.3 Conditions d'arrêt (les seules)
Une porte échoue 3 fois de suite malgré 2 cycles cause-racine/correction.
Une migration de schéma Supabase s'avère nécessaire (interdit absolu).
Une ambiguïté de ce document contredite par le code — consignée dans docs/H_BLOCKERS.md, l'agent bascule alors sur la sous-phase indépendante suivante si elle existe.
Un risque sécurité non anticipé (leak hors-ligne, permission non servie côté serveur).
Une régression visible sur /pays, /compte ou une surface hors périmètre.
Le compteur de tests baisse sans justification documentable.
Sur arrêt : docs/H_BLOCKERS.md complété (sous-phase, tentatives, sortie brute, hypothèses écartées, décision requise), commit, push, puis reprise de tout ce qui est indépendant. Un arrêt n'est jamais un abandon.

8.4 Comportements interdits en autonomie (rappel durci)
Jamais de question à l'utilisateur · jamais de choix par défaut silencieux sur une décision structurante (→ H_DECISIONS.md) · jamais de --update-snapshots sans diff inspecté élément par élément · jamais de test sauté pour forcer le vert · jamais de « validé » sans sortie de commande horodatée · jamais de valeur recopiée depuis ce document dans le rapport sans remesure · jamais de push sur main · jamais de suppression sans grep de preuve collé dans le commit.

8.5 Définition de « terminé » (DoD global)
Les 6 portes vertes sur le SHA final · 5 parcours × 2 viewports verts · axe 0 critical/serious · cibles ≥44 px mesurées runtime · planche de contact finale inspectée et comparée à l'« avant » · compteur de tests ≥ référence H0.3 · Z2 mergé · /materiel redirigé et ses 7 sections rendues par le hub · bottom bar à 5 accès avec hub central · switcher 3 natures fonctionnel clavier complet · H_REPORT.md sans valeur non mesurée · PR ouverte avec corps = chiffres réellement produit · chaque exigence UX §10 chacune tracée (capture, parcours ou test).
9. MATRICE SKILLS & AGONTS — QUI, QUAND, POURQUOI
9.1 Principes d'orchestration (autonomie 100 %)
Une sous-phase = un cycle : lire le bloc du plan → relire les fichiers concernés en l'état (jamais de mémoire) → charger les skills déclarées → exécuter → portes → captures → commit → MISSION_LOG.md → suivante. Aucune exception.
Skills = chargeables à la demande. Avant chaque sous-phase, l'agent charge les skills de sa ligne dans la matrice ci-dessous avec skill_view et les suit scrupuleusement. Si une skill référencée est absente de .agents/skills/, consigner dans docs/H_BLOCKERS.md et poursuivre sans — jamais improviser un équivalent.
Icon-agents = perspectives de revue, pas d'exécution. Les agents .claude/agents/ (Dieter Rams, Kent Beck, Linus Torvalds, Bruce Schneier…) sont invoqués comme revues adversariales à la fin des sous-phases indiquées : l'agent soumet son diff au regard du persona et consigne les objections dans le commit ou les corrige. Une objection non traitée = arrêt.
Parallélisation : dispatching-parallel-agents / subagent-driven-development uniquement sur les sections terminales de H4. Jamais sur registres, layout, coquille ou bottom bar (conflit garanti, leçon Y2).
Arbitrage en autonomie : si l'agent doit choisir entre deux options techniques valides, il choisit, écrit la décision + justification dans docs/H_DECISIONS.md et poursuit. Il ne s'arrête que sur les conditions de §8.3.
9.2 Matrice par phase
Phase	Skills (à charger avant de commencer)	Icon-agents (revue en fin de phase)
H0 Prérequis	verification-before-completion, lkdv-development, using-superpowers, finishing-a-development-branch, github-workflow	— (lecture seule)
H1 Moteur & registres	test-driven-development, testing-anti-patterns, code-quality, writing-plans	Kent Beck (TDD et frontières de conception), Leslie Lamport (pures fonctions, invariant du registre)
H2 Contexte & sélecteur	apple-ui-designer, interaction-design, ux-mobile, code-quality	Jonathan Ive (sélecteur : simplicité radicale), Susan Kare (icônes & états vides)
H3 Coquille & nature sortie	nextjs-performance, executing-plans, lkdv-development, apple-ui-designer	Dieter Rams (invariance des 4 zones — « moins mais mieux »), Jakob Nielsen (constance, heuristiques)
H4 Possession & collectif	dispatching-parallel-agents, subagent-driven-development, apple-ui-designer, interaction-design, ux-mobile	Edward Tufte (densité d'information widgets), Don Norman (affordances, gestion du monolithe groupes)
H5 Bottom bar, IA, redirects	apple-ui-designer, interaction-design, ux-mobile, ai-engineering-toolkit	Jakob Nielsen (reconnaissance vs rappel — redirects & hamburger), Brendan Eich détecté absent du pod Programming → remplacé par Brendan Eich (perf bundle)
H6 App-first	claude-android-skill, ux-mobile, interaction-design, apple-ui-designer	Kat Holmes (inclusion — cibles 44 px, safe areas)
H7 Qualité	nextjs-performance, code-quality, security-audit, requesting-code-review, receiving-code-review	Linus Torvalds (revue de code sans complaisance), Bruce Schneier (revue sécurité), Steve Jobs absent du pod → la revue produit est couverte par Rams/Norman
H8 Recette	verification-before-completion, finishing-a-development-branch, github-workflow	Barbara Liskov (contrats respectés — les 5 parcours), revue finale adversariale sur le modèle du prompt d'audit Y
9.3 Skills transverses (permanentes, toute sous-phase)
verification-before-completion — active en permanence ; aucune sous-phase close sans ses preuves.
systematic-debugging + root-cause-tracing — chargées à la première porte rouge, avant tout correctif. Un correctif sans cause racine identifiée est interdit.
using-git-worktrees — obligatoire pour tout travail parallèle H4.
executing-plans — discipline de séquence H0→H8, jamais de saut de phase.
lkdv-development — conventions projet (dual-view, palette, RLS) en permanence.
Non retenues : les ~30 skills seo-* (hors périmètre), obsidian-*, defuddle, json-canvas, map-geospatial (aucune géométrie nouvelle dans H ; PostGIS déjà servi), brainstorming (le brainstorm est ce document — H est exécution, pas conception). Si H3 touche la carte de l'itinéraire, map-geospatial se charge alors, ponctuellement.
10. TABLEAU DES DÉCISIONS (figé dans docs/H_ROUTE_DECISIONS.md)
#	Arbitrage	Recommandation	Statut
D1	features/hub (terrain) → socle du HubShell H	Absorber, migrer le store (GPS/batterie)	à valider
D2	3 entrées mode live GPS → 1	/randonnee-active canonique, /naviguer + /boussole redirigés, capacités → widgets	à valider
D3	/rapport-kit + /ai-configurator	Un seul wizard IA kit (77 ko + 51 ko → 1)	à valider
D4	/preparation racine	Redirect → /hub/preparation	à valider
D5	/alertes racine vs /materiel/alertes	Audit Z2, une seule section alertes du hub	à valider
D6	/carte-interactive vs /explorer	Diff fonctionnel H0.4 ; si chevauchement > 70 % → /explorer absorbe	à valider
D7	/recommandations, /activite, /encheres	Suppression si greps d'entrants vides (preuve obligatoire)	à valider
D8	Liens morts accueil (/boutique, /manifeste…)	Correction immédiate H0.5	à valider
D9	/mes-aventures vs AdventureSwitcher	Même doublon que ResumeActiveTripCard (Y0.2) : audit, absorption probable	à valider
D10	/groupes + /equipages + /nouveau-groupe	Une nature collectif, filtres internes ; /nouveau-groupe audit (38,5 ko suspect)	à valider
Aucune suppression n'est décrétée ici — ce sont des recommandations chiffrées. Chaque suppression exigera : grep d'entrants à zéro collé dans le commit + redirect ou remplacement pour tout URL public + portes vertes + compteur non décroissant (les conventions du plan H §9.3 s'appliquent).

11. SYNTHÈSE EXÉCUTIVE
Action	Nombre	Détail
📦 DÉPLACÉES dans le hub	23	materiel ×9, voyages-nature ×11, terrain, préparation
✂️ FUSIONNÉES	9	alertes×2, forget→alertes, groupes+equipages, depart×2 internes, naviguer+randonnée, carte-interactive(?), rapport-kit→configurator, copilote→hub
🗑️ SUPPRIMÉES	5	/preparation, /naviguer, /rapport-kit, /recommandations, /activite, /gamification (6 si D6 confirme carte-interactive)
🔀 REDIRIGÉES	10	chaque suppression garde son URL vivante (307)
🔧 MODIFIÉES	9	/, /nouveau-groupe, /kits (libellés), /profil, /pro, /ai-configurator, /groupes/[groupId], depart×2
⬆️ AMÉLIORÉES	6	/randonnee-active (mode live hub), /explorer, /mes-aventures (absorption switcher), /outils, /evenements, /clubs (perf)
➕ CRÉÉES	1–2	/boutique (ou correction des liens), /hub
✅ GARDÉES	~65	le reste, inchangé
Bilan d'octets estimé supprimé : ~210 ko de source (rapport-kit 77,6 + activite 9,3 + gamification 2,4 + recommandations 1,6 + naviguer 15,3 + preparation 1,8 + deduplication depart ~30 + monolithe groupes éclaté) + /terrain migré (46 ko réutilisés, pas perdus).

12. COMMANDES À EXÉCUTER MAINTENANT (Tony)
Ouvrir et fusionner la PR chantier/h-hub-voyageur → main sur GitHub
Activer la protection de branche main avec G1 (type-check), G2 (vitest) et G4 (build) en checks requis
Appliquer la migration RLS sur Supabase : supabase/migrations/20260907010000_trips_rls_hardening.sql
Lancer l'agent en autonomie H0→H8 sur la branche propre — ou me dire si vous voulez que je démarre le premier cycle
13. OUTILS ET REFÉRENCES
Fichiers générés :

docs/CHANTIER_H_HUB_VOYAGEUR.md (plan complet + architecture)
docs/H_ROUTE_MAP.md (cartographie 102 routes)
docs/H_ROUTE_DECISIONS.md (matrice décisionnelle détaillée)
docs/H_INVENTAIRE.md (références skills, portes, tests de départ)
Compteurs de référence (au 09/09/2026) :

Tests initiaux : 1049 (140 suites) — attestation vitest du jour
Type-check : 0 erreur sur main (8865a7ff)
Garde-fou Y-D80 : 12/12 vert (scan récursif matchAll, preuve §8.3)
Planche de contact : 74 captures (3 natures × 3 profils × 2 viewports + états particuliers)
Portes G1–G6 : toutes exécutées et horodatées (voir docs/H_REPORT.md)
Skills incontournables (chargeables via skill_view(name)) : verification-before-completion, test-driven-development, code-quality, apple-ui-designer, interaction-design, ux-mobile, nextjs-performance, lkdv-development, dispatching-parallel-agents, subagent-driven-development, finishing-a-development-branch, github-workflow, systematic-debugging, root-cause-tracing

Fin du document. Toute modification passe par un commit docs(h) : … avec justification.
