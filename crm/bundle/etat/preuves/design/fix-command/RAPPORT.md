# RAPPORT — Barre de commande ⌘K et tiroir de formulaire

Date : 2026-11-09 · Vue : 1440 × 1040 · Serveur : http://127.0.0.1:4200 · Rôle : Super admin
Référence : `bundle/etat/preuves/reference/maquette/Commande-1440.png` + `bundle/references/maquette/Commande.dc.html`
Grammaire du tiroir : `bundle/05_UI_UX_DESIGN.md` §5/§8, `bundle/etat/preuves/design/DIFFS_B.md` D-B27→D-B29
Données : `LOCAL_CATALOG` (144 actions) ; base Supabase injoignable en préversion → repli registre.
Aucun commit.

---

## 1. Périmètre

| Fichier | État |
|---|---|
| `crm/src/components/command/command-bar.tsx` | réécrit (palette) |
| `crm/src/components/command/command-drawer.tsx` | réécrit (tiroir) |
| `crm/src/components/command/catalog.ts` | + helpers d'affichage (`displayLabel`, `commandVisual`) |
| `crm/src/lib/rpc.ts`, `components/data/fixtures.ts`, `ui/crm.module.css`, `components/shell/**`, migrations, tests | **non modifiés** |

Constats hors périmètre (à ne pas m'attribuer) : `action-buttons.tsx` (même dossier) a été modifié
par un autre agent avant cette session ; `rpc.ts`, `crm.module.css`, `components/shell/**` sont
modifiés dans l'arbre partagé par des chantiers parallèles. Les captures reflètent cet arbre.

---

## 2. Ce qui est construit

### Palette ⌘K

- **Portail `document.body`** : le voile et le panneau échappent au `backdrop-filter` du `header`
  sticky (cause du voile 1440 × 112 et du clic extérieur inopérant).
- Panneau **720 × 566 à (360, 96)**, rayon **22**, fond `rgba(255,255,255,.97)`, ombre
  `0 24px 64px rgba(11,31,23,.32)` — valeurs de `Commande.dc.html`.
- En-tête **59 px** : icône loupe 20 (encre action), champ 18 px / 500, `Échap`.
- **Quatre sections disjointes** : Actions (max 6) · Membres (3) · Commandes (3) · Récents (3).
  Aucun doublon entre sections ; Récents = commandes réellement exécutées (localStorage) +
  éventuels cas de la file. La section Récents n'apparaît donc **qu'après au moins une action**
  (aucune donnée inventée) ; les captures sèment deux noms de commandes réelles pour la montrer.
- **Tuiles sémantiques** par pôle : `€` commerce, `!` confiance, `M` membres, `C` contenus,
  `IA` produit/IA, `↗` croissance, `T` technique, `≡` commande. Plus aucun « ME ».
- Ligne = **libellé + pôle + identifiant** (`Confiance · ACT-015`), libellé débarrassé du Markdown
  du registre (`**…**`, backticks).
- **Raccourcis affichés** : `↵` pour une action qui écrit, `⌘↵` pour une ouverture en lecture seule.
- **Pied** : `↑ ↓ choisir`, `↵ lancer`, `⌘↵ ouvrir sans agir`, **compteur de résultats** et mention
  « Seules les actions autorisées pour votre rôle apparaissent ».
- **Cinq exemples cliquables** sous le panneau (« suspendre @… », « masquer », …) : ils remplissent
  la requête, ils n'exécutent rien. Pas de chevauchement avec le pied (défaut de la maquette).
- Clavier/ARIA : combobox + listbox + `aria-activedescendant`, focus visible (anneau sur le champ),
  focus piégé, `Échap`, clic extérieur, verrou de défilement, retour du focus au déclencheur.
- État dégradé (base non joignable) en **bandeau discret sous l'en-tête**, hors du pied.

### Tiroir de formulaire

- **Portail `document.body`**, panneau **440 × 1040** collé à droite (x = 1000), voile plein écran,
  entrée animée.
- En-tête : titre de l'action + **pôle + identifiant** + états (`2 personnes`, `Motif obligatoire`,
  `Annul. 10 s`) + fermeture 44 × 44.
- Corps défilable, **sections titrées** : `Cible` → `Motif et message` → `Montant et date` →
  `Confirmation` → note interne ; champs conditionnels (cible, motif obligatoire, précision, montant,
  date, confirmation).
- **Aperçu du message au membre** (`Message au membre`) : texte du motif choisi + phrase de recours,
  ou consigne tant qu'aucun motif n'est choisi.
- Erreurs **à côté du champ**, saisie conservée, focus porté sur le premier champ invalide ; l'erreur
  du champ disparaît dès qu'on le corrige.
- Pied collé en bas : `Échap ferme` · `Annuler` · **action principale à droite** (nomme l'action ou
  « Créer la demande » si validation à deux personnes).
- Mode **lecture seule** (`⌘↵`) : bandeau « Ouverture sans agir », explication du mode, aucun champ,
  bouton `Fermer`.
- `Échap`, clic extérieur, focus piégé, verrou de défilement, restitution du focus.

---

## 3. Mesures — maquette vs rendu

| Ancre | Maquette | Rendu |
|---|---|---|
| Panneau | `360, 96` · `720 × 566` | `360, 96` · `720 × 566` |
| Rayon panneau | 22 px | 22 px |
| En-tête | 59 px | 59 px |
| Voile | `143,150,146` | `rgba(16,28,23,.45)` → `147,152,150` |
| Première ligne | `x 376` · `y 196` · `h 56` | `x 377` · `y 222` · `h 56` |
| Tuile | 30 × 30, rayon 9 | 30 × 30, rayon 9 |
| Libellé | `x 426` | `x 427` |
| Pied | `y 583` · `h 79` | `y 582` · `h 79` |
| Exemples | `y 640` (chevauchent le pied) | `y 674` (sous le panneau, sans chevauchement) |
| Tiroir | grammaire (aucune maquette) | `x 1000` · `440 × 1040` |

La première ligne est décalée de **+28 px** uniquement à cause du bandeau « base non joignable ».
Base joignable, le premier libellé tombe à `y 194` (maquette : 196).

---

## 4. Preuves comportementales (Playwright, 1440 × 1040)

```json
{
  "openByClick": 1,                    // ouverture par clic après hydratation
  "overlayHeight": 1040,               // voile plein écran
  "closedByOutsideClick": true,        // clic à (720, 950) ferme
  "sections": ["Actions", "Membres", "Commandes", "Récents"],
  "rowCount": 14,
  "counter": "14 résultats",
  "selectedAfterArrow": "!Masquer un commentaire…",   // flèches OK
  "drawer": { "x": 1000, "y": 0, "w": 440, "h": 1040 },
  "tabStaysInside": true,              // 25 Tab restent dans le tiroir
  "focusables": 7,
  "drawerClosedByEscape": true,
  "exampleFilled": "masquer",          // un exemple remplit la requête
  "focusBackToTrigger": "Chercher un membre, une commande… ou agir (Ctrl ou Commande + K)",
  "precisionKept": "Texte conservé.",  // saisie conservée après erreur
  "drawerClosedByOutsideClick": true
}
```

`npx tsc --noEmit` : **0 erreur** (après chaque lot).

**axe-core** (périmètre du panneau et du tiroir) : **0 violation** sur les deux surfaces.

Smoke final sans historique : palette `360,96 720×566`, 3 sections (Récents vide → masqué), tiroir
`1000,0 440×1040` avec `cmd-target`, `cmd-reason`, `cmd-precision`, `cmd-note`.

---

## 5. Captures (`crm/bundle/etat/preuves/design/fix-command/`)

| Fichier | Contenu |
|---|---|
| `14-commande-1440x1040.png` | palette, requête « publication » (Actions + Récents) |
| `14b-commande-vide-1440x1040.png` | palette à l'ouverture (4 sections, 14 résultats) |
| `14c-commande-membres-1440x1040.png` | section Membres + raccourci `⌘↵` |
| `15-commande-drawer-1440x1040.png` | tiroir « Masquer une publication » |
| `15b-commande-erreurs-1440x1040.png` | erreurs cible + motif, précision conservée |
| `15c-commande-apercu-1440x1040.png` | motif choisi → aperçu du message + recours |
| `15d-commande-remboursement-1440x1040.png` | montant + confirmation (Rembourser Stripe) |
| `15e-commande-lecture-seule-1440x1040.png` | ouverture sans agir (⌘↵) |
| `16-regression-membre-drawer-1440x1040.png` | même tiroir depuis `/membres/[id]` (440 × 1040) |

---

## 6. Écarts restants et besoins hors périmètre

1. **Recherche d'entités absente** : aucune source « membres » / « commandes » dans `rpc.ts` ou
   `fixtures.ts`. Les sections Membres et Commandes listent donc des **commandes du registre**
   (pôle `MEMB`, domaine `D11`), pas des entités ; les sous-titres métier de la maquette
   (« 129,80 € · @claire.vercors · livrée le 4 nov. ») sont impossibles. Nécessite une RPC de
   recherche d'entités — hors périmètre.
2. **Données de libellés** : `src/lib/catalog.ts` contient du Markdown (`Rembourser (Stripe) —
   **tout montant**`, `état \`removed\``). Nettoyé à l'affichage (`displayLabel`) ; correction à la
   source hors périmètre.
3. **Base Supabase injoignable** en préversion (`ERR_NAME_NOT_RESOLVED`) : le bandeau dégradé est
   visible sur les captures ; il disparaît quand `commands_catalog()` répond.
4. **Focus CSS** : `crm.module.css` n'expose ni `:focus-visible` pour `.paletteField` / `.result`, ni
   largeur de tiroir paramétrable ; l'indicateur de focus et la largeur sont donc en style inline.
   Un passage par le module CSS serait plus propre (fichier interdit ici).
5. **Largeur du tiroir** : la mission demande ~440 px, `DIFFS_B` D-B27 attend 520 px. Retenu **440**
   (consigne la plus récente) — à arbitrer.
6. **ESLint** ne démarre pas dans ce dépôt (config pointant vers un autre `node_modules`) : seul
   `tsc` a pu servir de porte.

---

## 7. Risques

- Le bandeau dégradé décale la liste de 28 px tant que la base est injoignable ; c'est un état, pas
  une régression de mise en page.
- Les sections sont plafonnées (6/3/3/3) : au-delà, la liste défile (voulu, la maquette est une
  requête filtrée).
- L'arbre est partagé : d'autres agents modifient `crm.module.css`, `rpc.ts` et la coque pendant les
  captures ; aucune de ces modifications n'est de moi.
