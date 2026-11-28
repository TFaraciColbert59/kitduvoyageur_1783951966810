# Chrome Global, Responsive Desktop/iPad & Terrain Réel Mobile — LKDV

> 5e volet de la Bible Design System LKDV. Couvre tout ce qui vit **autour** des drawers et des blocs canoniques : la barre flottante, les feedbacks globaux (`DynamicIsland`), les confirmations, l'adaptation **Desktop/iPad** et la résilience **terrain réel mobile** (clavier, safe-areas, offline).

---

## 1. Responsive Desktop & Tablette (iPad)

La référence tactile est mobile (`390×844` / `402×874`), mais l'application doit rester aussi nette et rapide sur **iPad (`768–1024px`)** et **Desktop (`≥ 1024px`)** :

| Élément | Mobile (`< 768px`) | Tablette / Desktop (`≥ 768px`) |
| :--- | :--- | :--- |
| **Drawers V2 (`Carnets`, `Clubs`, `Communauté`, `Compte`)** | Bottom sheet / carte clippée `min(430px, 100vw)`, `radius 24px` | Panneau latéral flottant verre `g3` (`380–430px` de large, marge `16px`, `radius 24px`) au-dessus de la carte ou du contenu sans bloquer toute la largeur |
| **Explorer v2 (`MapStage` + Drawer)** | Bottom sheet 3 detents (`peek` / `half` / `full`) | Panneau latéral gauche fixe (`400px`) + carte 3D plein écran à droite |
| **Sub-Drawer Portaled (`Analyse avancée`)** | Feuille `92dvh` pleine largeur (`.xp20-exp-scope`) | Panneau large centré ou latéral (`max-width: 720px`, `max-height: 88dvh`, `radius 28px`) |
| **Swipes horizontaux** | Actifs selon la hiérarchie 5 niveaux | **Swipes de pages désactivés à la souris** (zéro glissement accidentel lors d'une sélection texte). Navigation au clic (`CapsuleTabs`, flèches) et clavier (`← / →`, `Escape`) |
| **Grilles de cartes** | 1–2 colonnes (`gap: 10–12px`) | 2–4 colonnes fluides (`minmax(168px, 1fr)` pour produits/tuiles) |

---

## 2. Chrome Global & Feedbacks Utilisateur

### A. Barre de Navigation Flottante (`.lkdv-floating-tabbar`)
- Verre `gc` (`rgba(255,255,255,0.72)`, `blur(20px)`), hauteur `64px` (`--lkv-native-bar-height`), pilule flottante au-dessus de la safe-area basse (`bottomClearance: 88px`).
- **Règle d'effacement** : disparaît automatiquement dès qu'un drawer/dialog est ouvert (`body.lkdv-dialog-open` → `opacity: 0; pointer-events: none; transform: translateY(120%)`).

### B. `DynamicIsland`, Toasts & Pilule Activité Active
- **Feedbacks brefs (Toasts / `DynamicIsland`)** : ancrés en haut centré sous la safe-area (`z-index: 700`), durée `2,5–4 s`, jamais bloquants :
  - Succès : encre `#3D6038` / fond `#EAF3E9` / bordure `#B4D4B0`
  - Attention / Offline : encre `#8F671E` / fond `#FBF1DC` / bordure `#E8CF96`
  - Erreur : encre `#85261E` / fond `#F5DDD9` / bordure `#DFA8A1`
- **Activité GPS en cours (`ActiveOutingGlobalPill`)** : pilule persistante compacte affichant chrono + distance en `mono` permettant de revenir en 1 tap sur le tracker Explorer depuis n'importe quelle page.

### C. Dialogues & Confirmations Destructives
- **Brouillon non sauvegardé** : toujours utiliser `CloseDraftConfirm` (2 actions claires : *Continuer* / *Supprimer le brouillon*).
- **Suppression définitive** (sortie, carnet, post, club) : confirmation explicite obligatoire avec bouton destructif rouge (`--bad: #85261E`, fond `#F5DDD9`), jamais de suppression silencieuse en 1 tap.

---

## 3. Terrain Réel Mobile (Capacitor iOS & Android)

1. **Clavier virtuel (`--kb-inset`)** :
   - Les footers sticky des formulaires (`lkdv-cv2-form-footer`) et la messagerie s'ancrent au-dessus de `var(--kb-inset, env(keyboard-inset-height, 0px))` pour que le bouton principal reste toujours visible clavier ouvert.
2. **Safe Areas iOS / Android** :
   - Haut : `padding-top: calc(max(env(safe-area-inset-top, 0px), 10px) + 8px)` (respect Dynamic Island & encoche).
   - Bas : `padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 12px)` (respect barre home).
3. **Mode Offline Montagne & File de Synchro** :
   - Jamais d'écran blanc ni d'erreur bloquante en perte réseau.
   - Afficher un badge discret verre `g1` (`Hors ligne · X en attente`) ; les données locales (IndexedDB : traces GPS, brouillons, packs tuiles) restent 100 % consultables et éditables, et se synchronisent automatiquement au retour du signal.
4. **États Standards Universels** :
   - Chargement : squelettes doux (`lkdv-slot-skeleton` / `lkdv-cv2-skeleton`), jamais de spinner plein écran bloquant.
   - Vide : 1 icône discrète + 1 phrase courte + 1 CTA si pertinent.
   - Erreur : message clair en français + bouton `Réessayer` (jamais de code d'erreur technique brut à l'utilisateur).
