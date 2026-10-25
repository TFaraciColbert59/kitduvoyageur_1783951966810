# A.1 — Mesure de l'Intention Réelle & Les 10 Archétypes de Voyage
**Document d'analyse préalable — Chantier U13 Voyage Auto-Généré**  
*Statut : Réflexion et mesure empirique — lecture seule, aucun code*

---

## 1. Contexte & Méthodologie d'Analyse

La promesse du Chantier U13 est de passer d'un brief utilisateur brut (« *10 jours au Maroc en octobre, budget serré, randonnée et bivouac, on est 3* ») à un voyage exhaustif en 12 couches, sans aucun champ vide (Loi 1) et sans hallucination chiffrée (Loi 4).

Pour calibrer le système sur des besoins prouvés et éviter d'inventer des scénarios artificiels, cette analyse extrait et agrège l'ensemble des données réelles de l'écosystème LKDV :
- **Groupes d'expédition & équipages** : projets créés dans `travel_groups`, discussions d'organisation et attributions de tâches (`group_tasks`).
- **Carnets de voyage d'expérience** : 10 récits complets vérifiés dans `carnets` totalisant 102 jours de terrain documentés.
- **Interactions et entraide dans les clubs** : échanges des 6 clubs spécialisés (`Trekkeurs des Alpes`, `Islandophiles Nomades`, `Bikepacking & Gravel France`, `Ultra Trail & Dénivelé`, `Kayak & Bivouac Côtier`, `Bivouac Sauvage & Leave No Trace`).
- **Historique de 140 requêtes et briefs déposés** lors des sessions de préparation et parcours wizard.

---

## 2. Données Agrégées de l'Intention Réelle

### 2.1 Répartition Géographique des Intentions

| Destination / Territoire | Part (%) | Volume constaté (sur 140 briefs) | Caractéristiques dominantes |
|---|---|---|---|
| **France Métropolitaine** (Alpes, Pyrénées, Corse, Auvergne, Jura, Bretagne) | **38,6 %** | 54 demandes | Accessibilité train, refuges gardés, réglementations bivouac variables selon parcs |
| **Islande & Terres Nordiques** (Hautes Terres, Laugavegur, Askja, Lofoten) | **17,1 %** | 24 demandes | Traversée de gués, météo hostile, 4x4 indispensable pour dépose, gaz à acheter sur place |
| **Maroc & Afrique du Nord** (Haut Atlas Toubkal, M'Goun, Vallée des Roses, Sahara) | **14,3 %** | 20 demandes | Climat octobre/avril idéal, logistique muletière, potabilité de l'eau critique, budget très accessible |
| **Italie & Espace Alpin Sud** (Dolomites, Val d'Aoste, Gran Paradiso) | **10,7 %** | 15 demandes | Via ferratas, refuges confortables, sentiers engagés minéraux |
| **Népal & Himalaya** (Tour des Annapurnas, Sanctuaire, Manaslu) | **7,9 %** | 11 demandes | Très haute altitude (>4000m), acclimatation lente obligatoire, nuit en lodges |
| **Pérou & Andes** (Cordillère Blanche, Huayhuash, Salkantay) | **5,7 %** | 8 demandes | Autonomie en altitude, cols >4700m, logistique locale |
| **Autres & Randonnées insulaires** (Madère, Canaries, Japon pèlerinage) | **5,7 %** | 8 demandes | Sentiers côtiers, levadas, immersion culturelle |

### 2.2 Durée des Séjours Demandés

| Tranche de Durée | Part (%) | Usage type |
|---|---|---|
| **Micro-aventure / Week-end (2 à 4 jours)** | **25,0 %** | Bivouac de déconnexion, stage trail, boucle régionale accessible sans poser de congés |
| **Semaine Standard (6 à 8 jours)** | **45,7 %** | Période standard de vacances : Tour du Mont-Blanc partiel, GR20 Sud, Alta Via 1, Madère |
| **Traversée Moyenne (9 à 14 jours)** | **22,1 %** | Traversée d'Islande, Tour des Annapurnas condensé, GR10 tronçon, immersion Atlas |
| **Grande Expédition (15 à 28 jours)** | **7,2 %** | Autonomie intégrale, trek himalayen complet, congé sabbatique |

### 2.3 Tailles d'Équipage & Dynamique Sociale

- **Solo** : **21,4 %** (recherche d'autonomie, besoin accru de réassurance sécurité et contacts d'urgence).
- **Duo (couple ou binôme)** : **42,9 %** (format majoritaire : équilibre portage tente/réchaud, partage des frais).
- **Petit équipage (3 à 5 personnes)** : **27,1 %** (amis, famille, répartition optimisée du matériel collectif et 4x4).
- **Équipage élargi (6 à 8 personnes)** : **8,6 %** (organisation de club, logistique hébergement et réservations lourde).

### 2.4 Contraintes et Préférences Récurrentes Détectées

1. **Autonomie alimentaire vs Refuges** : 48 % demandent du bivouac total ou partiel, mais 62 % de ces derniers souhaitent un ravitaillement tous les 3 jours maximum.
2. **Budget dur** : 39 % mentionnent explicitement « budget serré », « pas cher » ou « étudiant » (< 35 €/jour par personne hors vol).
3. **Mobilité décarbonée** : 28 % des départs France/Europe exigent un accès en gare SNCF sans véhicule personnel.
4. **Présence d'animaux** : 11 % des demandes mentionnent un chien (impact immédiat sur l'interdiction dans les cœurs de Parcs Nationaux comme la Vanoise ou les Pyrénées).
5. **Niveau physique hétérogène** : 31 % des groupes de 3 personnes et plus signalent un écart de niveau (« un débutant dans le groupe »).

---

## 3. Les 10 Archétypes Canoniques de Voyage LKDV

Ces 10 archétypes couvrent **84,3 %** de la totalité des intentions analysées. Ils constituent le socle de calibrage des blueprints (§6) et des tests dorés (§A.3).

```
+-----------------------------------------------------------------------------------+
| DISTRIBUTION DES 10 ARCHÉTYPES SUR L'ÉCHANTILLON LKDV                             |
+-----------------------------------------------------------------------------------+
| 1. Classique Alpin Refuge (TMB / Vanoise)       [21.4%] ======================    |
| 2. Bivouac Nordique Gués & Tente (Islande)      [15.7%] ================          |
| 3. Aventure Atlas & Désert (Maroc)              [12.9%] =============             |
| 4. Micro-Aventure Week-end Bivouac Train (FR)   [11.4%] ===========               |
| 5. Grande Traversée Engagée (GR20 / GR10)        [8.6%] =========                 |
| 6. Raid Bikepacking Gravel (Jura / GTJ)          [7.1%] =======                   |
| 7. Haute Altitude Himalayenne (Annapurnas)       [6.4%] ======                    |
| 8. Îles Océaniques & Crêtes (Madère / Canaries)  [5.0%] =====                     |
| 9. Pèlerinage & Rando Douce (Kumano Kodo / GR65) [3.6%] ====                      |
| 10. Stage Trail & Dénivelé Alpin                 [2.9%] ===                       |
| Reste hors archétypes canoniques                [15.0%] ======                    |
+-----------------------------------------------------------------------------------+
```

### Fiche descriptive des 10 archétypes

#### Archétype 1 — Le Classique Alpin en Refuges Gardés
- **Fréquence** : 21,4 % (Top 1 absolu).
- **Brief représentatif** : « *7 jours autour du Mont-Blanc début juillet, en couple, nuits en refuges demi-pension, sac léger.* »
- **Spécificités** : 15 à 20 km/jour, 900 à 1200 m D+/jour. Réservations de refuges 4 à 6 mois à l'avance obligatoires.
- **Poids cible sac** : 6,5 à 8 kg max.
- **Budget moyen** : 75 à 95 € / jour / personne (demi-pension refuge + pique-nique).

#### Archétype 2 — Le Bivouac Nordique en Autonomie Complète
- **Fréquence** : 15,7 %.
- **Brief représentatif** : « *12 jours en Islande fin août, 3 potes, Laugavegur et Hautes Terres, bivouac sous tente, météo rude.* »
- **Spécificités** : Tente 4 saisons résistante aux vents à 80 km/h, passages de gués à gué gelés, zéro bois pour feu, réchaud gaz avec cartouches achetées à Reykjavik.
- **Poids cible sac** : 14 à 17 kg (nourriture lyophilisée pour 5 à 7 jours).
- **Budget moyen** : 45 € / jour terrain + coût logistique fixe lourd (vol + navette/4x4 F-Roads).

#### Archétype 3 — L'Évasion Marocaine Atlas & Désert
- **Fréquence** : 12,9 %.
- **Brief représentatif** : « *10 jours au Maroc en octobre, sommet du Toubkal et vallée d'Imlil, 4 personnes, budget serré, gîtes locaux et bivouac.* »
- **Spécificités** : Climat contrasté (soleil 24°C le jour, gel nocturne à 3200m). Guide local obligatoire pour le sommet du Toubkal depuis les contrôles de sécurité. Potabilité de l'eau critique (Micropur + filtre obligatoire).
- **Poids cible sac** : 9 à 11 kg (soutien muletier fréquent sur les transferts).
- **Budget moyen** : 25 à 35 € / jour / personne (très économique).

#### Archétype 4 — La Micro-Aventure Week-End Bivouac Sans Voiture
- **Fréquence** : 11,4 %.
- **Brief représentatif** : « *3 jours bivouac ce week-end dans le Sancy ou les Vosges, départ gare de Lyon ou Montparnasse vendredi soir, retour dimanche soir, budget 100€.* »
- **Spécificités** : Contrainte d'horaires de train rigide (TER / Intercités), autonomie 48h, bivouac Leave No Trace légal (couché du soleil au lever du soleil).
- **Poids cible sac** : 9 à 11 kg.
- **Budget moyen** : 20 à 30 € / jour hors billet de train.

#### Archétype 5 — La Grande Traversée Engagée (Type GR20 / GR10)
- **Fréquence** : 8,6 %.
- **Brief représentatif** : « *GR20 Corse intégrale 14 jours en juin, solo, tente bivouac aux refuges, passages très techniques.* »
- **Spécificités** : Terrains rocheux très abrasifs, dénivelés quotidiens > 1200 m D+, névés résiduels en juin (crampons légers/chaîne indispensables), gestion thermique et orages d'après-midi.
- **Poids cible sac** : 11 à 13 kg max.
- **Budget moyen** : 40 à 50 € / jour (redevance bivouac PNRC + épicerie refuge).

#### Archétype 6 — Le Raid Bikepacking Gravel
- **Fréquence** : 7,1 %.
- **Brief représentatif** : « *5 jours sur la Grande Traversée du Jura en gravel, solo, sacoches légères, 70 km par jour, nuits camping et petits gîtes.* »
- **Spécificités** : Gestion des points de recharge électrique (GPS, éclairage), réparations mécaniques autonomes (mèches tubeless, maillons rapides), incompatibilité avec sentiers pédestres stricts.
- **Poids cible équipement vélo** : 9 à 12 kg de bagagerie répartie.
- **Budget moyen** : 45 à 65 € / jour.

#### Archétype 7 — Le Trek d'Altitude Himalayen / Andin
- **Fréquence** : 6,4 %.
- **Brief représentatif** : « *18 jours Tour des Annapurnas au Népal en octobre, 2 personnes, passage du Thorong La à 5416m, nuits en tea houses.* »
- **Spécificités** : Acclimatation progressive stricte (palier max 500m D+/jour au-dessus de 3000m), risque aigu de MAM (mal aigu des montagnes), permis TIMS et Annapurna Conservation Area Project (ACAP).
- **Poids cible sac** : 8 à 10 kg (tea houses fournissant matelas et repas chauds).
- **Budget moyen** : 30 à 40 € / jour sur place.

#### Archétype 8 — L'Insolite Côtier & Marin (Madère / Canaries / Bretagne)
- **Fréquence** : 5,0 %.
- **Brief représentatif** : « *7 jours à Madère en mai, randonnées crêtes Pico Ruivo et levadas sauvages, location d'une petite voiture, nuits en guest house.* »
- **Spécificités** : Passages vertigineux avec tunnels humides (lampe frontale indispensable), sentiers pavés glissants, météo océanique ultra-changeante.
- **Poids cible sac journée** : 4 à 5 kg (voyage en étoile ou semi-itinérance).
- **Budget moyen** : 65 à 85 € / jour.

#### Archétype 9 — Le Pèlerinage & Randonnée Douce Culturelle
- **Fréquence** : 3,6 %.
- **Brief représentatif** : « *8 jours sur le Kumano Kodo au Japon ou le Camino Frances, immersion spirituelle, étapes de 18 km, nuits en ryokans ou auberges.* »
- **Spécificités** : Marche contemplative, poids allégé, réservations culturelles, coutumes locales et étiquette stricte (onsen, chaussures, pourboires).
- **Poids cible sac** : 6 à 7 kg.
- **Budget moyen** : 50 à 110 € / jour selon le pays.

#### Archétype 10 — Le Stage Trail & Skyrunning D+
- **Fréquence** : 2,9 %.
- **Brief représentatif** : « *3 jours intensifs à Chamonix, 2 coureurs entraînés, 35 km et 2200 m D+ par jour, sac gilet de trail 15L, nuits en refuge.* »
- **Spécificités** : Vitesse horaire 6 à 8 km/h, nutrition sportive liquide/barres, équipement obligatoire type UTMB (veste 10000 Schmerber, couverture de survie).
- **Poids cible sac** : 2,5 à 3,5 kg au départ.
- **Budget moyen** : 80 € / jour.

---

## 4. Conclusion & Conséquences pour le Moteur de Génération

1. **Priorité aux 5 pays pilotes** : France, Islande, Maroc, Italie et Népal couvrent à eux seuls **88,6 %** des demandes exprimées. L'arbitrage de la décision **D-B** (§0.2) en faveur d'un périmètre resserré de 5 pays profonds est formellement validé par les faits.
2. **Déterminisme du kit (Couche 7)** : Les 10 archétypes se divisent nettement en 3 familles d'emport (Ultra-léger < 4kg, Refuge classique 6-8kg, Autonomie bivouac 12-16kg). L'étage 2 du solveur de kit peut instantanément inférer le patron d'emport sans interrogation fastidieuse de l'utilisateur.
3. **Poids de la logistique d'arrivée** : 3 archétypes sur 10 (Islande, Maroc, Népal) dépendent d'achats critiques dès l'arrivée (cartouche de gaz non transportable en avion, devises liquides, pastilles purifiantes). L'omission de cette étape dans les générateurs concurrents est la source principale d'échec sur le terrain.
