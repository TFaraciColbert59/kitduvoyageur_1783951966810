# brand.md — LKDV, Le Kit du Voyageur

- **Ce que c'est** : une application de préparation et de vie d'aventure (Next.js + Capacitor). Une phrase libre dans le Compas → parcours sur des lieux réels, dates et nuits, groupe, kit et budget, verdict ; puis le Kit Studio (sac 3D modulaire), le terrain (suivi GPS, hors ligne, SOS), les carnets de bord, la communauté (clubs, sorties, lignées de kits).
- **Phrase de marque** (site) : « Là où la carte se termine. » ; devise du badge : « Préparer · Explorer · Partager », « Aventure · Nature · Liberté ».
- **Ton** : calme, précis, honnête (rien ne s'affiche sans preuve terrain ; jamais de classement de personnes ; jamais de vocabulaire génétique pour les lignées : « lignée », « kit souche », « éprouvé », « gardé par X voyageurs sur 10 »).
- **Fichiers** :
  - badge : `public/logo.png` (1024 px, fond noir) → détouré `video/trailer-lkdv/assets/img/lkdv-badge.png` ;
  - pictogramme : `public/assets/logo-mark.svg` ;
  - photos : `public/assets/images/*` (paysage du Compas : `lkdv-bg-landscape.webp`) ;
  - sacs 3D : `public/assets/bags/*.glb`, modules : `public/assets/modules/*.glb` ;
  - captures réelles : `docs/compas/preuves/`, `docs/kit-studio/captures/`, `docs/explorer-v2/preuves/`, `docs/audit/**`.
- **Adresse affichée** : lekitduvoyageur.fr (`NEXT_PUBLIC_SITE_URL` par défaut) — à confirmer par Tony : le domaine sert aujourd'hui un autre site.
- **Données** : jeu de démonstration du Compas (`src/features/compas/dev/labData.ts`) tant qu'aucun vrai voyage n'est montrable ; le dire dans chaque livraison.
- **Règles** : `video/MOTION.md`.
