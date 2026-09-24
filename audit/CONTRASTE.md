# Audit de Contraste Mesuré (Fond Pur sans Interférence de Texte)

**Date :** 2026-09-24T17:46:00.260Z  
**Méthodologie Corrigée :**
1. Capture de la géométrie et des couleurs réelles de texte (`getComputedStyle`).
2. Neutralisation des glyphes (`color: transparent !important`) et capture du fond sous-jacent pur.
3. Échantillonnage pixel par pixel sous la boîte englobante de chaque nœud texte (9 points d'échantillonnage).
4. Inclusion des nœuds Axe `incomplete` pour transparence complète.

### Chiffres Clés de la Mesure Corrigée

- **Total nœuds texte analysés :** **1446**
- **Ancien taux de conformité (avec biais de glyphe) :** **20.6 %**
- **Nouveau taux de conformité réel mesuré :** **92.6 %**
- **Textes mesurés sous le seuil (pire pixel < 4.5:1 ou < 3.0:1) :** **107**
- **Nœuds Axe color-contrast en violation :** **52**
- **Nœuds Axe color-contrast en état incomplete (fond complexe/verre) :** **1264**

---

## Tableau des Textes Présentant un Ratio < 4.5:1 (ou < 3.0:1)

| Route | Sélecteur | Aperçu Texte | Couleur Texte | Fond Réel Pire Pixel | Ratio Mesuré | Seuil |
|:---|:---|:---|:---|:---|:---:|:---:|
| `accueil` | `p.text-[10px]` | ARRIVÉE | `rgb(203, 216, 208)` | `rgb(105, 113, 110)` | **3.41:1** | 4.5:1 |
| `accueil` | `p.text-sm` | Ven. 24 sept. | `rgb(127, 196, 154)` | `rgb(74, 83, 80)` | **3.88:1** | 4.5:1 |
| `accueil` | `p.text-[10px]` | DÉPART | `rgb(203, 216, 208)` | `rgb(105, 112, 110)` | **3.44:1** | 4.5:1 |
| `accueil` | `p.text-sm` | Lun. 27 sept. | `rgb(127, 196, 154)` | `rgb(203, 216, 208)` | **1.39:1** | 4.5:1 |
| `hub` | `p.mt-1` | BILAN | `rgb(127, 196, 154)` | `rgb(231, 233, 232)` | **1.68:1** | 4.5:1 |
| `hub-budget` | `span.text-sm` | 66 € | `rgb(241, 245, 241)` | `rgb(203, 216, 208)` | **1.34:1** | 4.5:1 |
| `hub-groupe` | `span.inline-flex` | 3 équipiers | `rgb(241, 245, 241)` | `rgb(185, 186, 186)` | **1.77:1** | 4.5:1 |
| `hub-groupe` | `span.inline-flex` | 2 au carnet | `rgb(241, 245, 241)` | `rgb(185, 186, 185)` | **1.77:1** | 4.5:1 |
| `hub-groupe` | `span.inline-flex` | 1 chien | `rgb(241, 245, 241)` | `rgb(182, 184, 183)` | **1.81:1** | 4.5:1 |
| `hub-groupe` | `button.inline-flex` | Fiche ICE | `rgb(255, 255, 255)` | `rgb(203, 216, 208)` | **1.47:1** | 4.5:1 |
| `hub-documents` | `span.mt-auto` | Expire dans 97 jours (règle des 6 mois) | `rgb(255, 255, 255)` | `rgb(203, 216, 208)` | **1.47:1** | 4.5:1 |
| `hub-documents` | `span.mt-auto` | Aucune échéance requise | `rgb(255, 255, 255)` | `rgb(173, 183, 177)` | **2.06:1** | 4.5:1 |
| `randonnee-active` | `span` | GPS · LIVE | `rgb(127, 196, 154)` | `rgb(99, 102, 100)` | **2.84:1** | 4.5:1 |
| `ai-configurator` | `span` | USAGE PRINCIPAL | `rgb(255, 255, 255)` | `rgb(241, 245, 241)` | **1.10:1** | 4.5:1 |
| `ai-configurator` | `span.font-bold` | ✓ | `rgb(255, 255, 255)` | `rgb(241, 245, 241)` | **1.10:1** | 4.5:1 |
| `ai-configurator` | `p.text-xs` | Haute montagne, cols escarpés & froid. Matéri | `rgb(203, 216, 208)` | `rgb(122, 129, 125)` | **2.71:1** | 4.5:1 |
| `copilote` | `button.inline-flex` | Envoyer | `rgb(14, 20, 17)` | `rgb(119, 121, 121)` | **4.26:1** | 4.5:1 |
| `occasion` | `span.inline-flex` | Comme neuf | `rgb(241, 245, 241)` | `rgb(112, 113, 110)` | **4.46:1** | 4.5:1 |
| `occasion` | `span.font-bold` | -54% | `rgb(228, 194, 122)` | `rgb(128, 128, 123)` | **2.32:1** | 4.5:1 |
| `location` | `span.inline-flex` | Neuf | `rgb(241, 245, 241)` | `rgb(139, 138, 136)` | **3.13:1** | 4.5:1 |
| `location` | `span.inline-flex` | 3 km | `rgb(241, 245, 241)` | `rgb(137, 139, 138)` | **3.11:1** | 4.5:1 |
| `abonnements` | `button.inline-flex` | Commencer gratuitement | `rgb(255, 255, 255)` | `rgb(193, 205, 198)` | **1.64:1** | 4.5:1 |
| `pays-fr` | `span` | Aperçu | `rgb(127, 196, 154)` | `rgb(213, 217, 214)` | **1.43:1** | 4.5:1 |
| `pays-fr` | `p.text-xs` | Contenu en préparation pour « Présentation ». | `rgb(237, 243, 239)` | `rgb(155, 156, 156)` | **2.45:1** | 4.5:1 |
| `pays-fr` | `p.text-xs` | Aucune recommandation disponible pour ce pays | `rgb(237, 243, 239)` | `rgb(230, 232, 231)` | **1.09:1** | 4.5:1 |
| `pays-fr` | `span.glass-pill` | 01 · Panorama Général | `rgb(255, 255, 255)` | `rgb(203, 216, 208)` | **1.47:1** | 4.5:1 |
| `pays-is` | `span` | Aperçu | `rgb(127, 196, 154)` | `rgb(216, 220, 218)` | **1.48:1** | 4.5:1 |
| `pays-is` | `p` | L'Islande, surnommée la "Terre de glace et de | `rgb(46, 93, 69)` | `rgb(49, 52, 51)` | **1.66:1** | 4.5:1 |
| `pays-is` | `span.font-mono` | 4°C | `rgb(127, 196, 154)` | `rgb(122, 130, 125)` | **1.93:1** | 3:1 |
| `lieux` | `button.inline-flex` | Ajouter à mon voyage | `rgb(255, 255, 255)` | `rgb(203, 216, 208)` | **1.47:1** | 4.5:1 |
| `preparer-randonnee` | `p.mt-1` | BILAN | `rgb(127, 196, 154)` | `rgb(231, 233, 232)` | **1.68:1** | 4.5:1 |
| `communaute` | `span` | Fil | `rgb(127, 196, 154)` | `rgb(221, 231, 236)` | **1.63:1** | 4.5:1 |
| `communaute` | `span` | Carnets | `rgb(203, 216, 208)` | `rgb(149, 191, 220)` | **1.33:1** | 4.5:1 |
| `communaute` | `span` | Clubs | `rgb(203, 216, 208)` | `rgb(135, 188, 226)` | **1.38:1** | 4.5:1 |
| `communaute` | `span` | Groupes | `rgb(203, 216, 208)` | `rgb(117, 183, 229)` | **1.48:1** | 4.5:1 |
| `communaute` | `span` | Sorties | `rgb(203, 216, 208)` | `rgb(91, 168, 225)` | **1.75:1** | 4.5:1 |
| `communaute` | `span` | Entraide | `rgb(203, 216, 208)` | `rgb(52, 144, 215)` | **2.33:1** | 4.5:1 |
| `feed` | `span.inline-flex` | COMMUNAUTÉ | `rgb(107, 155, 123)` | `rgb(127, 196, 154)` | **1.56:1** | 4.5:1 |
| `feed` | `span.font-mono` | CARNETS DE VOYAGE | `rgb(255, 255, 255)` | `rgb(127, 196, 154)` | **2.05:1** | 4.5:1 |
| `feed` | `p.max-w-xl` | Pas des posts — des récits longs avec tracé G | `rgb(255, 255, 255)` | `rgb(127, 196, 154)` | **2.05:1** | 4.5:1 |
| `carnets` | `span` | Explorer | `rgb(127, 196, 154)` | `rgb(216, 220, 217)` | **1.48:1** | 4.5:1 |
| `carnets` | `h3.line-clamp-2` | Trek dans le Landmannalaugar | `rgb(255, 255, 255)` | `rgb(158, 206, 228)` | **1.69:1** | 4.5:1 |
| `carnets` | `h3.line-clamp-2` | Roadtrip sur la Ring Road | `rgb(255, 255, 255)` | `rgb(158, 154, 88)` | **2.91:1** | 4.5:1 |
| `carnets` | `span.tabular-nums` | 89 | `rgb(255, 255, 255)` | `rgb(216, 220, 218)` | **1.38:1** | 4.5:1 |
| `clubs` | `span` | Découvrir | `rgb(127, 196, 154)` | `rgb(216, 220, 217)` | **1.48:1** | 4.5:1 |
| `clubs` | `p.line-clamp-2` | Amoureux des grands espaces canadiens. | `rgb(203, 216, 208)` | `rgb(237, 238, 238)` | **1.27:1** | 4.5:1 |
| `clubs` | `button.inline-flex` | + Rejoindre | `rgb(14, 20, 17)` | `rgb(106, 107, 106)` | **3.48:1** | 4.5:1 |
| `entraide` | `span` | Fil | `rgb(127, 196, 154)` | `rgb(213, 217, 214)` | **1.43:1** | 4.5:1 |
| `evenements` | `span` | Fil | `rgb(127, 196, 154)` | `rgb(223, 218, 213)` | **1.47:1** | 4.5:1 |
| `evenements` | `span.rounded-[var(--lkv-radius-xs)]` | COMMUNAUTE | `rgb(120, 153, 114)` | `rgb(47, 64, 49)` | **3.48:1** | 4.5:1 |
| `evenements` | `span.rounded-[var(--lkv-radius-xs)]` | 🚣 Photo | `rgb(241, 245, 241)` | `rgb(159, 196, 212)` | **1.68:1** | 4.5:1 |
| `evenements` | `span.rounded-[var(--lkv-radius-xs)]` | 🌙 Bushcraft | `rgb(241, 245, 241)` | `rgb(237, 243, 239)` | **1.02:1** | 4.5:1 |
| `evenements` | `h3.mb-0.5` | Bivouac Vercors — Nuit étoilée | `rgb(255, 255, 255)` | `rgb(243, 240, 236)` | **1.14:1** | 4.5:1 |
| `evenements` | `p.m-0` | Villard-de-Lans · 2 jours | `rgb(241, 245, 241)` | `rgb(210, 188, 179)` | **1.65:1** | 4.5:1 |
| `evenements` | `p.m-0` | DATE | `rgb(237, 243, 239)` | `rgb(123, 130, 125)` | **3.50:1** | 4.5:1 |
| `outils` | `span.inline-flex` | TERRAIN | `rgb(241, 245, 241)` | `rgb(203, 216, 208)` | **1.34:1** | 4.5:1 |
| `outils` | `p.text-[12px]` | Boussole et niveau à bulle utilisant les capt | `rgb(203, 216, 208)` | `rgb(93, 99, 97)` | **4.17:1** | 4.5:1 |
| `outil-poids-sac` | `p.font-mono` | 2.22 kg | `rgb(75, 107, 124)` | `rgb(31, 36, 34)` | **2.77:1** | 4.5:1 |
| `outil-poids-sac` | `span.font-mono` | 420 g | `rgb(75, 107, 124)` | `rgb(14, 18, 16)` | **3.32:1** | 4.5:1 |
| `outil-poids-sac` | `span.font-mono` | 420 g | `rgb(75, 107, 124)` | `rgb(45, 49, 47)` | **2.32:1** | 4.5:1 |
| `outil-convertisseur` | `button.glass-capsule-btn` | Devises (Indicatif) | `rgb(241, 245, 241)` | `rgb(137, 140, 138)` | **3.09:1** | 4.5:1 |
| `outil-convertisseur` | `span.font-mono` | 0.621 miles | `rgb(75, 107, 124)` | `rgb(18, 22, 20)` | **3.21:1** | 4.5:1 |
| `outil-convertisseur` | `span.font-mono` | 1.609 km | `rgb(75, 107, 124)` | `rgb(15, 19, 17)` | **3.29:1** | 4.5:1 |
| `outil-convertisseur` | `span.font-mono` | 3.281 ft | `rgb(75, 107, 124)` | `rgb(14, 18, 16)` | **3.32:1** | 4.5:1 |
| `outil-convertisseur` | `span.font-mono` | 0.305 m | `rgb(75, 107, 124)` | `rgb(13, 18, 16)` | **3.32:1** | 4.5:1 |
| `compte` | `span.text-xs` | Ma progression & classements | `rgb(241, 245, 241)` | `rgb(202, 203, 202)` | **1.48:1** | 4.5:1 |
| `compte` | `p.text-[11px]` | 0 Points LKDV · Randonneur Curieux | `rgb(203, 216, 208)` | `rgb(202, 203, 202)` | **1.11:1** | 4.5:1 |
| `compte` | `span` | 🎒 | `rgb(237, 243, 239)` | `rgb(241, 241, 241)` | **1.00:1** | 4.5:1 |
| `compte` | `span` | 24 | `rgb(255, 255, 255)` | `rgb(174, 162, 94)` | **2.58:1** | 4.5:1 |
| `compte-modifier` | `span.font-serif` | et où vous allez. | `rgb(54, 82, 51)` | `rgb(25, 27, 26)` | **1.99:1** | 3:1 |
| `progression` | `span.block` | POINTS LKDV CUMULÉS | `rgb(203, 216, 208)` | `rgb(164, 166, 165)` | **1.66:1** | 4.5:1 |
| `progression` | `span.font-mono` | — | `rgb(127, 196, 154)` | `rgb(161, 163, 162)` | **1.24:1** | 4.5:1 |
| `progression` | `span.block` | POINTS DE SAISON | `rgb(203, 216, 208)` | `rgb(161, 162, 162)` | **1.74:1** | 4.5:1 |
| `progression` | `span.font-mono` | — | `rgb(127, 196, 154)` | `rgb(160, 161, 159)` | **1.27:1** | 4.5:1 |
| `progression` | `p.mt-3` | Vos points et votre niveau apparaîtront après | `rgb(237, 243, 239)` | `rgb(159, 160, 159)` | **2.33:1** | 4.5:1 |
| `progression` | `span.truncate` | Explorer | `rgb(241, 245, 241)` | `rgb(175, 176, 175)` | **1.98:1** | 4.5:1 |
| `progression` | `span.font-mono` | — | `rgb(127, 196, 154)` | `rgb(158, 159, 159)` | **1.30:1** | 4.5:1 |
| `progression` | `span.truncate` | Se préparer | `rgb(241, 245, 241)` | `rgb(167, 168, 168)` | **2.16:1** | 4.5:1 |
| `progression` | `span.font-mono` | — | `rgb(127, 196, 154)` | `rgb(158, 159, 159)` | **1.30:1** | 4.5:1 |
| `progression` | `span.truncate` | Partager | `rgb(241, 245, 241)` | `rgb(159, 160, 159)` | **2.38:1** | 4.5:1 |
| `progression` | `span.font-mono` | — | `rgb(127, 196, 154)` | `rgb(158, 159, 159)` | **1.30:1** | 4.5:1 |
| `progression` | `span.truncate` | S’entraider | `rgb(241, 245, 241)` | `rgb(158, 159, 159)` | **2.41:1** | 4.5:1 |
| `progression` | `span.font-mono` | — | `rgb(127, 196, 154)` | `rgb(158, 159, 159)` | **1.30:1** | 4.5:1 |
| `progression` | `span.block` | SOLDE UTILISABLE (RÉCOMPENSES UNIQUEMENT) | `rgb(203, 216, 208)` | `rgb(158, 159, 159)` | **1.80:1** | 4.5:1 |
| `progression` | `span.block` | 0 pts | `rgb(241, 245, 241)` | `rgb(158, 159, 159)` | **2.41:1** | 4.5:1 |
| `messagerie` | `span` | Toutes | `rgb(127, 196, 154)` | `rgb(212, 217, 214)` | **1.43:1** | 4.5:1 |
| `blog` | `h1.m-0` | Conseils & Guides | `rgb(16, 28, 23)` | `rgb(15, 20, 20)` | **1.06:1** | 3:1 |
| `blog` | `h2.mb-[var(--space-3)]` | A la une | `rgb(16, 28, 23)` | `rgb(13, 18, 19)` | **1.08:1** | 4.5:1 |
| `blog` | `span.rounded-[var(--lkv-radius-xs)]` | Conseils | `rgb(127, 196, 154)` | `rgb(131, 134, 141)` | **1.78:1** | 4.5:1 |
| `blog` | `h3.mb-0.5` | Comment voyager léger : 10 conseils d'experts | `rgb(255, 255, 255)` | `rgb(116, 119, 126)` | **4.48:1** | 4.5:1 |
| `blog` | `h2.mb-[var(--space-3)]` | Tous les articles | `rgb(16, 28, 23)` | `rgb(14, 18, 18)` | **1.08:1** | 4.5:1 |
| `blog` | `span` | 28 juin 2026 | `rgb(237, 243, 239)` | `rgb(203, 216, 208)` | **1.31:1** | 4.5:1 |
| `blog` | `span` | 18 min | `rgb(237, 243, 239)` | `rgb(203, 216, 208)` | **1.31:1** | 4.5:1 |
| `faq` | `h1.mb-[var(--space-2)]` | Questions fréquentes | `rgb(16, 28, 23)` | `rgb(19, 22, 21)` | **1.04:1** | 3:1 |
| `contact` | `h1.mb-[var(--space-2)]` | Contactez-nous | `rgb(16, 28, 23)` | `rgb(17, 21, 21)` | **1.05:1** | 3:1 |
| `admin` | `p.text-[10px]` | ARRIVÉE | `rgb(203, 216, 208)` | `rgb(105, 113, 110)` | **3.41:1** | 4.5:1 |
| `admin` | `p.text-sm` | Ven. 24 sept. | `rgb(127, 196, 154)` | `rgb(74, 83, 80)` | **3.88:1** | 4.5:1 |
| `admin` | `p.text-[10px]` | DÉPART | `rgb(203, 216, 208)` | `rgb(105, 112, 110)` | **3.44:1** | 4.5:1 |
| `admin` | `p.text-sm` | Lun. 27 sept. | `rgb(127, 196, 154)` | `rgb(203, 216, 208)` | **1.39:1** | 4.5:1 |
| `admin-produits` | `p.text-[10px]` | ARRIVÉE | `rgb(203, 216, 208)` | `rgb(105, 113, 110)` | **3.41:1** | 4.5:1 |
| `admin-produits` | `p.text-sm` | Ven. 24 sept. | `rgb(127, 196, 154)` | `rgb(74, 83, 80)` | **3.88:1** | 4.5:1 |
| `admin-produits` | `p.text-[10px]` | DÉPART | `rgb(203, 216, 208)` | `rgb(105, 112, 110)` | **3.44:1** | 4.5:1 |
| `admin-produits` | `p.text-sm` | Lun. 27 sept. | `rgb(127, 196, 154)` | `rgb(203, 216, 208)` | **1.39:1** | 4.5:1 |
| `dev-glass` | `span.glass-pill` | 6 | `rgb(61, 96, 56)` | `rgb(140, 147, 136)` | **2.27:1** | 4.5:1 |
| `dev-style` | `span.glass-pill` | 6 | `rgb(61, 96, 56)` | `rgb(140, 147, 136)` | **2.27:1** | 4.5:1 |
| `mentions-legales` | `h2.mb-[var(--space-2)]` | 5. Responsabilité | `rgb(127, 196, 154)` | `rgb(78, 80, 79)` | **3.97:1** | 4.5:1 |
| `cgv` | `h2.mb-[var(--space-2)]` | 5. Paiement | `rgb(127, 196, 154)` | `rgb(203, 216, 208)` | **1.39:1** | 4.5:1 |
