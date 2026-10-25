# H_ROUTE_DECISIONS — Matrice décisionnelle détaillée par route

**Base** : `8e3b7ffa` · **Mesures** : H0 (08/09/2026, tailles `src/app/<route>` en octets, entrants `href="…"`). Détail des arbitrages : `docs/H_DECISIONS.md` (D1–D10). Cartographie source : `docs/H_ROUTE_MAP.md`.

Légende devenir : `HUB:section` = rendue par la coquille `/hub` (deep-link préservé) · `REDIRECT:307→X` = redirect en H5 · `GARDÉE` = inchangée · `SUPPR→X` = suppression + redirect, preuve grep exigée au commit · `À CRÉER` = route manquante.

## 1. Nature possession — l'équipement (hub, H3–H4)

| Route | Taille mesurée | Devenir | Phase |
|---|---|---|---|
| `/materiel` (racine) | 35 168 o tot. `/materiel/*` (20 fichiers) | REDIRECT:307→`/hub` (cockpit départ → section `depart`) | H5 (wrap dès H4) |
| `/materiel/inventaire` | inclus ci-dessus | HUB:`inventaire` | H4 |
| `/materiel/kits` | inclus ci-dessus | HUB:`kit` | H4 |
| `/materiel/preparation` | inclus ci-dessus | HUB:`preparation` | H4 |
| `/materiel/depart/[id]` | inclus ci-dessus | HUB:`depart` | H4 |
| `/materiel/disponibilite` | inclus ci-dessus | HUB:`disponibilite` | H4 |
| `/materiel/alertes` | 5 460 o | HUB:`alertes` (fusion D4) | H4 |
| `/materiel/forget` | inclus ci-dessus | HUB:`alertes` (fusion, cf. synthèse §11) | H4 |
| `/alertes` (racine) | 33 666 o | HUB:`alertes` (fusion D4, sens tranché H4) | H4 |
| `/terrain` (+ features/hub) | 1 702 o + 14 fichiers | ABSORBÉ socle HubShell (D1) | H3 |

## 2. Nature sortie — le voyage (hub, H3)

| Route | Taille mesurée | Devenir | Phase |
|---|---|---|---|
| `/voyages` (liste) | 126 278 o tot. `/voyages/*` (29 fichiers) | GARDÉE (liste = entrée nature sortie) | — |
| `/voyages/[slug]` + 9 sous-sections | inclus ci-dessus | GARDÉES, branchées via switcher (régression zéro) | H3 |
| `/voyages/nouveau` | inclus ci-dessus | GARDÉE | — |
| `/mes-aventures` | 20 426 o, 0 entrant | REDIRECT:307→`/hub` si switcher couvre (D9, tranché H2) | H5 |
| `/rapport-expedition` | non remesuré (57 ko cités) | Mode `recount` de la section journal (pas de route concurrente) | H4 |
| `/rapport-kit` | 78 424 o | SUPPR→wizard survivant (D5) | H5 |
| `/ai-configurator` | 101 923 o | Wizard canonique section kit (D5) | H4/H5 |
| `/preparer-randonnee` | 115 820 o (17 fichiers) | Déjà redirect → `/materiel/depart` (constat H0) → re-ciblé `/hub/depart` | H5 |
| `/preparation` (racine) | 1 816 o | REDIRECT:307→`/hub/preparation` (D3) | H5 |
| `/randonnee-active` | 1 278 o + HikingCockpitPage | Mode live canonique du hub (D2) | H3/H6 |
| `/naviguer` | 17 112 o | REDIRECT:307→`/randonnee-active` (D2) | H5 |
| `/boussole` | 16 863 o | REDIRECT:307→`/randonnee-active` + widget AR (D2) | H5 |

## 3. Nature collectif — les gens (hub, H4)

| Route | Taille mesurée | Devenir | Phase |
|---|---|---|---|
| `/groupes` | 56 861 o (3 fichiers, monolithe) | Découpé en sections hub (D10) | H4 |
| `/groupes/[groupId]` | inclus ci-dessus | HUB:`equipage` (filtre groupe/équipage) | H4 |
| `/equipages` + `/equipages/[slug]` | 23 762 o | Fusionnés nature collectif (D10) | H4/H5 |
| `/nouveau-groupe` | 40 211 o | Audité → section `creer` probable (D10) | H4 |

## 4. Tabs conservés (hors hub)

| Route | Taille mesurée | Devenir | Phase |
|---|---|---|---|
| `/explorer` | 7 740 o | GARDÉ (tab Découverte) | — |
| `/carte-interactive` | 17 700 o | GARDÉ sauf si D6 tranche absorption (>70 %) | H4 |
| `/pays`, `/guides`, `/lieux`, `/outils` | non remesurés | GARDÉS | — |
| `/communaute`, `/feed`, `/clubs`, `/carnets`, `/evenements`, `/entraide`, `/messagerie` | non remesurés | GARDÉS (tab Communauté) | — |
| `/copilote` | 6 944 o, 0 entrant | Assistant contextuel DANS le hub (D7) | H5 |
| `/activite` | 10 069 o, 1 entrant | SUPPR→`/feed` si entrant traité (D7) | H5 |
| `/recommandations` | 3 304 o, 0 entrant | SUPPR→`/hub` ou `/explorer` (D7) | H5 |
| `/encheres` | 4 641 o | Audit entrants élargi en H5 (stub ?) | H5 |
| `/kits`, `/produit/[slug]`, `/panier`, `/checkout` | non remesurés | GARDÉS (commerce) | — |
| `/boutique` | ABSENTE, 45 refs | À CRÉER (minimale) ou retarget `/kits` (D8, H0.5) | H0.5 |
| `/compte`, `/profil`, `/abonnements`, `/fidelite`, `/recompenses`, `/gamification` | non remesurés | GARDÉS | — |

## 5. Liens morts accueil (H0.5, D8)

| Lien | Verdict H0 | Correction H0.5 |
|---|---|---|
| `/boutique` (×4+) | 404, route absente | Créer route minimale OU retarget `/kits` (choix en H0.5 selon contenu `/kits`) |
| `/manifeste` | 404 | Retirer lien OU créer page (selon intention produit — lire `page.tsx`) |
| `/ateliers` | 404 | Idem |
| `/presse` | 404 | Idem |
| `/confidentialite` | 404 (existe `/politique-confidentialite`) | Re-cibler le lien |

## 6. Compte rendu d'exécution (rempli en H5)

| Suppression/redirect | Grep à zéro (commit) | Redirect posé | Portes | Compteur |
|---|---|---|---|---|
| (à remplir — une ligne par URL, jamais de valeur recopiée) | | | | |

**Bilan estimé** (inchangé §11) : ~210 ko supprimés, 23 routes absorbées, 10 redirects 307, 1–2 créations (`/hub`, `/boutique`).
