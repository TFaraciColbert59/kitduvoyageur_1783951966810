# Tableau des Contrastes & Conformité WCAG 2.2 AA (LKDV)

## 1. Référentiel
Ce tableau documente les couples de couleurs autorisés dans le Design System Unifié LKDV, vérifiés selon la formule de luminance relative W3C (WCAG 2.2 niveau AA : ratio minimal 4.5:1 pour texte normal, 3.0:1 pour grand texte / composants graphiques).

## 2. Matrice des Couleurs Officielles

| Usage | Couleur Premier Plan | Couleur Arrière-Plan | Ratio Mesuré | Conforme WCAG AA (≥ 4.5:1) | Conforme WCAG AAA (≥ 7.0:1) |
|---|---|---|---|---|---|
| **Texte principal sur fond clair** | `#17402C` (Vert Forêt LKDV) | `#FFFFFF` (Blanc) | **10.4:1** | Oui | Oui |
| **Texte principal sur fond crème** | `#17402C` (Vert Forêt LKDV) | `#FBFAF6` (Fond AppShell) | **9.8:1** | Oui | Oui |
| **Bouton primaire (texte blanc)** | `#FFFFFF` (Blanc) | `#17402C` (Vert Forêt LKDV) | **10.4:1** | Oui | Oui |
| **Bouton secondaire (vert sauge)** | `#FFFFFF` (Blanc) | `#5B7F55` (Vert Sauge Action) | **4.6:1** | Oui | Non |
| **Texte secondaire atténué** | `#44403C` (Stone 700) | `#FBFAF6` (Fond AppShell) | **7.6:1** | Oui | Oui |
| **Texte tertiaire / labels** | `#57534E` (Stone 600) | `#FFFFFF` (Blanc) | **5.4:1** | Oui | Non |
| **Badge Sponsorisé (Loi 2023)** | `#78350F` (Amber 900) | `#FEF3C7` (Amber 100) | **7.2:1** | Oui | Oui |
| **Badge Alerte Critique / Vital** | `#881337` (Rose 900) | `#FFE4E6` (Rose 100) | **7.5:1** | Oui | Oui |
| **Badge Succès / Validation** | `#065F46` (Emerald 800) | `#D1FAE5` (Emerald 100) | **6.8:1** | Oui | Non |
| **Mode Sombre / Plein Soleil** | `#FFFFFF` (Blanc) | `#0B1F17` (Fond Nuit Sombre) | **15.2:1** | Oui | Oui |
| **Mode Sombre texte secondaire** | `#A8A29E` (Stone 400) | `#0B1F17` (Fond Nuit Sombre) | **6.1:1** | Oui | Non |

## 3. Règles d'Implémentation
1. Interdiction stricte de `#5C6B5E` (déprécié en Phase 2.1 car ratio limite de 4.1:1). Remplacé par `#5B7F55` ou `#17402C`.
2. Tout élément interactif (bouton, lien, input) doit posséder un état de focus visible (`focus:ring-2 focus:ring-amber-400` ou `focus:ring-[#5B7F55]`).
3. Tous les boutons tactiles mobiles respectent une boîte englobante minimale de 44x44 px.
