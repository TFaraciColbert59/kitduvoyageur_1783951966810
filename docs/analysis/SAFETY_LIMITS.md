# A.9 — Analyse des Risques Terrain, Éthique & Limites Assumées du Produit
**Document d'analyse préalable — Chantier U13 Voyage Auto-Généré**  
*Statut : Doctrine de sécurité, analyse de responsabilité civile et lignes rouges produit — aucun code*

---

## 1. Contexte & Déclaration de Responsabilité

Générer automatiquement un voyage d'aventure pour un être humain comporte une responsabilité morale et juridique directe. Un itinéraire inadapté en haute montagne, un bivouac proposé en zone d'avalanche, un manque d'eau dans un désert ou une traversée de gué impraticable peuvent engager le pronostic vital des utilisateurs.

La **Loi 4** du Chantier U13 proscrit tout nombre inventé par un modèle de langage. Ce document va plus loin : il définit les **lignes rouges infranchissables**, les **refus catégoriques** du système et les **dégradations volontaires** appliquées pour protéger les personnes et les milieux naturels.

---

## 2. Recensement des Risques Majeurs

| Risque Identifié | Mécanisme Défaillant Potentiel | Conséquence Réelle pour l'Utilisateur | Gravité |
|---|---|---|:---:|
| **Engagement Alpin Inapproprié** | Proposition d'un itinéraire technique (alpinisme, glacier, barres rocheuses exposées) à des randonneurs sans matériel ni formation. | Chute mortelle, blocage en paroi, panique, hélitreuillage de secours. | **VITAL** |
| **Col Fermé / Enneigement Tardif** | Génération d'une étape par un col d'altitude en mai/juin sans avertissement de névés raides gelés. | Glissade mortelle sur névé dur, hypothermie par demi-tour forcé en crête. | **VITAL** |
| **Bivouac Forain Hors-la-Loi** | Recommandation d'un bivouac sous tente dans un parc national strict ou sur terrain privé sans accord. | Amende lourde (135 € à 1 500 €), expulsion nocturne par les gardes, incendie involontaire. | Élevé |
| **Rupture d'Eau en Climat Aride** | Omission d'une étape sans aucune source d'eau potable au Maroc ou dans le Sud de l'Islande. | Déshydratation sévère, coup de chaleur, détresse médicale en zone isolée. | **VITAL** |
| **Mal Aigu des Montagnes (MAM)** | Génération d'un dénivelé positif > 800 m/jour au-dessus de 3 000 m sans jour de repos obligatoire. | Œdème pulmonaire de haute altitude (OPHA) ou cérébral (OPCA), urgence vitale. | **VITAL** |
| **Surtourisme & Destruction de Milieu** | Publication des coordonnées GPS exactes au mètre près d'un spot naturel minuscule et fragile. | Piétinement des mousses millénaires, déchets, dégradation irréversible du biotope. | Élevé |

---

## 3. Les Cinq Refus Catégoriques du Produit (Ce que LKDV refuse de générer)

Ces refus constituent des choix délibérés d'entreprise, assumés publiquement face à l'utilisateur :

```
+-------------------------------------------------------------------------------+
| LES 5 LIGNES ROUGES INFRANCHISSABLES DE LA GÉNÉRATION LKDV                    |
+-------------------------------------------------------------------------------+
| 1. REFUS DE L'ALPINISME GLACIAIRE TECHNIQUE                                  |
|    --> Pas d'itinéraire exigeant corde, piolet technique ou broche à glace   |
+-------------------------------------------------------------------------------+
| 2. REFUS DES ZONES GÉOPOLITIQUES ROUGES (FRANCE DIPLOMATIE)                   |
|    --> Blocage catégorique de tout voyage en zone formellement déconseillée  |
+-------------------------------------------------------------------------------+
| 3. REFUS DE L'ÉVALUATION DU RISQUE AVALANCHE PAR IA                          |
|    --> Aucune estimation propre. Renvoi exclusif vers le bulletin officiel   |
+-------------------------------------------------------------------------------+
| 4. REFUS DU DIAGNOSTIC ET DE LA PRESCRIPTION MÉDICALE                         |
|    --> Jamais de posologie médicamenteuse. Renvoi vers la consultation santé |
+-------------------------------------------------------------------------------+
| 5. REFUS DE LA FACILITATION DU BIVOUAC ILLÉGAL                                |
|    --> Zéro suggestion de tente dans les réserves intégrales et zones closes |
+-------------------------------------------------------------------------------+
```

### Refus 1 — Voies d'Alpinisme et Terrains Glaciaires Crevassés
- Le système refuse de générer des itinéraires classés F+ (Facile supérieur), PD (Peu Difficile) ou plus selon l'échelle UIAA, nécessitant la technique de l'encordement glaciaire (ex: Voie Normale du Mont-Blanc, Dôme de Neige des Écrins, Traversée des arêtes de la Meije).
- *Réponse du système* : « *Cet itinéraire relève de l'alpinisme engagé et ne peut pas être planifié par un système automatique sans guide de haute montagne. Nous vous orientons vers la Compagnie des Guides de Chamonix ou le Syndicat National des Guides de Montagne.* »

### Refus 2 — Zones Géopolitiques à Risque Majeur (Zones Rouges)
- Synchronisation continue avec le flux officiel Conseils aux Voyageurs de France Diplomatie.
- Si une destination ou une portion de frontière se situe en zone rouge (« Formellement déconseillé »), la génération est immédiatement bloquée.
- *Réponse du système* : « *Cette région fait l'objet d'une alerte sécuritaire majeure des autorités consulaires. LKDV ne génère aucun plan d'expédition sur ce territoire.* »

### Refus 3 — Évaluation Propriétaire du Risque Avalanche / Crues
- Aucun modèle de langage ni aucun algorithme interne ne doit jamais formuler : *« Le manteau neigeux est stable aujourd'hui »* ou *« Vous pouvez traverser le col sans danger »*.
- Seules les sources habilitées (Météo France - BERA, Institut pour l'Étude de la Neige et des Avalanches SLF en Suisse, Safetravel en Islande) sont affichées avec leur date exacte d'émission.

### Refus 4 — Diagnostic Médical & Prescription de Médicaments
- Conformément à l'article L4161-1 du Code de la Santé Publique relatif à l'exercice illégal de la médecine, le système refuse toute recommandation personnalisée de médicaments d'ordonnance (ex: acétazolamide / Diamox pour le mal des montagnes, antibiotiques d'urgence).
- Le système liste uniquement les règles d'acclimatation physique universelles (500m D+/jour max au-delà de 3000m) et les vaccins réglementaires exigés par le pays hôte.

### Refus 5 — Incitation ou Localisation de Bivouacs Interdits
- Le moteur vérifie l'intersection géospatiale de chaque nuit proposée avec les polygones des zones protégées (Cœur de Parc National Vanoise/Pyrénées, réserves biologiques intégrales, forêts périurbaines sous arrêté préfectoral estival de risque d'incendie).
- Aucune nuit en tente sauvage n'est proposée si l'interdiction est totale : le système impose un refuge gardé officiel ou une aire de camping autorisée.

---

## 4. Les Dégradations Volontaires Déontologiques

### 4.1 Protection des Sites Fragiles : Coordonnées Dégradées (Loi 8.2)
Pour lutter contre l'impact destructeur de la surfréquentation touristique alimentée par les réseaux sociaux :
- Les cascades secrètes, grottes délicates, zones de nidification de rapaces menacés et tourbières fragiles conservent un **floutage géographique volontaire d'un rayon de 1,5 km**.
- Le système refuse de fournir le point GPS au mètre près, tant à l'écran que dans tous les exports de fichiers GPX, KML ou GeoJSON.

### 4.2 Bridage d'Intensité Physique des Profils Débutants
Si un utilisateur déclarant une pratique occasionnelle ou débutante saisit un brief disproportionné (ex: *« 35 km et 1800 m D+ par jour pendant 5 jours »*) :
- Le solveur de contraintes (Étage 4) dégrade automatiquement le parcours en insérant des étapes intermédiaires ou en suggérant un itinéraire adapté.
- Un journal de compromis explicite s'affiche : *« Votre profil indique une première expérience en montagne. Pour votre sécurité physique, nous avons calibré les étapes à 14 km et 750 m D+ maximum par jour. »*

---

## 5. Avertissement Légal Permanent (Disclaimer Déontologique)

Chaque voyage généré par le Chantier U13 arbore sur son cockpit et sur ses documents d'export l'avertissement permanent suivant :

> **Mentions Légales & Sécurité Outdoor :**  
> *Ce voyage est une proposition automatique élaborée à partir de données cartographiques et de référentiels de terrain. La montagne et les grands espaces naturels présentent des dangers objectifs (météo changeante, chutes de pierres, orages, crues subites, isolement). Les conditions réelles sur le terrain, les consignes des gardiens de refuge, des professionnels de la montagne et les arrêtés préfectoraux officiels prévalent en toutes circonstances sur les propositions de cette application. L'utilisateur demeure seul responsable de ses décisions d'engagement, de sa sécurité et du respect des règles environnementales.*
