# DIFFS_A — Parité maquette ↔ écrans réels, écrans 1 à 4

Revue visuelle `parite-design` — lecture seule, aucun code modifié, aucun build, aucun commit.
Périmètre : `/` (1), `/cas/post_report/…002` (2), `/membres/…001` (3), `/valider/…001` (4) + leurs états (motif, menu, tiroirs, saisie).

---

## 0. Méthode et fiabilité des preuves

| Source | Usage | Fichier |
|---|---|---|
| Maquettes (référence) | attendu, valeurs déclarées **et** box model rejoué | `reference/maquette/{Main,Moderation,Membre,Remboursement}-1440.png` + `crm/bundle/references/maquette/*.dc.html` |
| Captures gelées | preuve visuelle de l'état au moment de la capture | `design/01…10-*.png` (`manifest.json` → `at: 2026-11-09T19:18:48Z`) |
| App live `http://127.0.0.1:4200` | `getBoundingClientRect` + `getComputedStyle` (valeurs exactes) | relevés horodatés 20:20 → 20:40 |

Deux précautions prises, qui changent la lecture :

1. **Les `.dc.html` sont rejoués** localement (CSS inline, même Chromium) pour obtenir le box model exact de la maquette, et non une estimation à l'œil. Les largeurs de colonnes sont en plus vérifiées au pixel sur les PNG (détection de bordures verticales).
2. **Le workspace a bougé pendant la revue.** `queue-screen.tsx`, `queue-list.tsx`, `crm.module.css`, `session-card.tsx` ont un mtime 20:16–20:17, postérieur aux captures (20:18). Trois états distincts ont donc été observés. Chaque écart porte son statut : `ouvert` (vérifié au dernier relevé 20:34–20:40) ou `fermé depuis la capture`. Trois constats faits sur les captures se sont révélés **faux en live** et sont donc écartés de la liste : tons des boutons de décision (verts/blancs/rouges conformes), bloc média (présent), titre en minuscules (état transitoire du CSS, absent des captures 02 et 04 vérifiées au crop). Les captures `02` et `05` viennent de builds différents : `05` affiche encore « Aucun média joint. » alors que `02` montre la vignette floutée.

Conséquence de méthode : les cellules « Constaté » citent une **mesure** (px, hex, texte DOM) et non une impression. Les crops d'images réduites ont produit des erreurs de lecture ; ils ne servent plus de preuve.

---

## 1. Écarts — transversaux (les 4 écrans)

| ID | Écran | Attendu (maquette, zone) | Constaté (preuve + mesure) | Grav. | Correction proposée | Fermeture |
|---|---|---|---|---|---|---|
| D-A01 | T | Cartes : liseré clair `box-shadow: inset 0 1px 0 rgba(255,255,255,.9)` (`.card`, tous les écrans) | `getComputedStyle(.card).boxShadow` = `rgba(0, 0, 0, 0.22) 0px 1px 0px 0px inset, …` → liseré **sombre** sur le bord haut de **toutes** les cartes | moyenne | `src/design/tokens.css` : le bloc `:root` « iOS 27 » (l. 784) réécrit `--glass-rim-color: rgba(0,0,0,.22)` et écrase la valeur blanche de la l. 529. Remettre `rgba(255,255,255,.85)` en clair, garder `.55` en sombre | recapture 4 écrans, `getComputedStyle(.card).boxShadow` doit commencer par `rgba(255, 255, 255, 0.85)` |
| D-A02 | T | Bordure de carte et séparateurs : `1px / .5px solid rgba(23,43,36,.10)` (mesuré PNG `#E6E8E8`) | `--lkv-border` = `rgba(23,43,36,0.14)` (mesuré `#DDE1DF`, PNG capture 01 : `(221,225,223)`) ; `.row` en `1px` et non `.5px` | basse | `crm.module.css` `.card`, `.row`, `.sessionCard` : passer à `var(--lkv-border-subtle)` ou créer `--lkv-border-hairline: rgba(23,43,36,.10)` | recapture + échantillon pixel sur un séparateur : attendu ≈ `#E6E8E8` |
| D-A03 | T | Fond de carte `rgba(255,255,255,.88)` | `--card-tint` = `rgba(255,255,255,0.94)` (mesuré) | basse | `tokens.css` `--card-tint` : `calc(0.86 + 0.04 * …)` ou figer `.88` | recapture, fond de carte `rgba(255,255,255,0.88)` |
| D-A04 | T | En-tête : `background: rgba(255,255,255,.72)`, **sans** filtre (mesuré PNG `#FCFDFC`) | `--material-bar-bg` = `rgba(249,251,248,.72)` (mesuré `#F8FAF6`) **+** `backdrop-filter: blur(28px) saturate(1.8)` absent de la maquette | basse | `crm.module.css` `.header` : `background: rgba(255,255,255,.72)` ; retirer `backdrop-filter` ou l'assumer dans la maquette | recapture, pixel d'en-tête `#FCFDFC` |
| D-A05 | T | Titres `letter-spacing: normal` (`.brand`, h1 30 px écran 1, 26 px écrans 2-4) | `-0.022em` → mesuré `-0.66px` (h1 30 px) et `-0.572px` (h1 26 px) | basse | `tokens.css` `--lkv-tracking-title: normal` (ou `0`), ou `crm.module.css` `.title/.titleSm` : `letter-spacing: normal` | recapture, `letterSpacing` h1 = `normal` |
| D-A06 | T | Champs : `border-radius: 12px` (`select/input` de `Moderation.dc.html`, champ montant de `Remboursement.dc.html`) | `border-radius: 10px` (mesuré `#decision-reason`, `#decision-precision`, `#approval-confirmation`, `#cmd-target` etc.) | basse | `crm.module.css` `.field` : `border-radius: var(--lkv-radius-xs)` → `12px` | recapture, `borderRadius` = `12px` |
| D-A07 | T | Item de nav actif `border-radius: 12px` ; carte session `16px` (`.nav a.on`, `nav .card`) | nav actif `10px` ; carte session `14px` (mesuré) | basse | `crm.module.css` `.navItem` : `12px` ; `.sessionCard` : `16px` | recapture, `borderRadius` nav = `12px` |
| D-A08 | T | Avatar utilisateur : 2 initiales « **TF** » (en-tête des 4 maquettes) | « **T** » (1 lettre) sur les 4 écrans | basse | `src/components/shell/header-account.tsx` (ou `ui/avatar.tsx`) : dériver `prénom[0] + nom[0]` | recapture, en-tête affiche 2 lettres |
| D-A09 | T | Colonnes à 1440 : nav **261** / main **818** / rail **361** (mesuré sur les 4 `.dc.html`, bordures PNG à x=260 et x=1079) | nav **232,6** / main **887** / rail **320,3** (mesuré aux 4 écrans ; bordures PNG à x=232 et x=1120) | moyenne | `crm.module.css` `.nav{flex-basis:261px;max-width:261px}` + `.rail{flex:1 1 361px;max-width:361px}` — ou corriger d'abord le contenu du rail (D-A13/D-A21), qui fixe sa largeur intrinsèque | recapture, bordures verticales à x≈260 et x≈1079 |

> Cause racine de D-A09 : le rail est en `flex: 1 1 320px` avec croissance. Dans la maquette, son **contenu intrinsèque** (échelle des sanctions, « 2 autres commentaires… ») le pousse à 361 ; dans l'app, le contenu du rail est plus court, donc il retombe à 320 et la colonne centrale récupère 47 px. C'est ce qui déplace aussi le bloc « Aujourd'hui » (D-A12).

---

## 2. Écran 1 — « À traiter » (`/`)

| ID | Écran | Attendu (maquette, zone) | Constaté (preuve + mesure) | Grav. | Correction proposée | Fermeture |
|---|---|---|---|---|---|---|
| D-A10 | 1 | Ligne de file : **76–77 px** de haut (`.row` `min-height:56px` + `padding:10px 16px`, maquette sans reset `box-sizing` → 56 content-box + 20 ; box model rejoué : 77, PNG : 76–77) | **58 px** (`.row` mesuré 58, `box-sizing: border-box` via Tailwind preflight) → 8 lignes visibles + 145 px de vide en bas, là où la maquette déborde de l'écran | haute | `crm.module.css` `.row` : `min-height: 76px` (ou `padding: 19px 16px`) — l'écart vient de `box-sizing`, pas de la densité voulue | recapture 01 : lignes à 76 px, la 7ᵉ ligne doit être coupée par le bas de l'écran |
| D-A11 | 1 | Bandeau de groupe : **40,3 px** (strut 14 px × 1,45 = 20,3 + `padding:10px 16px`) | **36 px** (le libellé 11 px est seul dans la ligne : 16 + 20) | moyenne | `crm.module.css` `.groupHead` : `min-height: 40px` | recapture : 4 bandeaux à 40 px |
| D-A12 | 1 | Bloc « Aujourd'hui / 12 traités sur 46 » + barre : **2ᵉ ligne** du bloc titre, à gauche (x=289,2 / y=180,8, 260×31,4) | Même bloc à droite sur la même ligne que le titre (x=810,7 / y=133,4) — conséquence de D-A09 (main 887 au lieu de 818 : ça ne « wrap » plus) | moyenne | à traiter avec D-A09 ; sinon `crm.module.css` : forcer le retour à la ligne du bloc progression (`.between { flex-wrap: wrap }` + `min-width` du bloc titre) | recapture : progression sous le sous-titre, file à y≈292 |
| D-A13 | 1 | Rail : 1ʳᵉ carte = **fiche membre** (avatar 40 « RA », `@randonneur_alpin`, « Membre depuis mars 2025 », 2 encarts chiffrés, « Ouvrir la fiche complète → »), puis Règle concernée, Cas liés, Suggestion de l'IA | 1ʳᵉ carte = **carte du cas** (titre + méta + 2 pastilles + compte à rebours + « Ouvrir le cas complet → ») ; carte membre en **4ᵉ** position ; 5 cartes au lieu de 4 (texte DOM relevé 20:34) | haute | `src/components/queue/queue-screen.tsx` `QueueRail` : ordre membre → règle → cas liés → suggestion ; sortir la carte du cas du rail (la ligne sélectionnée la porte déjà) | recapture 01 : rail = 4 cartes, membre en tête |
| D-A14 | 1 | Compte à rebours en ton **warn** (`#FBF1DC` / `#765014`) : « Reste 12 min », « Reste 20 min » | ton **stone** (`#EDF1EA` / `#46584D`) — mesuré sur les 2 lignes et dans le rail | haute | `src/lib/countdown.ts` `countdownTone()` : `gris` > 5 min → la maquette veut `orange` dès qu'un délai est proche (seuil 20 % du délai total ou 15 min) | recapture 01 : pastilles ambre sur les 2 lignes de délai |
| D-A15 | 1 | Pastille « Agent IA » des lignes À valider : **stone** `#EDF1EA` | **info** `#DDE7EE` (mesuré, 2 pastilles) | moyenne | `src/components/queue/queue-list.tsx` : `Chip tone="stone"` pour le badge agent (garder `info` pour « Votre validation/décision ») | recapture : « Agent IA » en gris-vert |
| D-A16 | 1 | Onglets : « Tout · 34 », « Urgent · 4 », « Signalements · 14 », « À valider · 2 », « Contributions · 20 » | « Tout34 », « Urgent4 »… : séparateur « · » absent (texte DOM des 5 onglets) | basse | `src/components/queue/queue-screen.tsx` (tableau `tabs`) : `label: 'Tout · '` ou rendu `{label} · {count}` | recapture : 5 onglets avec « · » |
| D-A17 | 1 | Carte « Votre session » : « Cas sensibles : **3 / 10** » + « Une pause vous sera proposée à 10. » — 232×112, radius 16 | « Rôle : Super admin » + « Cas sensibles **traités** : 3 / 10 » + « Mode solo : vous validez seul, le journal le marque. » — 204×136, radius 14 | moyenne | `src/components/shell/session-card.tsx` : revenir aux 2 lignes de la maquette (le rôle est déjà dans l'en-tête) | recapture : carte ≈112 px, 3 lignes |
| D-A18 | 1 | Pied de file : 4 groupes de raccourcis (J/K, ↵, ⌘K, ?) et **rien d'autre** (`Main.dc.html` l. 151) | Capture 01 : pied présent **+ compteur « 8 éléments affichés »** (absent de la maquette). Relevé 20:44 : le pied a **disparu** — ni « naviguer » ni « éléments affichés » dans `body.innerText` | moyenne | `queue-screen.tsx` : rétablir le pied au format maquette (4 groupes, sans compteur) | recapture 01 : pied visible, 0 compteur |

---

## 3. Écran 2 — carte de décision (`/cas/post_report/…`)

| ID | Écran | Attendu (maquette, zone) | Constaté (preuve + mesure) | Grav. | Correction proposée | Fermeture |
|---|---|---|---|---|---|---|
| D-A19 | 2 | Nav : « **Confiance 14** » surligné `#D3EBD9` (`.nav a.on`) | **Aucun** item actif : `navItemOn` absent du DOM ; pixel à y=198 = `#F5F7F3` (capture 02) | haute | `src/components/shell/nav-poles.tsx` : `poleFromPath` n'a ni `/cas` ni `/valider`. Ajouter `'/cas': 'CONF'`, `'/valider': 'COMM'` (idéalement dériver le pôle du cas côté serveur) | recapture 02 : « Confiance » surligné ; `aria-current="page"` |
| D-A20 | 2 | Rail, ordre : membre → Historique de modération → **Cas liés** → Votre session | membre → Historique → **Votre session** → Cas liés (texte DOM) | basse | `cas/[source]/[id]/page.tsx` : inverser les deux dernières cartes | recapture : ordre conforme |
| D-A21 | 2 | Carte membre : avatar 40, « Membre depuis **mars 2025 · 41 publications** », **pas** d'encarts chiffrés | « Membre depuis mars 2025 » (OK) + 2 encarts « Signalements reçus 4 en 90 jours » / « Avertissements actifs 1 » ; « 41 publications » absent | moyenne | `cas/[source]/[id]/page.tsx` : ajouter `publications` à la ligne méta, retirer les encarts (ou les déplacer dans la fiche membre) | recapture : 1 ligne de méta, 0 encart |
| D-A22 | 2 | Faits, colonne QUOI : « **Commentaire sous un carnet** » + « « Traversée du GR20 en 9 jours » » | « **commentaire** » (type brut, minuscule) + « Commentaire sous le carnet « GR20 — les 16 jours » » | moyenne | `cas/[source]/[id]/page.tsx` : libellé métier par type (`commentaire` → « Commentaire sous un carnet ») | recapture : valeur en français capitalisé |
| D-A23 | 2 | Faits, colonne QUI : « 1 avertissement **actif** » | « 1 avertissement**(s)** actif**(s)** » (pluriel technique) | moyenne | helper de pluralisation (`src/lib/pluralize.ts` ou équivalent) : `1 avertissement actif` / `2 avertissements actifs` | recapture : pas de « (s) » à l'écran |
| D-A24 | 2 | Libellé de champ : « Motif (obligatoire) » | « Motif (obligatoire) **\*** » | basse | `src/components/case/decision-card.tsx` : retirer l'astérisque (l'obligation est déjà écrite) | recapture : libellé sans « * » |
| D-A25 | 2 | Aucune aide sous les 2 champs | 2 lignes ajoutées : « Il part dans le journal et dans le message au membre. » / « Une phrase simple, sans jargon. » | basse | `decision-card.tsx` : supprimer ou ajouter à la maquette (choix produit) | recapture : carte décision ≈ 346 px de haut |
| D-A26 | 2 | Aucune ligne d'aide clavier | « Les actions marquées **M L S** s'exécutent au clavier. Une annulation reste possible 10 secondes. » | basse | idem D-A25 | recapture |
| D-A27 | 2 | Bloc IA : pastille **stone** « Agent Trieur » + titre 13,5 + aide 12,5 + bouton « **Pourquoi ?** » 36 px | « AGENT TRIEUR » rendu en **label capitales** (pas de pastille), pas de bouton « Pourquoi ? » (texte DOM + capture 02) | moyenne | `cas/[source]/[id]/page.tsx` : `<Chip tone="stone">Agent Trieur</Chip>` + bouton « Pourquoi ? » | recapture : pastille + bouton présents |
| D-A28 | 2 | Boutons de navigation de cas : `.btn` 14 px | 13 px (mesuré : « Cas précédent » et « Suivant » en `font-size: 13px`) | basse | `crm.module.css` `.btnSm` (utilisé ici) : `font-size: 14px` ou nouvelle variante 36 px/14 px | recapture : 14 px |
| D-A29 | 2 | Select « Motif » avec valeur visible « Harcèlement ou insulte » | « Choisir un motif… » (aucune valeur présélectionnée) | basse | à confirmer : probablement **volontaire** (pas de motif préchoisi sur une sanction). Sinon `decision-card.tsx` : `defaultValue` | décision produit, pas de recapture |
| D-A30 | 2 | Aide du média : « Survolez-la pour la voir nette. Ce réglage protège votre attention sur les cas difficiles. » | « Survolez-la pour la voir nette. Ce réglage protège votre attention sur les cas difficiles. **Au clavier, tabulez jusqu'à l'image : elle se révèle au focus.** » | basse | `src/ui/blurred-media.tsx` : déplacer la phrase clavier dans le texte d'aide (les 2 phrases de la maquette sont déjà là ; c'est un ajout, à valider) | recapture |

---

## 4. Écran 3 — fiche membre (`/membres/…`)

| ID | Écran | Attendu (maquette, zone) | Constaté (preuve + mesure) | Grav. | Correction proposée | Fermeture |
|---|---|---|---|---|---|---|
| D-A31 | 3 | Carte « Activité » = **fil chronologique** : groupes À venir / Novembre 2026 / Octobre 2026, 6 événements (icône carrée 30 px, titre + méta, date à droite, `min-height:48px`), bouton « Afficher les 38 événements plus anciens » | Grille de **6 compteurs** (Publications 18, Commentaires 141, Carnets 4, Commandes 2, Signalements reçus 4, Dernière activité) puis carte « **Fil d'activité détaillé : non renseigné** » avec « `admin.member_360` expose les compteurs, pas les événements… » | critique | `src/app/(app)/membres/[id]/page.tsx` + `src/components/member/member-record.tsx` : brancher la RPC d'événements et rendre la timeline ; sortir le jargon RPC de l'écran | recapture 06 : timeline groupée visible, aucun backtick à l'écran |
| D-A32 | 3 | Panneau COMPTE : Pseudo public · **Visibilité du profil (Public)** · **Double authentification (Non activée)** · **Consentement e-mails (Refusé)** · Documents d'identité (1 document + bouton « Ouvrir avec motif ») | Pseudo public · **Score de confiance 42/100** · **Palier de fidélité Sage** · **Dernière activité il y a 1 h** · Documents d'identité (aucun compte, aucun bouton) | haute | `member-record.tsx` : réintroduire visibilité / 2FA / consentement (données de compte utiles au support) ; rendre le nombre de documents + « Ouvrir avec motif » | recapture 06 : 5 lignes de compte conformes |
| D-A33 | 3 | Barre d'onglets : **une seule ligne** de 44 px, 5 onglets dont « Accès à cette fiche » en 5ᵉ, « **Voyages · 3** » | **2 lignes** (conteneur mesuré **562 × 84**), « Accès à cette fiche » relégué en 2ᵉ ligne, onglet « **Notes · 2** » | haute | `crm.module.css` `.tablist` : `width: fit-content` + `align-self: flex-start` (la maquette l'inline) ; `membres/[id]/page.tsx` : onglet « Voyages · 3 » | recapture : tablist 44 px de haut, 1 ligne |
| D-A34 | 3 | En-tête : « Écrire au membre » (soft), « Déconnecter partout » (soft), « Suspendre… » (**bad**, 1 seul rouge), « … » | « Suspendre (date de fin) » (rouge), « Bannir (connexion refusée) » (rouge), « Forcer la déconnexion partout » (blanc), « … » → « Écrire au membre » absent, 2 boutons rouges | moyenne | `member-record.tsx` : ajouter « Écrire au membre », ramener 1 seul ton danger (« Suspendre… »), « Bannir » dans le menu « … » | recapture : 4 boutons, 1 rouge |
| D-A35 | 3 | Chips : Compte actif → **1 avertissement actif · expire le 28 oct. 2027** → **Membre depuis mars 2025** | Compte actif → **Membre depuis 2025-03-04** (ISO) → **1 avertissement(s) actif(s)** ; pas d'expiration | moyenne | `member-record.tsx` : ordre maquette, date `mars 2025` (helper de date), singularisation (cf. D-A23), champ d'expiration | recapture : 3 chips dans l'ordre |
| D-A36 | 3 | Rail : 4 cartes (Confiance, Commandes, Support, Appareils et sessions), **sans titre de rail** | **5 cartes** : titre « CONTEXTE » + Confiance + Commandes + Support + Appareils + **« RAPPEL — Un agent ne valide jamais une sanction… »** ; Commandes/Support/Appareils en « non renseigné » | moyenne | `membres/[id]/page.tsx` : retirer le titre et la carte Rappel ; brancher les 3 RPC manquantes (commandes, tickets, sessions) | recapture : 4 cartes, 0 « non renseigné » |
| D-A37 | 3 | Barre de score : 8 px, remplissage **`#C89A3B`** (ambre) à 42 % | 8 px ✓, remplissage **`#5B7F55`** (sauge) à 62 % (mesuré 152/245) | moyenne | `member-record.tsx` / `crm.module.css` `.progressFillWarn` : couleur sémantique ambre pour le score de confiance | recapture : barre ambre |
| D-A38 | 3 | Bouton « Afficher » des coordonnées : `min-height:32px`, `padding:0 10px`, `font-size:12.5px` | 36 px / 13 px (mesuré 101 × 36) | basse | `crm.module.css` : variante `.btnXs { min-height:32px; padding:0 10px; font-size:12.5px }` | recapture : boutons 32 px |
| D-A39 | 3 | Clic « Afficher » → valeur révélée, mention « Chaque affichage est inscrit au journal. » | Le clic ouvre un champ « **Motif de l'affichage \*** » + bouton « Afficher et journaliser » ; la valeur reste masquée (capture 07) et le « Afficher » du téléphone disparaît | moyenne | à arbitrer : durcissement probable (motif obligatoire). Si conservé, le porter dans la maquette ; sinon `member-record.tsx` : révélation directe journalisée | décision produit puis recapture 07 |
| D-A40 | 3 | E-mail masqué « r••••@••••.fr » (domaine masqué) | « to•••@proton.me » : 2 lettres + **domaine en clair** ; téléphone « +33 6 •• •• •• 42 » | moyenne | `member-record.tsx` (helper de masquage) : masquer aussi le domaine sauf le TLD | recapture 06 : domaine masqué |
| D-A41 | 3 | Avatar 64 px, `font-size:22px`, `font-weight:800` | 64 px ✓, `21px`, `700` (mesuré) | basse | `ui/avatar.tsx` : `size=64` → 22 px / 800 | recapture |

---

## 5. Écran 4 — validation de remboursement (`/valider/…`)

| ID | Écran | Attendu (maquette, zone) | Constaté (preuve + mesure) | Grav. | Correction proposée | Fermeture |
|---|---|---|---|---|---|---|
| D-A42 | 4 | Récapitulatif : **10 lignes** libellées — Commande `LKDV-10482` · Membre `@claire.vercors · 3 commandes` (lien) · Paiement d'origine `pi_3Q…8Fh2 · carte Visa •• 4417` · **Payé 129,80 €** · **Déjà remboursé 0,00 €** · **Encore remboursable 129,80 €** · Montant demandé (ligne mise en avant) · **Motif** · **Pièces** · Préparé par | 4 lignes génériques (Cible / Commande liée / Demandé par / Expire) + « Montant demandé » + **4 lignes en clés techniques** (`order_id`, `reason_code`, `payment_intent`, `Empreinte`) : Payé, Déjà remboursé, Encore remboursable, Motif et Pièces sont **absents** | critique | `src/app/(app)/valider/[id]/page.tsx` + `src/components/approval/approval-panel.tsx` : table de libellés métier, remonter les 3 montants et le motif depuis la commande, replier les clés techniques derrière un détail | recapture 09 : 0 clé snake_case à l'écran, montants présents |
| D-A43 | 4 | Rail : « **Contexte de la commande** » → **Articles** (2 lignes avec prix) → **Risque** (2 faits + pastille « Risque faible ») → **Ce qui se passera** (3 étapes) | « **Contexte de la demande** » → Commande (« Rembourser (Stripe) — `**tout montant**` », `order_refund`, pastilles) → Risque (3 phrases dont « non renseignés sur cet écran ») → Empreinte (sha256) ; **« Ce qui se passera » déplacé dans la colonne principale** | haute | `valider/[id]/page.tsx` : rail = articles + risque chiffré + étapes ; l'intitulé suit l'objet (commande) | recapture 09 : 3 cartes conformes |
| D-A44 | 4 | Aucune ligne « Expire » ; l'action proposée est cohérente avec l'échéance | Ligne « **Expire — à l'instant** » alors que « Valider et rembourser 89,00 € » est **actif** (`disabled: false`, relevé 20:34) | haute | `valider/[id]/page.tsx` : soit l'échéance est future, soit l'action est désactivée avec un motif visible. Aujourd'hui l'écran dit « expiré » et propose l'irréversible | recapture : cohérence échéance/bouton |
| D-A45 | 4 | Champ de confirmation : `max-width:320px`, radius 12, **bordure `1.5px solid #226148`**, mono 600 18 px | **789 px** de large (aucun `max-width`), radius 10, bordure `1px rgba(23,43,36,.22)` (mesuré) | moyenne | `approval-panel.tsx` : `max-width:320px`, `border-radius:12px`, bordure d'accent à la saisie ; `crm.module.css` `.field` (radius 12, cf. D-A06) | recapture 10 : champ ≈320 px, bordure verte |
| D-A46 | 4 | Boutons : `Valider et rembourser` (**pg**) → `Renvoyer à l'agent avec une question` (soft) → `Refuser` (**bad**) | `Valider et rembourser` (**pg**) → `Refuser` (soft) → `Renvoyer…` (soft) : ordre inversé et « Refuser » a perdu son ton danger | moyenne | `approval-panel.tsx` : ordre pg/soft/bad et `tone="bad"` sur Refuser | recapture : 3 boutons, dernier rouge |
| D-A47 | 4 | 1 seul bandeau : « Mode solo » (ambre, 72 px, icône ⓘ, « **Mode solo :** » gras inline) | 2 bandeaux : ambre « **MODE SOLO** » (label capitales, 89 px) **+ rouge** « DEMANDE QUE VOUS AVEZ PRÉPARÉE » (70 px), non prévu | moyenne | `approval-panel.tsx` : garder le bandeau ambre au format maquette ; transformer le 2ᵉ en note discrète (ou l'ajouter à la maquette) | recapture : 1 bandeau |
| D-A48 | 4 | Fil d'Ariane : « À traiter › **Commerce** › À valider » | « À traiter › **COMM** › À valider » (code de pôle brut) | moyenne | `src/app/(app)/valider/[id]/page.tsx:83` : `POLE_LABELS[definition.pole]` au lieu de `definition.pole` | recapture : « Commerce » |
| D-A49 | 4 | Rails et libellés en français lisible | « Rembourser (Stripe) — `**tout montant**` » : markdown non converti, astérisques affichées | basse | `approval-panel.tsx` / source de la ligne : retirer le markdown (`tout montant` en italique si voulu) | recapture : plus d'astérisques |
| D-A50 | 4 | 3ᵉ étape : « **Exécuté sur Stripe** » | « Exécuté » | basse | `approval-panel.tsx` (stepper) | recapture |
| D-A51 | 4 | Bandeau « Mode solo » : `padding:14px 16px`, 13,5 px, « Mode solo : » en gras inline | Label capitales « MODE SOLO » + paragraphe, hauteur 89 px | basse | `approval-panel.tsx` : structure maquette (cf. D-A47) | recapture |
| D-A52 | 4 | À 1040 px, les 3 boutons de décision sont **visibles** (maquette : y=979, section jusqu'à 1044) | Boutons à **y=1126** (mesuré) : aucune capture ne les montre ; contenu jusqu'à y≈1364 | moyenne | condensers D-A47/D-A42 (≈120 px) ou remonter la carte de validation au-dessus du récapitulatif | recapture 09 : boutons visibles sans défilement |
| D-A53 | 4 | « Tapez le montant pour confirmer » | « Tapez le montant : **89,90 €** * » (montant dans le libellé + astérisque) | basse | `approval-panel.tsx` : libellé maquette | recapture |

---

## 6. Tiroirs (états 05 et 08)

| ID | Écran | Attendu | Constaté (preuve + mesure) | Grav. | Correction proposée | Fermeture |
|---|---|---|---|---|---|---|
| D-A54 | D | Champs de formulaire : radius 12 px (cf. D-A06) | Champs du tiroir : `44px` de haut ✓, `border-radius: 10px` ; date « Jusqu'au » affiche « **mm/dd/yyyy** » (locale en-US) | basse | `src/components/command/command-drawer.tsx` : radius 12 ; forcer le format français du champ date (texte d'aide ou `lang="fr-FR"`) | recapture 08 : `jj/mm/aaaa` |

Conforme et vérifié, pour mémoire : le voile du tiroir existe bien (`rgba(16,28,23,.45)`, plein écran, z=500) sur les états 05 **et** 08 (pixel nav `(142,149,143)` vs `(245,247,243)` hors tiroir) ; panneau `x=920`, largeur **520 px**, bord gauche 1 px ; en-tête titre 20 px/800 + 4 pastilles ; boutons de pied 44 px radius 14 ; « Échap ferme » présent.

---

## 7. Non jugeable / angles morts

- **Tiroirs et menus n'ont pas de maquette** (05, 08, menu « Autres actions » de 04). Ils sont jugés sur la cohérence interne (radius, hauteurs, tons) et non sur une référence : aucun écart de structure n'est donc imputable.
- **Boutons de décision de l'écran 4** : jamais visibles dans les captures (sous la ligne de flottaison), donc non comparés visuellement — seul le DOM a été mesuré.
- **La maquette est incohérente entre écrans** : `Main` et `Membre` ont le bandeau « Mode solo · vous validez seul » + « Temps réel connecté » + cloche + nom ; `Moderation` et `Remboursement` n'ont que « Mode solo » + avatar. L'app suit `Main` partout. Ce n'est **pas** compté comme écart (la référence se contredit) — à trancher dans la maquette.
- **Nav** : `Réglages` est présent dans l'app et absent des maquettes `Moderation`/`Membre`/`Remboursement` (présent dans `Main`). Même remarque.
- **Artefact de prévisualisation** : la pastille Next.js `#devtools-indicator` (36 × 36, `z-index: 2147483647`) et son compteur « 1 Issue » masquent le bas de la carte session dans toutes les captures. Ce n'est pas un élément du CRM : à exclure du jugement et à masquer pour les prochaines preuves (`devIndicators: false`).
- **Dérive du workspace** : trois états observés en 20 min (voir §0). Les écarts marqués `fermé depuis la capture` doivent être revérifiés avant d'être considérés comme définitifs.

---

## 8. Mesures

### 8.1 Colonnes à 1440 (bordure gauche du nav / du main / du rail, en px CSS)

| Écran | Maquette (nav / main / rail) | App (nav / main / rail) | Écart |
|---|---|---|---|
| 1 `/` | 261,2 / 817,6 / 361,2 | 232,6 / 887,0 / 320,3 | −28,6 / +69,4 / −40,9 |
| 2 `/cas` | 261,0 / 818,0 / 361,0 | 232,6 / 887,0 / 320,3 | −28,4 / +69,0 / −40,7 |
| 3 `/membres` | 260 / aside 310 / centre 549 / rail 321 | 232,6 / aside 276,9 / centre 610,4 / rail 320,3 | −27,4 / −33,1 / +61,4 / −0,7 |
| 4 `/valider` | 260 / 838 / 341 | 232,6 / 887,0 / 320,3 | −27,4 / +49,0 / −20,7 |

### 8.2 Hauteurs mesurées

| Élément | Maquette | App | Écart |
|---|---|---|---|
| En-tête | 73 | 73 | 0 |
| Ligne de file `.row` | **76–77** | **58** | −18,5 |
| Bandeau de groupe | **40,3** | **36** | −4,3 |
| Onglets (conteneur) | 44 | 44 | 0 |
| Tablist `/membres` | 44 (1 ligne) | **84** (2 lignes) | +40 |
| Item de nav | 40 | 40 | 0 |
| Carte session | 111,6 | 136,4 | +24,8 |
| Champ de formulaire | 44 (48 pour le montant) | 44 / 48 | 0 |
| Bouton standard | 44 | 44 | 0 |
| Bouton compact (« Cas précédent », « Afficher ») | 36 (32 pour « Afficher » fiche) | 36 | 0 / +4 |
| Bouton tiroir | — | 44 | — |
| Carte récap `/valider` | **481** (10 lignes) | 506 (4 lignes + 4 clés techniques) | +25 |
| Boutons de décision `/valider` | y=**979** (visibles) | y=**1126** (hors écran) | +147 |

### 8.3 Couleurs (valeurs calculées ou échantillonnées)

| Rôle | Maquette | App | Source |
|---|---|---|---|
| Liseré haut de carte | `rgba(255,255,255,.9)` | `rgba(0,0,0,.22)` | `getComputedStyle` `.card` |
| Bordure de carte | `rgba(23,43,36,.10)` | `rgba(23,43,36,.14)` | token + pixel `#DDE1DF` |
| Séparateur de ligne | `.5px rgba(23,43,36,.10)` | `1px rgba(23,43,36,.14)` | pixel `#E6E8E8` vs `#DDE1DF` |
| Fond de carte | `rgba(255,255,255,.88)` | `rgba(255,255,255,.94)` | token `--card-tint` |
| Fond d'en-tête | `rgba(255,255,255,.72)` | `rgba(249,251,248,.72)` + blur 28 | pixel `#FCFDFC` vs `#F8FAF6` |
| Pastille compte à rebours | `#FBF1DC` / `#765014` | `#EDF1EA` / `#46584D` | `countdownTone()` |
| Pastille « Agent IA » | `#EDF1EA` | `#DDE7EE` | `queue-list.tsx` |
| Barre de score de confiance | `#C89A3B` | `#5B7F55` | `member-record.tsx` |
| Bandeaux de groupe (urgence / délai / neutre) | `#FDE8E6` `#FBF1DC` `#EDF1EA` | identiques ✓ | mesuré |
| Pastilles « Compte actif » / « Mode solo » | `#D8E5D5` `#FBF1DC` | identiques ✓ | mesuré |
| Voile de tiroir | — | `rgba(16,28,23,.45)` | mesuré |

### 8.4 Typographie

| Élément | Maquette | App |
|---|---|---|
| h1 écran 1 | 30 px / 800 / `normal` | 30 px / 800 / **−0,66 px** |
| h1 écrans 2-4 | 26 px / 800 / `normal` | 26 px / 800 / **−0,572 px** |
| Label (`.label`) | 11 px / 600 / `letter-spacing 1,1 px` / uppercase | identique ✓ (mesuré 1,1 px) |
| Bouton standard | 14 px / 600 | 14 px / 600 ✓ |
| Bouton compact `/cas` | 14 px / 600 | **13 px** / 600 |
| Sous-titre de ligne de file | 12,5 px | 12,5 px ✓ |
| Source / empreinte | `IBM Plex Mono` | `IBM Plex Mono` ✓ |

### 8.5 Cause racine de la densité (à lire avant D-A10/D-A11)

La maquette n'a **aucun reset `box-sizing`** : ses `min-height:56px` s'appliquent au *contenu*, d'où 56 + 20 de padding = 76 px de ligne et 20,3 + 20 = 40,3 px de bandeau. L'app charge Tailwind preflight (`* { box-sizing: border-box }`) : les mêmes déclarations donnent 58 px et 36 px, car le contenu (38 px) dépasse le plancher de 56. Ce n'est donc pas un réglage de densité « voulu » mais un **effet de reset** ; pour retrouver la maquette il faut écrire les hauteurs explicitement (76 px / 40 px), pas retirer le reset.

---

## 9. Résumé (≤ 12 lignes)

1. **54 écarts** relevés : **2 critiques**, **8 hautes**, **22 moyennes**, **22 basses** — sur 4 écrans, 2 tiroirs et 1 transversal.
2. Les 5 plus visibles : (1) écran 3, le **fil d'activité n'existe pas** — 6 compteurs et « non renseigné » avec du jargon RPC remplacent la timeline ; (2) écran 4, le **récapitulatif parle en `order_id` / `reason_code`** et a perdu Payé, Déjà remboursé, Encore remboursable, Motif, Pièces ; (3) écran 1, les **lignes de file font 58 px au lieu de 76** (cause : `box-sizing`), d'où une page qui respire au lieu de déborder ; (4) écran 1, le **rail commence par le cas** et non par la fiche membre ; (5) partout, un **liseré noir de 1 px** en haut des cartes (`--glass-rim-color` écrasé à `rgba(0,0,0,.22)`, `tokens.css` l. 784).
3. Détails récurrents : comptes à rebours stone au lieu d'ambre (seuil `countdownTone`), « Agent IA » bleu au lieu de gris-vert, onglets sans « · », champs à 10 px au lieu de 12, boutons de nav de cas à 13 px au lieu de 14, avatar à 1 initiale au lieu de 2, bordure `.14` au lieu de `.10`, pied de raccourcis de l'écran 1 disparu (présent sur la capture 01).
4. Écran 2 : **aucun item de nav actif** (`/cas` et `/valider` absents de `poleFromPath`) ; `/membres` est correct depuis 20:34.
5. Écran 3 : **onglets sur 2 lignes** (562×84 au lieu de 44), panneau COMPTE amputé (visibilité, 2FA, consentement), rail avec une 5ᵉ carte « Rappel ».
6. Écran 4 : **« Expire — à l'instant » avec un bouton « Valider » actif** — à trancher avant toute recette, c'est le seul point qui touche l'irréversible.
7. Colonnes : nav 233/261, main 887/818, rail 320/361 → le bloc « Aujourd'hui » glisse à droite et tout remonte de 47 px.
8. **Avertissement de méthode** : le workspace a été édité pendant la revue (mtime 20:16-20:17 > captures 20:18) ; 3 constats issus d'images réduites se sont révélés faux en live et ont été retirés (tons des boutons, bloc média, titre en minuscules).
9. Les captures 02 et 05 viennent de builds différents ; la pastille Next.js « 1 Issue » masque le bas de la carte session sur toutes les captures ; les tiroirs et menus n'ont pas de maquette (non jugeables en fidélité).
10. Rien n'a été modifié hors ce fichier ; aucun build, aucun commit ; captures de travail écrites dans `/tmp` uniquement.
11. **Preuve de fermeture** : recapture `01…10` à 1440×1040 dans le même état, plus les valeurs `getComputedStyle` listées en §8 ; un écart n'est fermé que si la même mesure change.
