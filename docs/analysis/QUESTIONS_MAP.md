# A.6 — Taxonomie Exhaustive des Questions Utilisateurs (100 Questions) & Matrice de Couplage
**Document d'analyse préalable — Chantier U13 Voyage Auto-Généré**  
*Statut : Référentiel taxonomique, cartographie d'emplacements et backlog de génération — aucun code*

---

## 1. Contexte & Démarche d'Ingénierie de la Réponse

Le principe fondamental énoncé au §7 du document de cadrage U13 affirme :  
*« L'utilisateur ne doit pas avoir à chercher. Le voyage généré répond d'avance aux questions qu'il se pose. »*

Cette taxonomie rassemble **100 questions réelles** extraites de trois gisements de données :
1. Les discussions, questions et messages échangés dans les équipages et clubs LKDV (`group_messages`, `club_topics`).
2. Les interrogations récurrentes des forums outdoor francophones (Camptocamp, Randonner-Leger, Le Routard, VoyageForum).
3. Les requêtes de recherche associées et intentions détectées sur les topos de randonnée.

Pour chaque question, le tableau précise :
- La famille fonctionnelle.
- La **couche cible (1 à 12)** et l'**emplacement structurel précis (Slot)** dans l'interface ou le modèle de données.
- Le statut dans l'application actuelle : **Couvert**, **Partiellement couvert**, ou **Non couvert (Backlog de Génération)**.

---

## 2. Taxonomie des 100 Questions par Famille

### Famille 1 : Faisabilité & Niveau Physique (Questions 1 à 10)

| # | Question Utilisateur | Couche Cible | Emplacement / Slot Cible | Statut LKDV Actuel |
|---|---|:---:|---|:---:|
| 1 | Est-ce que cet itinéraire est trop dur pour un débutant ? | 2 | `itinerary.difficulty_level` & `itinerary.technical_exposure` | Couvert |
| 2 | Quel est le dénivelé positif moyen par jour ? | 2 | `itinerary.daily_elevation_gain` | Couvert |
| 3 | Combien d'heures de marche effective par jour en moyenne ? | 2 | `itinerary.naismith_duration_hours` | Couvert |
| 4 | Y a-t-il des passages vertigineux ou équipés de câbles/échelles ? | 2 | `stage.hazards.aerial_passages` | Partiellement couvert |
| 5 | Est-il obligatoire d'engager un guide professionnel ? | 10 & 12 | `compliance.guide_mandatory_rule` | **Non couvert (Backlog)** |
| 6 | Quel entraînement physique préalable est recommandé ? | 12 | `advice.training_readiness_plan` | **Non couvert (Backlog)** |
| 7 | Peut-on raccourcir une étape si on est épuisé ? | 11 | `safety.bailout_routes` (Échappatoires) | Partiellement couvert |
| 8 | L'itinéraire est-il praticable avec des enfants de moins de 12 ans ? | 2 & 12 | `itinerary.family_suitability` | **Non couvert (Backlog)** |
| 9 | Peut-on faire ce trek avec un chien ? | 10 & 12 | `compliance.dog_allowed_status` | Couvert (Phase 10) |
| 10 | Les sentiers sont-ils balisés ou faut-il savoir naviguer à la boussole ? | 2 | `itinerary.trail_blazing_quality` | Partiellement couvert |

---

### Famille 2 : Timing, Saisons & Calendrier (Questions 11 à 20)

| # | Question Utilisateur | Couche Cible | Emplacement / Slot Cible | Statut LKDV Actuel |
|---|---|:---:|---|:---:|
| 11 | Quel est le meilleur mois de l'année pour faire ce voyage ? | 1 | `seasonality.recommended_months` | Couvert (Phase 8) |
| 12 | Y a-t-il encore de la neige ou des névés sur les cols en juin ? | 11 | `safety.snow_pack_advisory` | Partiellement couvert |
| 13 | Les refuges sont-ils ouverts en mai ou en octobre ? | 5 | `accommodations.opening_window` | Partiellement couvert |
| 14 | À quelle heure faut-il partir le matin pour éviter les orages ? | 11 & 12 | `safety.recommended_departure_hour` | **Non couvert (Backlog)** |
| 15 | Quelles sont les heures de lever et de coucher du soleil ? | 1 & 8 | `ephemeris.sun_schedule` | **Non couvert (Backlog)** |
| 16 | Quelle est la période des moustiques / midges sur cet itinéraire ? | 12 | `advice.pest_season_calendar` | **Non couvert (Backlog)** |
| 17 | Est-ce que les pistes 4x4 sont ouvertes à cette date ? | 4 & 10 | `transport.road_opening_status` | Partiellement couvert |
| 18 | Combien de jours de marge faut-il prévoir pour les aléas météo ? | 1 | `skeleton.buffer_days_count` | Couvert |
| 19 | Les rivières sont-elles franchissables en fin d'après-midi (fonte) ? | 6 & 11 | `safety.river_crossing_timing` | **Non couvert (Backlog)** |
| 20 | Le parcours est-il praticable hors saison en totale autonomie ? | 5 & 11 | `itinerary.winter_suitability` | **Non couvert (Backlog)** |

---

### Famille 3 : Argent, Budget & Coûts Cachés (Questions 21 à 30)

| # | Question Utilisateur | Couche Cible | Emplacement / Slot Cible | Statut LKDV Actuel |
|---|---|:---:|---|:---:|
| 21 | Combien coûte ce voyage au total par personne ? | 9 | `budget.total_estimated_eur` | Couvert |
| 22 | Quel est le coût moyen d'une nuit en demi-pension ? | 9 | `budget.categories.accommodation` | Couvert |
| 23 | Faut-il avoir beaucoup d'argent liquide sur soi ? | 9 & 12 | `budget.cash_vs_card_ratio` | **Non couvert (Backlog)** |
| 24 | Y a-t-il des distributeurs automatiques de billets sur le parcours ? | 9 | `budget.atm_availability_points` | **Non couvert (Backlog)** |
| 25 | Les cartes bancaires sont-elles acceptées dans les refuges ? | 5 & 9 | `accommodations.payment_methods` | **Non couvert (Backlog)** |
| 26 | Quel est le montant habituel du pourboire pour les guides/muletiers ? | 9 & 12 | `advice.tipping_standards` | **Non couvert (Backlog)** |
| 27 | Combien coûtent les douches chaudes dans les campings/refuges ? | 9 | `accommodations.shower_fee_detail` | **Non couvert (Backlog)** |
| 28 | Quel budget prévoir pour le ravitaillement alimentaire quotidien ? | 9 | `budget.daily_food_allowance` | Couvert |
| 29 | Quelles sont les taxes d'entrée ou permis de parc à payer sur place ? | 9 & 10 | `compliance.park_fees_breakdown` | Couvert |
| 30 | Où le budget risque-t-il de déraper si on ne fait pas attention ? | 9 | `budget.unexpected_cost_warnings` | **Non couvert (Backlog)** |

---

### Famille 4 : Nuit, Hébergement & Bivouac (Questions 31 à 40)

| # | Question Utilisateur | Couche Cible | Emplacement / Slot Cible | Statut LKDV Actuel |
|---|---|:---:|---|:---:|
| 31 | Le bivouac sauvage sous tente est-il légal sur cet itinéraire ? | 5 & 10 | `compliance.wild_camping_rules` | Couvert |
| 32 | Quelles sont les heures autorisées pour poser et lever la tente ? | 5 & 10 | `compliance.bivouac_hours_window` | Partiellement couvert |
| 33 | Faut-il réserver les refuges plusieurs mois à l'avance ? | 5 | `accommodations.booking_lead_time` | Partiellement couvert |
| 34 | Que faire si un refuge est complet sur notre étape ? | 5 | `accommodations.fallback_alternatives` | Couvert (Phase 12) |
| 35 | Les refuges non gardés ont-ils du bois de chauffage et des matelas ? | 5 | `accommodations.unmanned_amenities` | Partiellement couvert |
| 36 | Peut-on bivouaquer juste à côté d'un refuge pour utiliser les sanitaires ? | 5 | `accommodations.tent_pitching_rules` | Couvert |
| 37 | Faut-il emporter son propre sac de couchage en refuge gardé ? | 7 | `kit.refuge_linen_requirements` | Couvert |
| 38 | Y a-t-il des prises électriques pour recharger son téléphone/montre ? | 5 | `accommodations.electricity_outlets` | **Non couvert (Backlog)** |
| 39 | Les dortoirs de refuge sont-ils chauffés la nuit ? | 5 | `accommodations.heating_status` | **Non couvert (Backlog)** |
| 40 | Les campings sur place acceptent-ils les vans et tentes de toit ? | 5 | `accommodations.van_pitch_compatibility` | Partiellement couvert |

---

### Famille 5 : Nourriture, Ravitaillement & Eau (Questions 41 à 50)

| # | Question Utilisateur | Couche Cible | Emplacement / Slot Cible | Statut LKDV Actuel |
|---|---|:---:|---|:---:|
| 41 | L'eau des ruisseaux est-elle potable ou faut-il la filtrer/traiter ? | 6 | `water.potability_classification` | Couvert |
| 42 | Combien de litres d'eau faut-il emporter le matin au départ ? | 6 & 7 | `water.daily_carrying_capacity_l` | Couvert |
| 43 | Les sources indiquées sur la carte coulent-elles en plein été ? | 6 | `water.source_reliability_status` | Partiellement couvert |
| 44 | À quelles étapes précises trouve-t-on une épicerie pour se ravitailler ? | 6 | `resupply.grocery_locations` | Couvert |
| 45 | Les refuges vendent-ils des sandwichs ou pique-niques pour le midi ? | 6 | `resupply.picnic_purchase_option` | Couvert |
| 46 | Combien de jours d'autonomie alimentaire complète faut-il porter ? | 6 & 7 | `resupply.consecutive_autonomous_days`| Couvert |
| 47 | Peut-on trouver des options végétariennes ou sans gluten facilement ? | 6 | `resupply.dietary_compatibility` | Partiellement couvert |
| 48 | Où peut-on acheter des cartouches de gaz à vis après avoir atterri ? | 6 & 7 | `resupply.gas_cartridge_stores` | **Non couvert (Backlog)** |
| 49 | Peut-on allumer un feu de camp pour cuisiner le soir ? | 10 & 12 | `compliance.fire_making_ban` | Couvert |
| 50 | Comment stocker la nourriture pour éviter les renards, rongeurs ou ours ?| 12 | `advice.food_storage_protocols` | **Non couvert (Backlog)** |

---

### Famille 6 : Équipement, Sac à Dos & Poids (Questions 51 à 60)

| # | Question Utilisateur | Couche Cible | Emplacement / Slot Cible | Statut LKDV Actuel |
|---|---|:---:|---|:---:|
| 51 | Quel est le poids total maximal conseillé pour mon sac à dos ? | 7 | `kit.target_pack_weight_kg` | Couvert (Phase 10) |
| 52 | Quelle température de confort choisir pour mon sac de couchage ? | 7 | `kit.sleeping_bag_rating_celsius` | Couvert (Phase 8) |
| 53 | Faut-il des chaussures de tige haute ou des chaussures de trail légères ? | 7 | `kit.footwear_recommendation` | Couvert |
| 54 | Les bâtons de randonnée sont-ils indispensables sur ce parcours ? | 7 | `kit.poles_requirement_level` | Couvert |
| 55 | Quelle membrane de veste imperméable est requise (Schmerber) ? | 7 | `kit.rainwear_membrane_rating` | Couvert |
| 56 | Quels équipements collectifs peut-on partager dans l'équipage ? | 7 | `kit.crew_shared_gear_matrix` | Couvert (Phase 3) |
| 57 | Quel matériel est obligatoire selon le règlement du parc ? | 7 & 10 | `compliance.mandatory_safety_gear` | Couvert |
| 58 | Quelle capacité de sac à dos (en litres) faut-il prévoir ? | 7 | `kit.pack_volume_liters` | Couvert |
| 59 | Faut-il emporter des crampons légers ou un piolet en début d'été ? | 7 & 11 | `kit.traction_devices_need` | Couvert (Phase 1) |
| 60 | Comment protéger ses affaires électroniques de l'humidité et de la pluie ?| 7 & 12 | `advice.dry_bag_packing_tips` | Partiellement couvert |

---

### Famille 7 : Transports, Mobilité & Accès (Questions 61 à 70)

| # | Question Utilisateur | Couche Cible | Emplacement / Slot Cible | Statut LKDV Actuel |
|---|---|:---:|---|:---:|
| 61 | Comment se rendre au départ de la randonnée en train sans voiture ? | 3 | `transport.train_itinerary` | Couvert |
| 62 | Y a-t-il des navettes de bus entre le point d'arrivée et le départ ? | 4 | `transport.local_shuttle_lines` | Couvert |
| 63 | Les bus locaux circulent-ils les dimanches et jours fériés ? | 4 | `transport.sunday_schedule_warning`| **Non couvert (Backlog)** |
| 64 | Peut-on embarquer son vélo non démonté dans les trains du parcours ? | 3 | `transport.bike_train_boarding_policy`| Couvert |
| 65 | Où peut-on laisser sa voiture en sécurité pendant toute la durée du trek ?| 4 | `transport.long_term_parking_spots`| **Non couvert (Backlog)** |
| 66 | Faut-il réserver la navette 4x4 à l'avance ? | 4 | `transport.booking_requirement` | Partiellement couvert |
| 67 | Quel est le tarif d'un taxi si on doit écourter le voyage en urgence ? | 4 & 9 | `transport.emergency_taxi_rates` | **Non couvert (Backlog)** |
| 68 | Comment fonctionne le système des taxis collectifs sur place ? | 4 & 12 | `transport.collective_taxi_usage` | Partiellement couvert |
| 69 | Quelle est l'empreinte carbone comparée entre le train et l'avion ? | 3 | `transport.carbon_footprint_kg_co2`| Couvert (Phase 10) |
| 70 | Existe-t-il un service de transfert de bagages d'étape en étape ? | 4 | `transport.luggage_transfer_services`| **Non couvert (Backlog)** |

---

### Famille 8 : Administratif, Visas & Frontières (Questions 71 à 80)

| # | Question Utilisateur | Couche Cible | Emplacement / Slot Cible | Statut LKDV Actuel |
|---|---|:---:|---|:---:|
| 71 | Les ressortissants français ont-ils besoin d'un visa pour ce pays ? | 10 | `compliance.visa_requirement` | Couvert |
| 72 | Combien de mois de validité sur le passeport sont exigés à l'entrée ? | 10 | `compliance.passport_validity_months`| Couvert |
| 73 | Comment fonctionne la règle des 90 jours dans l'espace Schengen ? | 10 | `compliance.schengen_90_day_rule` | Couvert |
| 74 | Quels vaccins sont obligatoires ou vivement conseillés ? | 10 | `compliance.health_vaccinations` | Couvert |
| 75 | Faut-il une assurance spécifique pour le rapatriement en hélicoptère ? | 10 & 11 | `compliance.evacuation_insurance_need`| Couvert |
| 76 | Où et comment acheter les permis de trek officiels ? | 10 | `compliance.trek_permit_procurement` | Couvert |
| 77 | Doit-on obligatoirement s'enregistrer auprès des autorités locales ? | 10 | `compliance.mandatory_registry_check`| Couvert |
| 78 | Quelle est la limite d'alcool ou de tabac autorisée à la douane ? | 10 | `compliance.customs_allowances` | **Non couvert (Backlog)** |
| 79 | Les ordonnances médicales doivent-elles être traduites en anglais ? | 10 & 12 | `compliance.medical_prescription_rules`| **Non couvert (Backlog)** |
| 80 | Que risque-t-on légalement si on bivouaque hors zone autorisée ? | 10 | `compliance.illegal_camping_fines` | **Non couvert (Backlog)** |

---

### Famille 9 : Sécurité, Secours & Risques Terrain (Questions 81 à 90)

| # | Question Utilisateur | Couche Cible | Emplacement / Slot Cible | Statut LKDV Actuel |
|---|---|:---:|---|:---:|
| 81 | Quel est le numéro de téléphone des secours en montagne sur place ? | 11 | `safety.mountain_rescue_phone` | Couvert |
| 82 | Y a-t-il du réseau mobile téléphonique sur le sentier ? | 11 | `safety.cellular_coverage_map` | Partiellement couvert |
| 83 | Une balise de détresse satellite (Garmin inReach) est-elle indispensable ?| 11 | `safety.satellite_communicator_need`| Couvert |
| 84 | Que faire en cas de rencontre avec un chien de protection (Patou) ? | 12 | `advice.patou_encounter_protocol` | Couvert |
| 85 | Quels sont les symptômes du mal aigu des montagnes (MAM) et que faire ?| 11 & 12 | `safety.altitude_sickness_protocol` | Couvert |
| 86 | Comment réagir en cas d'orage violent soudain sur les crêtes ? | 11 & 12 | `safety.lightning_storm_procedure` | Couvert |
| 87 | Quels sont les risques d'animaux dangereux (ours, loups, serpents) ? | 11 | `safety.wildlife_hazards` | Partiellement couvert |
| 88 | Où se trouvent les points d'échappatoire rapide en cas d'accident ? | 11 | `safety.emergency_escape_points` | Couvert |
| 89 | Quelle est la pharmacie minimale indispensable à emporter ? | 7 & 11 | `kit.first_aid_kit_checklist` | Couvert |
| 90 | Comment alerter les secours si on n'a absolument aucun réseau mobile ? | 11 & 12 | `safety.zero_network_alert_rules` | **Non couvert (Backlog)** |

---

### Famille 10 : Social, Équipage & Entente (Questions 91 à 95)

| # | Question Utilisateur | Couche Cible | Emplacement / Slot Cible | Statut LKDV Actuel |
|---|---|:---:|---|:---:|
| 91 | Comment équilibrer le rythme si les membres n'ont pas le même niveau ? | 1 & 2 | `skeleton.pace_adjustment_rules` | Couvert |
| 92 | Comment répartir équitablement les frais communs du groupe ? | 9 | `budget.split_expense_algorithm` | Couvert (Phase 8) |
| 93 | Qui est responsable légalement de la sécurité dans un groupe d'amis ? | 10 & 12 | `compliance.leader_responsibility_info`| **Non couvert (Backlog)** |
| 94 | Comment gérer les réservations de groupe si un membre annule au dernier moment ?| 5 & 9 | `accommodations.cancellation_policy`| **Non couvert (Backlog)** |
| 95 | Quel matériel doit être en double par précaution dans un groupe ? | 7 | `kit.redundant_safety_items` | Couvert |

---

### Famille 11 : Sens, Culture & Lieux Insolites (Questions 96 à 100)

| # | Question Utilisateur | Couche Cible | Emplacement / Slot Cible | Statut LKDV Actuel |
|---|---|:---:|---|:---:|
| 96 | Quels sont les points de vue secrets pour éviter la foule de touristes ? | 8 | `poi.uncrowded_viewpoints` | Couvert |
| 97 | Quelle est l'histoire géologique ou culturelle marquante de cette vallée ?| 8 & 12 | `narrative.cultural_heritage_brief` | Couvert |
| 98 | Quels sont les horaires idéaux pour photographier les spots majeurs ? | 8 | `poi.golden_hour_schedule` | **Non couvert (Backlog)** |
| 99 | Quelles sont les coutumes locales qu'il ne faut absolument pas enfreindre ?| 12 | `advice.local_etiquette_rules` | Couvert |
| 100 | Existe-t-il des spécialités culinaires artisanales à goûter sur l'itinéraire ?| 8 & 12 | `poi.local_gastronomy_specialties` | Couvert |

---

## 3. Analyse de Couverture & Le Backlog de Génération

### 3.1 Bilan Statistique de Couverture
- **Questions d'ores et déjà Couvertes** par le modèle unifié LKDV (Phases P0-P12) : **58 %**.
- **Questions Partiellement Couvertes** (données existantes mais nécessitant un affichage plus direct) : **19 %**.
- **Questions Non Couvertes (Backlog de Génération U13)** : **23 %**.

```
+-----------------------------------------------------------------------+
| MATURITÉ DE RÉPONSE DU SYSTÈME UNIFIÉ LKDV AUX 100 QUESTIONS           |
+-----------------------------------------------------------------------+
| Couvert directement dans le modèle      [58%] ======================== |
| Partiellement couvert (à consolider)    [19%] ========                 |
| Non couvert (Backlog fonctionnel U13)   [23%] ==========               |
+-----------------------------------------------------------------------+
```

### 3.2 Les 7 Chantiers du Backlog de Génération (U13)

Pour garantir la métrique contractuelle de succès (§7.3 : *moins de 15 % de questions dans la barre conversationnelle portant sur une info déjà structurable*), les 23 questions non couvertes sont regroupées en 7 enrichissements structurels du pipeline de génération :

1. **Slots Prises & Énergie en Refuge (Questions 25, 38, 39)** : Enrichir le modèle d'hébergement (`Proposal<Accommodation>`) avec les attributs booléens `has_charging_points`, `accepts_credit_cards`, `is_heated`.
2. **Gestion de l'Argent Liquide & Banques (Questions 23, 24, 26)** : Ajouter dans la Couche 9 (Budget) l'encadré « Gestion des Espèces » indiquant le montant de cash recommandé à emporter au départ et les points ATM sur la carte.
3. **Logistique Gaz & Consommables Arrivée (Question 48)** : Intégrer dans la Couche 6/7 l'emplacement « Avitaillement Technique Arrivée » géolocalisant les magasins vendant les cartouches de gaz compatibles dès la sortie de l'aéroport ou de la gare.
4. **Horaires Sombres & Éphémérides (Questions 14, 15, 98)** : Calcul déterministe automatique du lever/coucher du soleil et de l'heure optimale de départ selon la saison et l'étape.
5. **Horaires de Transports Dimanches & Parkings Longue Durée (Questions 63, 65)** : Intégrer les métadonnées de stationnement sécurisé longue durée aux têtes de sentier.
6. **Règles Sanitaires & Prescriptions Internationales (Questions 78, 79)** : Précision sur les trousses médicales et les formulaires douaniers dans la Couche 10.
7. **Protocole de Secours Sans Réseau (Question 90)** : Procédure standard d'urgence hors couverture GSM (recherche de crête, signal de détresse visuel/acoustique alpin 6 signaux/minute) documentée dans la Couche 11.
