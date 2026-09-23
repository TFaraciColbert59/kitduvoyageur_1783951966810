# Références de Conception & Principes Techniques — Full Liquid Glass iOS 27

Ce document synthétise les règles fondamentales issues des guides Apple Human Interface Guidelines (HIG), des annonces WWDC et des spécifications W3C/CSS pour l'implémentation du système **Full Liquid Glass iOS 27** sur l'application *Le Kit du Voyageur (LKDV)*.

---

## 1. Fondations Apple Human Interface Guidelines & iOS 27

### 1.1 Matériaux & Profondeur (Materials & Depth)
- **Diffusion et réfraction** : Le verre Liquid Glass diffuse le contenu sous-jacent avec une saturation accrue (+80% saturation) et un flou gaussien calibré (20px à 32px selon `--glass-intensity`).
- **Bord assombri (Darkened Rim)** : Spécificité iOS 27 — la bordure extérieure n'est plus un simple liséré blanc ou translucide, mais un contour extérieur assombri (`0 0 0 0.5px rgba(0,0,0,0.22)` en light, `0.55` en dark) combiné à un liséré spéculaire intérieur (`inset 0 0 0 0.5px rgba(255,255,255,0.45)`). Cela empêche le verre de « baver » ou de se confondre avec des arrière-plans très clairs.
- **Reflet spéculaire (Highlight)** : Reflet supérieur net (`inset 0 1px 0 rgba(255,255,255,0.55)` en light, `0.18` en dark) simulant la source lumineuse zénithale iOS.
- **Réglage d'intensité (`--glass-intensity`)** : Échelle normalisée de 0.0 (clair, cristallin) à 1.0 (teinté, dense), permettant à l'utilisateur d'ajuster l'opacité selon ses préférences de confort visuel.

### 1.2 Rayons & Concentricité (Concentric Corner Geometry)
- **Principe de concentricité** : Pour deux conteneurs arrondis imbriqués, les centres de courbure doivent coïncider :
  $$\text{Rayon}_{\text{enfant}} = \max(\text{Rayon}_{\text{parent}} - \text{Padding}, \text{Plancher})$$
  Tout rayon enfant inférieur ou égal à zéro ou non concentrique crée une dissonance optique ("corner pinching").
- **Échelle canonique des arrondis** :
  - **Capsule (9999px)** : Boutons, pilules, chips, champs textuels, tab bars, segmented controls, toasts, badges.
  - **Grandes modales / Sheets** : 44px (coins supérieurs).
  - **Cartes hero** : 38px.
  - **Cartes standard** : 32px.
  - **Popovers & Menus** : 28px.
  - **Petites tuiles** : 24px.
  - **Plancher absolu** : Aucun rayon d'UI < 12px (seule exception : checkbox à 8px).
- **Courbure continue (Squircle)** : Utilisation de `corner-shape: squircle` sous `@supports (corner-shape: squircle)` avec fallback fluide en `border-radius`.

### 1.3 Monochromie & Hiérarchie sans couleur primaire
- **Bannissement des accents colorés artificiels** : Ni vert menthe, ni orange d'action, ni bleu standard. L'interface entière s'exprime par le contraste entre le verre neutre et les encres typographiques.
- **Les 4 niveaux d'encre typographique (Vibrant Labels)** :
  - `label` : Contraste maximal (encre profonde en light, blanc pur en dark).
  - `secondaryLabel` : Informations contextuelles, sous-titres (≥ 4.5:1).
  - `tertiaryLabel` : Métadonnées, icônes secondaires (≥ 3:1).
  - `quaternaryLabel` : Séparateurs, filigranes.
- **Traitement strict des statuts** : La couleur (danger, avertissement, succès) est réservée exclusivement aux états fonctionnels critiques, toujours accompagnée d'une icône explicite et d'un texte, sous forme de légère teinte de verre (≤ 12% d'opacité) ou sur l'icône, jamais en fond opaque.

### 1.4 Accessibilité (WCAG 2.2 AA)
- **Mesure au pire pixel** : Le contraste de 4.5:1 pour le texte normal et 3.0:1 pour le grand texte doit être garanti sur le pixel le plus défavorable de la photo sous-jacente.
- **Réduction de la transparence (`prefers-reduced-transparency: reduce`)** : Bascule automatique immédiate vers un fond opaque à 100% avec bord contrasté (`1px solid rgba(var(--glass-ink) / 0.45)`).
- **Contraste augmenté (`prefers-contrast: more`)** : Suppression des flous, contours renforcés à 1.5px.
- **Cibles tactiles** : Minimum 44×44 pt sur tout élément cliquable, espacement inter-cibles ≥ 8 pt.

---

## 2. Architecture Technique Web du Verre

### 2.1 La problématique du « Backdrop Root » (W3C Filter Effects 2)
Tout élément possédant `backdrop-filter` forme un nouveau contexte de rendu racine pour les filtres arrière (« backdrop root »). Si un élément enfant possède également un `backdrop-filter`, il ne floute que son parent direct, ce qui annule le flou de l'image de fond et génère un surcoût GPU catastrophique (double passe de texture).

**Solution architecturale à 5 niveaux :**
1. **G0 (Fond d'ambiance)** : Photographie immersive + scrim adaptatif (dégradé sombre + voile de lisibilité), `position: fixed; inset: 0; height: 100dvh; z-index: -1`.
2. **G1 (Verre Régulier — Porteur unique du flou)** : Conteneur principal (TopBar, TabBar, Carte de 1er niveau, Sheet, Modale). Porte le `backdrop-filter: blur(...) saturate(...)`.
3. **G2 (Verre Intérieur — Sans nouveau backdrop-filter)** : Cellules, tuiles, champs, chips posés dans un G1. Construit par addition de luminosité (`background: rgba(255,255,255,0.12)`), bord spéculaire et ombre portée interne (`inset 0 1px 0 rgba(255,255,255,0.4)`). Crée l'illusion parfaite du verre sur verre à coût GPU zéro.
4. **G3 (Verre Prominent — Remplacement du CTA)** : Action principale unique par écran. Light = verre encre dense (84%) + texte blanc pur ; Dark = verre lumineux dense (88%) + texte encre sombre.
5. **GC (Verre Clair — HUD & Contrôles sur carte/médias)** : Transparence accrue + pastille d'assombrissement locale sous l'icône garantissant le contraste ≥ 3:1.

### 2.2 Performance GPU & Budget Mobile
- **Plafond d'éléments avec flou actif** : $\le 8$ éléments simultanés dans le viewport.
- **Virtualisation et masquage hors champ** : Utilisation de `content-visibility: auto` sur les listes longues.
- **Animations interdites sur le filtre** : Ne jamais animer `backdrop-filter` (recalcul de flou à chaque frame à 16.7ms). Animer exclusivement `opacity` et `transform`.
- **Mode faible consommation** : Détection des appareils à faible GPU (`navigator.hardwareConcurrency <= 4`) pour basculer automatiquement sur des fonds pré-calculés sans flou lourd.
