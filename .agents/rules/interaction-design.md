# Aura Interaction Design Rule

Le skill Aura Interaction Design doit être utilisé pour toute décision relative aux interactions et à l'expérience utilisateur lorsqu'il est pertinent.

## Scope & Applicabilité
Appliquer automatiquement ce skill pour :
- UX et ergonomie mobile/desktop
- Micro-interactions et retours haptiques/visuels
- Navigation, bottom tabs, drawers et menus
- Animations, transitions de pages et modales
- États loading (skeletons), empty et error
- Gestes tactiles (swipe, drag, pull)
- Formulaires, validation interactive et onboarding

## Directives Architecturales LKDV
- Respecter l'identité visuelle LKDV (`#17402C`, `#0B1F17`, `#A3C4A3`, `#FBFAF6` - AUCUN `#E4501C`).
- Respecter les composants structurels : `MobilePageShell`, `BottomTabBar`, `HamburgerMenu`.
- Animer uniquement `transform` et `opacity` (accélération matérielle, 60fps).
- Respecter systématiquement `prefers-reduced-motion`.
