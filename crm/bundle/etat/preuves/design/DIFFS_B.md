# DIFFS_B — parité visuelle : écrans 5–8, tiroirs, écrans publics

- **Base mesurée** : `http://127.0.0.1:4200` (Next 15.5.25, aperçu design), 1440×1040 et 390×844.
- **Référence** : `crm/bundle/etat/preuves/reference/maquette/` — `Agents-1440.png`, `Journal-1440.png`, `Commande-1440.png`, `SOS-390.png`.
- **Constaté** : `crm/bundle/etat/preuves/design/` (captures régénérées à 20:27) + mesures Playwright (`getBoundingClientRect`, `getComputedStyle`) + pixels (PIL).
- **Aucun code modifié, aucun build, aucun commit.** Ce fichier est le seul écrit.

## Périmètre et limites (à lire avant les écarts)

1. **4 maquettes seulement** : Équipe (5), Journal (6), Commande/palette ⌘K (7), SOS (8). Il n'existe **aucune maquette** du tiroir de commande ni des écrans publics. Pour ces zones, l'attendu est la **grammaire de la maquette** + `crm/bundle/05_UI_UX_DESIGN.md` + `DESIGN_SYSTEM.md` ; les lignes concernées le précisent.
2. Les tiroirs 05 et 08 (modération, membre) sont du périmètre A. Ici : le tiroir **générique** de commande (capture 15).
3. Captures 1–10 hors périmètre (A) ; 16–25 = périmètre B (SOS, auth, publics).
4. L'aperçu a été reconstruit pendant la revue (captures 20:27) : les **données vivantes** changent d'une capture à l'autre (ex. carte session « 3 / 10 »), pas la géométrie ni les styles cités.
5. Les positions de la maquette sont mesurées au pixel (PIL) ; les tailles de police ne sont citées que lorsqu'elles sont mesurées dans le DOM réel.

## Verdict

- **Bloquants (4)** : `D-B21` palette sans voile (modale non modale), `D-B27` tiroir 520×72 (formulaire coupé), `D-B30` SOS sous la coque (112 à 774 px), `D-B36` `/pole/CONF` en erreur (écran non livré).
- **Majeurs (13)** : statuts d'agents, outils en ids, descriptions de périmètre, journal en ids/JSON, export mort, palette catalogue, sous-titres sans contexte, aperçu message absent, débordement mobile, cibles < 44 px, SOS non partageable, catalogue, contacts.
- **Moyens (16)** et **mineurs (9)** : détail ci-dessous.

---

## 1. Coque commune (tous les écrans CRM)

| ID | Attendu (maquette) | Constaté (capture + mesure) | Gravité | Correction proposée | Preuve de fermeture |
|---|---|---|---|---|---|
| **D-B01** | Navigation 260 px (bord x=261), contenu à x=291 | Nav **232,6 px**, contenu à **x=260,6** → tout l'écran est décalé de ≈ 29 px et élargi (`11/13/21/23/24/25`) | Moyen | `src/ui/crm.module.css` : `.nav { flex: 0 0 260px; max-width: 260px }`, `.main { padding: 24px 30px }` (media ≥900) | M : `nav.width = 260 ±1`, premier enfant de `main` à `x = 291 ±1` ; recapture 11 |
| **D-B02** | Barre de recherche **241→831 = 590 px**, sans loupe | **240→800 = 560 px**, loupe `IconSearch` dans le champ | Mineur | `crm.module.css` `.searchBtn { max-width: 590px }` ; `command/command-bar.tsx` retirer `IconSearch` (ou acter l'écart) | M : `searchBtn.width = 590` ; capture 11 |
| **D-B03** | À droite : pastille « Mode solo » (76 px) + avatar **TF 36 px** uniquement | Pastille 183 px, + « Temps réel connecté », + cloche 44 px, + nom/rôle, avatar **T 36 px** (`11` et tous) | Moyen (fidélité à arbitrer) | `shell/app-shell.tsx` `headerRight` : masquer les 3 ajouts ou les documenter dans `visuel/RAPPORT-DIFFERENCES.md` (le bundle §2 les prévoit → arbitrage Tony) | Décision écrite + capture 11 |
| **D-B04** | Pilotage = Équipe (compteur 6) + Journal ; pas de carte session dans la nav | + **Réglages**, + carte **VOTRE SESSION**, compteur **6 absent** sur Équipe | Moyen | `shell/nav-poles.tsx` : ajouter `count` à l'item Équipe ; sortir `SessionCard` de la nav ou l'ajouter à la maquette | M : `Équipe et agents IA` contient « 6 » ; capture 11 |
| **D-B05** | Titres dans la police de marque (Manrope, cf. `tokens.css` `--font-brand`) | **Aucun `@font-face` Manrope** dans le CSS servi (0 occurrence) : le titre tombe sur `system-ui` (canvas : `Manrope` = famille inconnue, 235,7 px = famille bidon) ; métriques 31 px / 245 px vs 35 px / 239 px dans la maquette. Écart déjà déclaré (G3, polices système) mais non acté dans les jetons | Mineur | Charger Manrope (`next/font` ou `@font-face` dans `globals.css`) **ou** remplacer `--font-brand` par la pile système et acter G3 | M : `document.fonts` contient Manrope, ou jeton aligné ; captures 11/13 |

## 2. Équipe et agents IA (capture 11, état d'arrêt 12)

| ID | Attendu | Constaté | Gravité | Correction | Fermeture |
|---|---|---|---|---|---|
| **D-B06** | 6 agents « Actif » ; le Surveillant porte « Signale un pic » (ambre) | **5 actifs** ; Résumeur **« En pause »** ; Surveillant **« Actif »** ; le statut « pic » n'existe pas (`STATUS` = active/paused/stopped) | Majeur | `agents/agents-board.tsx` `STATUS` + contrat `admin.agents_overview` : exposer `alert`/`pic` et le rendre | M : 6 pastilles attendues, dont 1 « Signale un pic » ; capture 11 |
| **D-B07** | « Outils : lire un signalement, proposer un motif, préparer un message. » | **ids bruts** : `post_hide, comment_hide, story_moderate.` (`join(', ')`) | Majeur | `agents-board.tsx` : table `TOOL_LABELS` (libellés métier) + repli id ; source `crm/src/lib/` | M : aucun `_` visible dans les 6 cartes ; capture 11 |
| **D-B08** | Une phrase de périmètre par agent (« Ne sanctionne jamais. », « Aucun accès à Stripe. », « Lecture seule… ») | **absentes** : seule la ligne d'outils subsiste | Majeur (confiance/sécurité) | `agents-board.tsx` : rendre `agent.description` (à ajouter au contrat agent) sous les outils | M : 6 phrases visibles ; capture 11 |
| **D-B09** | « 10 décisions … · 4 faites » + barre de progression ~30 % | « non renseigné sur cet écran », **aucune barre** | Moyen | `agents-board.tsx` section Relecture : `review_total/review_done` + `<progress>` (jetons) | M : barre présente + « x / y » ; capture 11 |
| **D-B10** | Arrêt = action nommée, avec sortie | « **Confirmer** » (89 px) remplace « Arrêter », **sans nom d'agent ni annulation** | Moyen (sûreté) | `agents-board.tsx` : `Arrêter {agent.name}` + bouton `Annuler` (`setConfirmStop(null)`) | M : libellé contient le nom + 2 boutons ; capture 12 |
| **D-B11** | Boutons de carte ~44 px, « Arrêter » sans glyphe | **36 px** ; glyphe **■ noir** devant « Arrêter » ; bouton « Droits et outils » 235 px | Moyen (cible < 44) | `crm.module.css` `.btnSm { min-height: 44px }` ; `agents-board.tsx` retirer `IconStop` ou icône sobre | M : `button.height = 44` ; captures 11/12 |
| **D-B12** | Tuile 34 px fond #DEE4DB, robot arrondi | **38 px**, fond **#EDF1EA**, robot carré | Mineur | `crm.module.css` `.agentAv { width:34px;height:34px;background:var(--sage-100) }` | M : 34 px + couleur token ; capture 11 |
| **D-B13** | « Super admin · tous les droits, tous les accès · clé physique active », avatar **TF** | « Super admin · tous les droits », avatar **T** | Mineur | `agents-board.tsx` : compléter le sous-titre depuis `ctx` (accès/clé) ; `Avatar` initiales | M : texte complet ; capture 11 |
| **D-B14** | Rien après les outils | « **Dernière erreur : NVIDIA indisponible (503)** » en rouge | Mineur (ajout utile) | Acter dans `RAPPORT-DIFFERENCES.md` + lien vers `/technique` | Décision écrite |

## 3. Journal d'audit (capture 13)

| ID | Attendu | Constaté | Gravité | Correction | Fermeture |
|---|---|---|---|---|---|
| **D-B15** | Libellés de filtres **11 px MAJUSCULES, 0,1 em** | **13 px semi-gras**, casse phrase (« Période ») | Moyen | `audit/audit-table.tsx` : label `s.label` au-dessus des `Select` (au lieu de `Field label`) | M : `font-size 11`, `letter-spacing 1.1`, `uppercase` ; capture 13 |
| **D-B16** | 3 filtres + pastilles | **4e champ « Rechercher »** (192 px) ajouté | Mineur | Retirer, ou l'ajouter à la maquette (à arbitrer) | Décision + capture 13 |
| **D-B17** | Actions en français : « Commentaire masqué », « Remboursement validé » | **ids techniques** : `comment_hide`, `order_refund`, `member_360` (gras sans-serif) | Majeur | `audit-table.tsx` : mapper `row.command` via `commandDefinition(...).label`, repli id | M : aucune valeur `_` en colonne ACTION ; capture 13 |
| **D-B18** | « visible → masqué », « 0,00 € → 54,00 € remboursés », motif « Harcèlement ou insulte » | **JSON brut** `{"moderation_state":"visible"} → {"…":"hidden"}` ; motif `harcelement`, `produit_defectueux` | Majeur | `audit-table.tsx` + helper `crm/src/lib/audit-format.ts` : phrases + libellés `reason-codes` | M : 0 `{`/`}` dans le tableau ; capture 13 |
| **D-B19** | « Exporter la période » actif | Bouton **désactivé**, opacité **0,45**, `title` « export serveur pas encore branché » | Majeur (bouton mort) | Implémenter `/api/audit/export` **ou** masquer (et retirer de la maquette) | M : bouton actif ou absent ; capture 13 |
| **D-B20** | Cible lisible « Commentaire c_8f2… » | `comment d1100000…0001` en mono ; + « Fin de la période chargée. » | Mineur | `audit-table.tsx` : libellé de type + id court ; note de fin alignée | M : cible sans préfixe machine ; capture 13 |

## 4. Palette ⌘K (capture 14, maquette `Commande-1440.png`)

| ID | Attendu | Constaté | Gravité | Correction | Fermeture |
|---|---|---|---|---|---|
| **D-B21** | Voile sur toute la page (fond 143,150,146) ; clic extérieur ferme | **Aucun voile** : `.overlay` = **1440×112** (coincé dans le `header` sticky qui a `backdrop-filter`) ; clic à (720,900) **ne ferme pas** ; seul Échap ferme | **Bloquant** | `command/command-bar.tsx` : rendre `.overlay` via `createPortal(…, document.body)` (et `ui/drawer.tsx` pour le tiroir) | M : `overlay.height = 1040`, clic extérieur ferme ; capture 14 |
| **D-B22** | Requête « rembourser 10482 » → 5 résultats contextuels, 3 sections (Actions, Membres, Récents) | **66 lignes** de registre (scroll **3432 px**) en 3 sections (Actions, Membres, Commandes) ; requête vide ; pas de section Récents | Majeur | `command-bar.tsx` : requête/`Récents` + limiter à 5–8 lignes ; `command/catalog.ts` : charger `commands_catalog` (base) sinon bandeau dégradé | M : ≤ 8 lignes visibles, section Récents présente ; capture 14 |
| **D-B23** | Icônes sémantiques : €, =, avatar CV, !, J | Texte **« ME »** (30×30) = `pole.slice(0,2)` pour toutes les actions | Moyen | `command-bar.tsx` `Row` : `icon` par domaine + `Avatar` pour les membres | M : 0 tuile « ME » ; capture 14 |
| **D-B24** | Sous-titre contextuel : « 129,80 € · @claire.vercors · livrée le 4 nov. » | « **Membres · ACT-001** » (pôle + id) | Majeur (contexte) | `command-bar.tsx` : sous-titre métier (montant, membre, date) depuis la fiche | M : 5 sous-titres sans `ACT-` ; capture 14 |
| **D-B25** | Raccourcis `↵` puis `⌘↵` ; pas de pastille sur la ligne | Toutes les lignes `↵` ; pastille **« 2 personnes »** avant le kbd | Moyen | `command-bar.tsx` : `⌘↵` sur la 1re ligne, pastille après le libellé | M : 2 raccourcis distincts ; capture 14 |
| **D-B26** | Pied : « Seules les actions autorisées… » + exemples (« suspendre @… », « masquer »…)* | « **Catalogue du registre généré (base non joignable)** » ; pas d'exemples ; panneau **640 px** (maquette **566 px**) | Moyen | `command-bar.tsx` + `.palette { max-height: 566px }` ; état dégradé en bandeau, pas dans le pied | M : mention d'autorisation + hauteur 566 ; capture 14 |

\* rangée d'exemples visible dans le bas de la maquette, chevauchant la mention (rendu ambigu) — à confirmer avant implémentation.

## 5. Tiroir / formulaire générique (capture 15)

| ID | Attendu (grammaire + §5/§8) | Constaté | Gravité | Correction | Fermeture |
|---|---|---|---|---|---|
| **D-B27** | Tiroir plein écran à droite (520×1040), voile, formulaire défilable, pied collé en bas | **scrim 1440×72**, panneau **520×72**, tête **84 px**, corps **40 px** (contenu 480 px coupé), pied à **y=124** par-dessus la page — conséquence du portail absent + `backdrop-filter` du header | **Bloquant** | `ui/drawer.tsx` : `createPortal` du `drawerScrim` dans `document.body` (le tiroir est rendu dans `<header>` via `CommandBar`) | M : `drawer.height = 1040`, pied à `y = 996..1040`, corps défile ; capture 15 |
| **D-B28** | Aperçu du message au membre + recours (§8 #16) | **Aucun aperçu** ; champs : Cible*, Précision, Note interne seulement | Majeur | `command/command-drawer.tsx` : bloc lecture seule « Message au membre » généré + lien recours | M : bloc visible + texte ; capture 15 |
| **D-B29** | Action principale en bas à droite ; sections titrées pour > 5 champs | Principal **à gauche** (« Masquer une publication »), « Annuler » à droite ; pas de sections ; libellé technique `Commande` + mono | Moyen | `command-drawer.tsx` + `.drawerFoot { justify-content: flex-end }` ; `<Fieldset>` titrés | M : ordre Annuler / Principal ; capture 15 |

## 6. SOS mobile (capture 16, maquette `SOS-390.png`)

| ID | Attendu | Constaté | Gravité | Correction | Fermeture |
|---|---|---|---|---|---|
| **D-B30** | Aucune coque : retour, badge, titre à **y=78**, carte **170–398**, 112 **399–450**, contacts **528–645**, déroulé **646–775**, note **786–810**, tout en 844 px | Coque **223 px** (logo + recherche + mode solo + cloche + compte) ; titre **y=313** ; carte **509–761** ; 112 **774–826** ; « Je prends » **838** ; contacts **966** ; déroulé **1145** ; page **1335 px** | **Bloquant** (urgence) | `src/app/(app)/sos/[id]/page.tsx` : sortir du layout `(app)` (route nue) ou `AppShell bare` ; rendre `SosScreen` pleine page | M : `header` absent, 112 à `y ≤ 460`, page = 844 ; capture 16 |
| **D-B31** | Pas de débordement horizontal | `scrollWidth = 425` pour 390 : `.searchBtn` **400,7 px** à x=24 → ⌘K hors écran ; touche **toutes les pages CRM** à 390 (mesuré sur /sos, /equipe, /journal) ; la connexion mobile (18) n'a pas de coque | Majeur | `crm.module.css` <640 px : `.header { padding: 12px 16px }`, `.searchBtn { flex-basis: 100%; max-width: 100%; min-width: 0 }` | M : `scrollWidth = 390` sur /sos, /equipe, /journal ; recapture 16 |
| **D-B32** | Contacts : nom + distance, action lisible | 2 liens « Appeler » de **20,3 px** de haut (< 44) ; pas de distance (« 2,1 km » maquette) | Majeur (a11y) | `sos/sos-screen.tsx` : classe `linkAction` (44 px) ; `contacts[].distance_m` au contrat | M : `a.height = 44`, distance affichée ; capture 16 |
| **D-B33** | Pas d'action de clôture sur l'écran public | Bouton **« Clore le SOS (après appel) »** ajouté, sans confirmation | Moyen (sûreté) | `sos-screen.tsx` : menu « … » + confirmation nommée (irréversible) | M : clôture = 2 gestes ; capture 16 |
| **D-B34** | Écran partageable (lien famille) | `/sos/[id]` **exige une session** (`middleware.ts` `PUBLIC_PATHS` sans `/sos`) et affiche la coque admin | Majeur (produit) | `middleware.ts` + route publique signée (`/sos/[id]/partage?t=…`) avec RPC `sos_public_view` borné | M : ouverture en navigation privée sans session ; capture dédiée |
| **D-B35** | 3 lignes de déroulé, pas de carte d'état | Carte **« Personne n'a pris »** ajoutée ; déroulé 2–3 lignes selon données | Mineur | Acter (utile) ou masquer derrière l'état `taken_by = null` | Décision écrite |

## 7. Écrans publics (captures 17–25)

> Aucune maquette : l'attendu est la cohérence avec la grammaire mesurée (carte, champs 44 px, un seul primaire, cibles 44 px, libellés FR).

| ID | Attendu | Constaté | Gravité | Correction | Fermeture |
|---|---|---|---|---|---|
| **D-B36** | Écran pôle livré | `/pole/CONF` = **« Impossible d'afficher cette partie »**, aucun `h1`, aucun contenu, retry seul (`22`) | **Bloquant** | `pole/[code]/page.tsx` + `pole/pole-screen.tsx` : corriger l'appel (même cause que « base non joignable ») ou servir les fixtures | M : `h1` présent, file rendue ; capture 22 |
| **D-B37** | Tableau lisible, paginé, cibles 44 px | `ACT-001` **retourne sur 2 lignes** (colonne **83,7 px**, `white-space: normal`) ; **144 lignes** sans pagination ; boutons « Ouvrir » **36 px** ; hauteurs 64,1/79 alternées (`21`) | Majeur | `catalogue/catalogue-screen.tsx` + `.table td:first-child { white-space: nowrap }` ; virtualiser/paginer ; `.btnSm` 44 px | M : réf sur 1 ligne, 1 page = 25 lignes, boutons 44 ; capture 21 |
| **D-B38** | Libellés FR, une action principale | **`paid`**, **`succeeded`**, **`EUR`**, « Statut : paid » ; **2 boutons rouges** de même poids (Rembourser / Annuler) et 1 blanc (`23`) | Moyen | `commandes/[id]/page.tsx` : mapper les statuts (paid→payée, succeeded→réussi, EUR→€) ; un seul primaire (Marquer expédiée), Annuler en danger confirmé | M : 0 anglais, 1 primaire ; capture 23 |
| **D-B39** | Une action principale, contenu clé au-dessus de la ligne de flottaison | 4 boutons de **même poids** (aucun primaire) ; carte **Runbook à y=1144** ; rail **1203 px** (`24`) | Moyen | `technique/page.tsx` : primaire « Voir les erreurs » ; remonter Runbook ou ancres | M : 1 primaire, Runbook visible en 1040 ; capture 24 |
| **D-B40** | Un seul raccourci par bouton ; progression possible | **« M M », « L L », « S S »** (label + `Kbd` en double) ; **« Cas suivant » désactivé** tant qu'aucune décision ; « 0 / 10 » sans barre (`25`) | Moyen | `training/training-screen.tsx` : retirer le `<Kbd>` du label (l. 240-246) ; `disabled={index >= 9}` ; ajouter barre | M : 1 kbd/bouton, suivant actif ; capture 25 |
| **D-B41** | Cibles ≥ 44 px, mise en page stable | Liens **15 px** de haut (« Voir la marche à suivre », « Revenir à la connexion ») ; mobile : « Vérifier un code » passe sur sa propre ligne, « Voir la marche à suivre » = **33 px** (`17`, `18`, `19`, `20`) | Moyen (a11y) | `auth/auth-card.tsx`, `app/acces-refuse/page.tsx` : classe `linkAction` (44 px) ; footer auth en colonne < 420 px | M : hauteur ≥ 44 sur les 4 écrans ; recaptures 17–20 |
| **D-B42** | Preuves hors mode dev | Badge **Next « N »** sur toutes les captures ; **« 2 Issues »** sur `22` (2 erreurs runtime dev non traitées) | Mineur (hygiène de preuve) | Régénérer sur build de production ; traiter les 2 issues | Captures sans badge + console propre |

---

## Conformités vérifiées (aucun écart)

- Fonds et surfaces identiques pixel à pixel : page **#F5F7F3**, carte **#FEFEFE**, pastille « Actif » **#D8E5D5**, pastille mode solo **#FBF1DC**.
- Palette : largeur **720 px** et centrage x=360 identiques ; grille agents 3 colonnes ; th journal **11 px / 1,1 px / uppercase** identiques ; 112 **#A8443A** identique ; boutons SOS **52 px**.
- Contrastes AA mesurés (texte/fond) : **5,64 à 14,92** sur 11 paires (pastilles warn/sage/info/danger, bouton pg, texte muted, blanc sur rouge) — **aucun échec**.

## Ordre de fermeture conseillé

1. `D-B21`, `D-B27` (portail) — 1 fichier CSS + 2 composants ; débloque la revue des captures 14/15.
2. `D-B30`, `D-B31` (SOS nu + header mobile) ; `D-B34` (partage) à décider.
3. `D-B36` (pôle), puis `D-B06`–`D-B08` (contrat agent), `D-B17`–`D-B19` (journal).
4. `D-B22`–`D-B24` (palette contextuelle, dépend de la base joignable).
5. Reste : cosmétique et cibles 44 px (`D-B11`, `D-B32`, `D-B37`, `D-B41`).
