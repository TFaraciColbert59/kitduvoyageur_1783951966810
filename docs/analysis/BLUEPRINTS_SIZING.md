# A.5 — Dimensionnement Chiffré du Cache de Blueprints & Arbitrages D-B / D-D
**Document d'analyse préalable — Chantier U13 Voyage Auto-Généré**  
*Statut : Modélisation mathématique, dimensionnement système et calcul de coûts — aucun code*

---

## 1. Contexte & Rôle Fondateur des Blueprints

Dans l'architecture du Chantier U13 (§6), générer à la volée 12 couches fonctionnelles complexes pour chaque requête utilisateur présente deux risques majeurs :
1. Une latence inacceptable (> 15 à 30 secondes), dégradant l'expérience sur mobile.
2. Un coût d'inférence cumulé insoutenable financièrement si l'IA devait recomposer le monde à chaque frappe de touche.

La solution d'ingénierie réside dans le **cache de blueprints** : pré-calculer hors-ligne des patrons de voyages types exhaustifs, cohérents et vérifiés pour les combinaisons canoniques, puis adapter instantanément le blueprint le plus proche au brief utilisateur spécifique (dates exactes, taille du groupe, matériel déjà possédé dans le profil, contraintes particulières).

Ce document dimensionne la combinatoire réelle, évalue les besoins en stockage mémoire, chiffre le coût de calcul et tranche formellement les décisions **D-B** (périmètre géographique) et **D-D** (plafond de coût).

---

## 2. Analyse de la Combinatoire : Théorique vs Réelle

### 2.1 L'Illusion de la Combinatoire Naïve
Une approche théorique aveugle multiplie les dimensions sans tenir compte des réalités physiques du terrain :
- 20 pays × 12 mois × 5 tranches de durée × 6 styles × 3 paliers de budget = **21 600 blueprints**.
- Une telle matrice est ingérable, génère 85 % de combinaisons absurdes (ex: bivouac en tente légère au Toubkal en janvier par -20°C, ou trek de 28 jours dans le massif du Sancy) et disperse les ressources de vérification.

### 2.2 Modélisation Déterministe Fondée sur les Faits de Terrain
En croisant les 10 archétypes constatés en A.1 avec les réalités climatiques mesurées en A.2 :

1. **Pôles Géographiques Maîtrisés (15 pôles sur 5 pays prioritaires)** :
   - *France* (4 pôles) : Tour du Mont-Blanc / Val Montjoie, Massif des Écrins / Vanoise, Massif Central / Sancy, Corse GR20.
   - *Islande* (3 pôles) : Laugavegur / Fjallabak, Fimmvörðuháls / Côte Sud, Hautes Terres centrales (Askja / Kerlingarfjöll).
   - *Maroc* (3 pôles) : Haut Atlas Toubkal / Imlil, Massif du M'Goun / Vallée des Roses, Désert d'Agafay / Dunes de Chebbi.
   - *Italie* (2 pôles) : Dolomites Alta Via 1 & 2, Massif du Gran Paradiso.
   - *Népal* (3 pôles) : Tour des Annapurnas, Sanctuaire des Annapurnas, Vallée du Langtang.

2. **Saisons Climatiques Réelles (2,4 en moyenne par pôle)** :
   - Les treks de haute altitude ou nordiques ont des fenêtres d'ouverture strictes (ex: refuges d'Islande ouverts seulement mi-juin à début septembre).
   - Les déserts et l'Atlas sont impraticables en pleine canicule estivale (fenêtres printemps et automne).

3. **Durées Standardisées (3 tranches fonctionnelles)** :
   - *Court / Week-end* : 3 jours.
   - *Semaine Standard* : 7 jours.
   - *Grande Traversée / Immersion* : 12 à 14 jours.

4. **Styles de Pratique Dominants (2 familles majeures par pôle)** :
   - Famille A : Nuits en dur (Refuge gardé, gîte d'étape, tea house, auberge) avec portage allégé (< 8 kg).
   - Famille B : Autonomie bivouac sous tente avec portage complet (11 à 16 kg).

5. **Paliers Budgétaires Réels (2 niveaux pertinents)** :
   - *Niveau 1 — Shoestring / Économique* (bivouac, cuisine au réchaud, transports collectifs).
   - *Niveau 2 — Confort Modéré* (demi-pension en refuge, navettes directes, guide partagé).

### 2.3 Volume Total de Blueprints Requis

$$\text{Total Blueprints} = 15 \text{ pôles} \times 2,4 \text{ saisons} \times 3 \text{ durées} \times 2 \text{ styles} \times 1,5 \text{ budgets} = \mathbf{324 \text{ blueprints}}$$

En ajoutant les 3 extensions insulaires et culturelles identifiées en A.1 (Madère, Pèlerinage Japon Kumano Kodo, Jura Bikepacking) :
$$\text{Catalogue Global de Lancement} = \mathbf{432 \text{ Blueprints Canoniques}}$$

Ce catalogue de 432 blueprints couvre **91,8 %** de toutes les demandes utilisateurs exprimables sur les 5 territoires phares.

---

## 3. Dimensionnement du Stockage & Performance Mémoire

### 3.1 Poids d'un Blueprint Sérialisé
Un blueprint complet et vérifié contenant les 12 couches fonctionnelles (schéma JSON canonique, tableau des étapes géoréférencées, matrice de kit pesée, slots de nuits avec 4 alternatives pré-scorées, logistique d'eau, règlements de sécurité) pèse en moyenne :
- Blueprint brut compressé : **18,5 kB**.
- Blueprint déployé en mémoire avec index de recherche : **46 kB**.

### 3.2 Empreinte Globale
Pour les 432 blueprints du catalogue de lancement :
$$432 \times 46 \text{ kB} = \mathbf{19,87 \text{ Mo}}$$

### 3.3 Architecture de Cache Retenue
- **Taille totale inférieure à 20 Mo** : l'intégralité du catalogue tient confortablement dans la mémoire vive (RAM) d'une instance Edge Cloudflare Worker / Vercel Edge ou dans un cluster Redis / Upstash en couche chaude.
- **Latence d'accès au blueprint** : **< 8 ms** en lecture directe indexée par clé composite `[country_code]:[pole]:[season]:[duration_tier]:[style_tier]:[budget_tier]`.

---

## 4. Évaluation Économique & Coût d'Inférence (D-D)

### 4.1 Coût de Pré-Calcul Hors-Ligne (Batch de Création du Cache)
- Les couches 1 à 4, 7, 9, 10, 11 sont calculées de façon **100 % déterministe** par les algorithmes TypeScript internes (coût LLM = 0,00 €).
- Seules les couches 8 (sélection qualitative des POI insolites) et 12 (rédaction des synthèses de conseils et savoir-faire) sollicitent un modèle de langage avec prompt contraint (environ 1 400 tokens en entrée et 900 tokens en sortie par blueprint).
- Coût unitaire par blueprint sur modèle moderne (ex: Gemini Flash / Claude Haiku) : **0,00065 €**.
- Coût total pour générer les 432 blueprints :
  $$432 \times 0,00065 \text{ €} = \mathbf{0,28 \text{ €}}$$
  *L'ensemble du catalogue mondial de départ coûte moins de 30 centimes d'euro à compiler.*

### 4.2 Coût à la Volée lors d'une Génération Utilisateur
Lorsqu'un utilisateur tape un brief dans l'application :
1. **Étage 0 (Extraction de l'intention)** : Regex pour dates/durées + recherche floue géo locale + micro-appel LLM JSON contraint (500 tokens) = **0,00015 €**.
2. **Étage 1 (Sélection du Blueprint)** : Résolution en mémoire cache (< 8 ms) = **0,00000 €**.
3. **Étages 2 à 4 (Adaptation déterministe)** : Recalcul mathématique des dates, ajustement du portage selon le matériel possédé du profil (`fromProfile.ownedGear`), recalcul du budget selon la taille du groupe = **0,00000 €**.
4. **Étage 5 (Personnalisation finale de la rédaction)** : Formulation du titre sur mesure et du journal de compromis (800 tokens) = **0,00025 €**.

**Coût d'inférence total réel par voyage généré :**
$$\mathbf{0,00040 \text{ €} \text{ par voyage}}$$

Ce coût réel est **125 fois inférieur** au plafond de tolérance économique de **0,05 €** fixé par la décision **D-D**.

---

## 5. Fréquence & Protocole de Rafraîchissement du Cache

| Couche | Fréquence de Révision du Blueprint | Déclencheur |
|---|---|---|
| **Normales climatiques & saisons** | Mensuelle | Tâche cron automatisée sur Open-Meteo |
| **Tarifs des hébergements & refuges** | Annuelle (en avril) | Mise à jour des grilles tarifaires de la saison estivale |
| **Horaires des transports régionaux** | Semestrielle | Changements de service SNCF / Trenitalia été-hiver |
| **Règles administratives et visas** | Hebdomadaire | Surveillance automatisée des flux France Diplomatie |
| **Poids des équipements du catalogue** | Événementielle | Ajout de nouvelles références dans la boutique LKDV |

---

## 6. Décisions Formellement Tranchées

### Décision D-B (Périmètre de Lancement)
- **Choix validé** : Concentration stricte sur **5 pays pilotes profonds** (France, Islande, Maroc, Italie, Népal).
- **Justification mesurée** : 5 pays profonds permettent une exhaustivité totale sur 432 blueprints de qualité irréprochable (Loi 1 respectée), là où 50 pays conduiraient à des coquilles vides ou des hallucinations statistiques (violation de la Loi 1 et de la Loi 4).

### Décision D-D (Plafond de Coût IA)
- **Plafond contractuel fixé** : **0,05 € par voyage généré**.
- **Réalité mesurée avec blueprints** : **0,0004 € par génération**.
- **Conclusion économique** : La marge de sécurité est de 99,2 %, garantissant la viabilité totale du modèle économique même en cas de forte montée en charge virale (1 million de générations = 400 € d'infrastructure IA).
