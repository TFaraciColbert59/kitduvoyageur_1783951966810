# Registre des Bugs Métier & Données — Audit LKDV iOS 27

> **Règle stricte du chantier :** La logique métier (requêtes Supabase, RLS, Stripe, calculs d'engins mathématiques, server actions) est sacralisée. Tout dysfonctionnement relevant des formules, de l'intégrité des bases de données ou des pipelines externes est documenté ici pour traitement dédié hors chantier design, **sans modification du code métier sous-jacent**.

---

## 1. Inventaire des Anomalies Métier Relevées

### BUG-METIER-01 : Calculateur Carbone — Facteur d'émission aérien (Paris–Katmandou : 3 120 tonnes)
- **Route :** `/carbone`
- **Capture :** `screenshots/062_carbone.png` / `screenshots_mobile/062_carbone_mobile.png`
- **Symptôme :** Un aller-retour Paris–Katmandou affiche une émission de `3 120,2 tonnes de CO₂e` par passager au lieu d'environ `1,8 à 3,1 tonnes`.
- **Hypothèse :** Erreur d'unité dans l'algorithme de calcul (`kg` traités comme des `tonnes` ou multiplication indue par 1000 dans le convertisseur d'émission).
- **Fichier suspect :** `src/features/carbon/engine/carbonEngine.ts` ou `src/app/carbone/page.tsx`.

### BUG-METIER-02 : Tunnel Checkout — Total de livraison calculé sur panier vide ou incohérent
- **Route :** `/checkout`
- **Capture :** `screenshots/027_checkout.png`
- **Symptôme :** Option "Livraison offerte" cochée, mais un montant de `5,90 €` apparaît et le total final indique `6,00 €` sur un panier sans sous-total produit.
- **Hypothèse :** La gestion d'arrondi monétaire Stripe/Checkout et la sélection par défaut de la méthode de livraison forcent un plancher minimum même quand le panier est en montant nul.
- **Fichier suspect :** `src/features/checkout/services/checkoutService.ts` / `src/app/checkout/page.tsx`.

### BUG-METIER-03 : Hub Documents — Compteur de documents incohérent
- **Route :** `/hub/documents`
- **Capture :** `screenshots/009_hub-documents.png`
- **Symptôme :** Le bandeau de synthèse et la liste détaillée affichent des totaux contradictoires (ex. `0 document(s)` dans l'en-tête et 2 cartes de fichiers listées en dessous).
- **Hypothèse :** La fonction `docsEngine.ts` filtre les documents expirés pour le badge de synthèse mais la vue liste effectue un select brut sans clause temporelle.
- **Fichier suspect :** `src/features/hub/docsEngine.ts`.

### BUG-METIER-04 : Sécurité Expédition — Compteur d'inactivité figé à 02:00
- **Route :** `/hub/securite` / `/voyages/[slug]/securite`
- **Capture :** `screenshots/007_hub-securite.png`
- **Symptôme :** Le délai de sécurité avant déclenchement d'alerte affiche en permanence `02:00` sans décompte réel ni synchronisation avec la balise GPS.
- **Hypothèse :** Mock seed figé (`seed_y_profiles.mjs`) sans intervalle réactif côté serveur pour le test unitaire.
- **Fichier suspect :** `src/features/hub/safetyEngine.ts`.

### BUG-METIER-05 : Carnets de voyage — Durée affichée « 0 jours »
- **Route :** `/carnets/[id]`
- **Capture :** `screenshots/043_carnet-detail.png`
- **Symptôme :** Le carnet de randonnée affiche `0 jours` alors que la randonnée contient plusieurs étapes datées.
- **Hypothèse :** Calcul de différence de dates entre `date_debut` et `date_fin` qui renvoie 0 lorsque les dates ISO ont la même journée ou sont mal parsées en timezone UTC locale.
- **Fichier suspect :** `src/lib/queries/carnet.ts` / `src/components/carnet/CarnetView.tsx`.

### BUG-METIER-06 : Bourse d'Occasion & Location — Images de mock et placeholders désynchronisés
- **Route :** `/occasion`, `/location`
- **Capture :** `screenshots/024_occasion.png`, `screenshots/025_location.png`
- **Symptôme :** Certaines annonces présentent des photos génériques non conformes au produit réel décrit (ex: tente avec photo de chaussure).
- **Hypothèse :** Seeds initiaux de démo qui associent aléatoirement des URLs d'Unsplash à des IDs produits sans mapping catégoriel strict.
- **Fichier suspect :** `scripts/seed/seed_massive_demo.mjs`.

### BUG-METIER-07 : Fiche Produit — Marque fournisseur « BigBuy » exposée en public
- **Route :** `/produit/[slug]`
- **Capture :** `screenshots/023_produit-detail.png`
- **Symptôme :** Les slugs et descriptions comportent la mention technique du grossiste dropshipping `BigBuy` (ex: `sac-a-dos-de-randonnee-categorie-bigbuy`).
- **Hypothèse :** Import brut du flux fournisseur dans le catalogue Supabase sans filtre de réécriture de slug ni marque blanche.
- **Fichier suspect :** Table Supabase `products` (colonne `slug` et `title`).

### BUG-METIER-08 : Guide des Tailles — Correspondance pointures erronée
- **Route :** `/outils/tailles`
- **Capture :** `screenshots/057_outil-tailles.png`
- **Symptôme :** Tableau de correspondances affichant des équivalences contradictoires entre standards européens et UK (ex: M = EU 38 = UK 10).
- **Hypothèse :** Données statiques de conversion définies avec une erreur de décalage d'index dans le tableau source.
- **Fichier suspect :** `src/features/outils/data/taillesData.ts` ou composant interne.
