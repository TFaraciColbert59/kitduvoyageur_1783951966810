# Références
- `Kit_Studio_actuel.html` : maquette d'origine (à lire **par plages**, voir `audit/INVENTAIRE-MAQUETTE.md`).
- `Kit_Studio_v2.html` : maquette cible (tiroir unique 30 %, cartes 3D, aucune bordure colorée). Elle se génère depuis l'original par blocs ; elle sert de **référence de rendu**, pas de code à copier tel quel (monolithe, three en CDN).
- `screens/` : captures 402-430 px de large (réduites). `actuel_scene.png`, `v2_cartes_contenu_apparence.png` (gauche Contenu, droite Apparence), `v2_bilan_fiche.png`, `v2_commande.png`.
Les captures de référence **pixel** pour les tests sont à régénérer par T19 depuis `Kit_Studio_v2.html` en WebKit 402×874.
