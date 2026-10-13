# Compas — écarts avec la maquette finale

Maquette : `LKDV_Compas.html` (reçue le 2026-10-01, artifact claude.ai `UWNBMHf4wbmKnWRACh4FLd`). 88 interactions, 5 étapes, tiroirs à onglets. Comparaison faite dans Chromium 390×844, maquette et Compas côte à côte.

Règles qui priment sur la maquette (décisions de Tony, `CLAUDE.md`, `REPRISE_CLAUDE_CODE.md`) :
- **aucune donnée inventée** : la maquette tourne sur des données d'exemple, le Compas sur les vraies ; un écran sans donnée dit « non renseigné » ;
- **pas de score unique** (la maquette affiche « 56 sur 100 ») ;
- **`/hub` seul gère le groupe** (invitations, rôles d'équipe) : le Compas y renvoie ;
- **aucun paiement sans geste explicite** ; RouteStack en lecture seule.

Légende : ✅ fait · 🟡 partiel · ⬜ à faire · ⛔ écart volontaire (règle ci-dessus).

## Chrome et matériau
| Élément de la maquette | État | Note |
|---|---|---|
| Capsule d'étapes (icône + libellé, lentille, point de décision) | ✅ | |
| Couche lumineuse sur les barres posées sur le paysage | ✅ | 2026-10-01 |
| Barre d'onglets en verre clair, onglet actif vert | ✅ | onglets de l'app inchangés (⛔ Explorer / Compas / Matériel / Hub / Recherche) |
| Accessoire au-dessus de la barre (altitude max + profil) | ✅ | profil réel (Open-Meteo, Copernicus GLO-90, 80 points), glisser ou flèches pour lire ; sans profil : D+ et km |
| Barre d'onglets qui se réduit au défilement | ✅ | défiler un tiroir vers le bas : seul l'onglet actif reste (portée Compas, navigation de l'app intacte) |
| Lentille qui suit le doigt (maintenir et glisser) | ✅ | glisser sur la capsule : la lentille suit, l'étape sous elle est choisie au relâchement |
| Îlot dynamique : prochaine décision, appliquer | 🟡 | capsule au-dessus de la barre d'onglets : « Voir » toujours, « Appliquer » seulement pour « Répartir le matériel commun » (calcul sûr, annulable) ; les autres décisions demandent un choix ou engagent de l'argent : « Voir » seulement. Rendu à vérifier sur appareil. |
| Annuler (îlot, Ctrl/⌘+Z, deux doigts vers la gauche) | ✅ | « Annuler » dans l'annonce, Ctrl/⌘+Z, deux doigts vers la gauche : activité, préférences, enveloppe, décalage de dates, « Dis-le » quand l'inverse est sûr |
| Mode extérieur + intensité du verre (☀) | ✅ | |

## Où
| Élément | État | Note |
|---|---|---|
| « Dis-le » sur la carte | ✅ | |
| Règle de durée | ✅ | piste remplie (sage) jusqu'au curseur |
| Lignes Activité · Parcours · Quand · Préférences · Sac | ✅ | |
| Tiroir « Préparer » : Activité · Parcours · Quand · Préférences · Sac | ✅ | onglet « Sur le tracé » conservé en dernier (données réelles) |
| Activités en tuiles (grille 4 colonnes) | ✅ | description de l'activité choisie en note |
| Quand : calendrier des conditions, heure par heure, passage à chaque étape | ✅ | calendrier et heure par heure faits ; heure de passage estimée par étape (DIN 33466 / vitesse type), « non renseigné » sans départ, distance ou allure. Reste : enregistrer l'heure de départ (aujourd'hui `start_time` d'une étape, ou simulation locale). |

## Nous
| Élément | État | Note |
|---|---|---|
| Avatars, niveau, « en ligne » | 🟡 | tiroir Équipe, en lecture : rôle et niveau en pastilles (« estimé » quand il vient de l'orientation déclarée), allure (« mesurée » quand apprise), « non renseigné » sinon ; les moyennes de population du profil du voyage (`sources = average`) ne passent plus pour celles de la personne. Présence = « dans le voyage » ; invitations sans réponse listées à part. **« En ligne » non branché** : aucune source de présence en base (Realtime Presence demanderait un consentement et une politique RLS : à décider) |
| Qui : ajouter par @pseudo, glisser pour retirer | ⛔/🟡 | gestion du groupe = `/hub/groupe` (bouton Hub) |
| Niveaux calculés (sorties, D+ moyen, allure, fiabilité) | 🟡 | allure et niveau dans « Équipe » ; les sorties des autres membres (`hike_sessions`, RLS « own ») ne sont pas lisibles sans leur consentement : à cadrer avec l'Empreinte (`get_user_signature`) |
| Rôles (pilules) | ✅ | pastille de rôle en lecture (Organisateur, Peut modifier, Lecture seule, Membre du groupe) ; renvoi « Gérer le groupe dans le Hub » (`/hub/groupe`). L'onglet « Qui » est désormais en lecture (membres, rôles, invitations sans réponse) avec le même renvoi vers `/hub/groupe` : plus aucune commande d'équipe dans le Compas (lot AF) |
| Budget : postes, plafond par personne, partage, qui doit quoi | ✅ | enveloppe, postes réels par catégorie, « + Ajouter une dépense » (groupe / par pers. × taille réelle, prévue / payée), qui doit quoi |
| Paliers Serré / Confort / Libre | ⛔ | montants inventés |
| Annonce (publier pour trouver des compagnons) | ✅ | onglet « Annonce » : mène à la Bouteille à la mer du pays (`/pays/xx?section=communaute`) et au Hub ; le Compas ne publie rien (règle `/hub`) |

## Résa
| Élément | État | Note |
|---|---|---|
| Six catégories (Randos, Activités, Nuits, Vols, Trajets, Extras) | ✅ | réservations réelles et offres partenaires classées (`engine/resaCats.ts`) ; Randos ouvre Parcours, Nuits les nuits, les autres leurs offres filtrées ; catégorie vide grisée |
| Jours avec cases (H, T, A…) | ✅ | |
| Résumé choisies · à réserver · en attente | ✅ | |
| Mes réservations : Mes choix · États | ✅ | tiroir « Mes réservations » ; « Réservations » tient lieu de « Mes choix » ; « États » compte les réservations réelles par état et les nuits à trouver |

## Verdict
| Élément | État | Note |
|---|---|---|
| Jauge « sur 100 » | ⛔ | pas de score unique |
| Risques (barres par risque, source datée) | ✅ | trois barres (physique / technique / conjoncturel), niveaux faible / modéré / élevé / non évalué, sans score, source et date par barre. Pas d'avalanche ni d'altitude : le moteur n'en tire aucun signal. |
| Météo (jours, vent) | ✅ | par jour du voyage : ciel, min/max, pluie, rafales, isotherme 0 °C ; source et horizon affichés |
| Veille (règles, alertes proposées) | ✅ | seuils réels du moteur (`engine/watch.ts`) ; décalage proposé seulement sur prévision, appliqué au geste « Décaler » |
| Sources + fraîcheur | ✅ | alertes officielles Meteoalarm branchées |

## Kit
| Élément | État | Note |
|---|---|---|
| Répartition base / consommable / porté | ✅ | |
| Prêt sur les points vérifiés + % | ✅ | |
| Charge par membre (barre / limite) | ✅ | barre + phrase (« porte 9 kg sur 14 kg (repère moyen) »), jamais de barre ni de pourcentage sans capacité. La limite du profil du voyage est un repère de population (20 % d'un poids moyen), dit comme tel |
| Inventaire (catégories, appui long : fiche) | ✅ | onglet « Inventaire » : inventaire réel par catégorie, « Dans le kit » ouvre la fiche, « Ajouter » sinon ; prêté, entretien dû, périmé affichés |
| Manques : Emprunter · Louer · Acheter, boutique | ✅ | nombre de choix et phrase par mode ; louer : total pour les jours DATÉS du voyage (« 6 € / jour · 5 jours = 30 € »), durée non datée dite ; acheter : prix, occasion, écart de poids avec l'objet prévu quand les deux poids sont connus ; emprunter : l'équipe (son inventaire est privé, dit). Rien ne se paie ici : « Choisir » relie et remplit le panier |
| Eau par personne (minimum, contenants, points d'eau) | ✅ | onglet « Eau » : repère par heure de marche jour par jour, contenants au volume écrit (`engine/water.ts`), points d'eau OSM du tracé |
| Appui long : fiche, historique, commandes | ✅ | fiche en grand (onglets Fiche · Historique) ; historique lu sous la RLS : prêts (`materiel_loans`), autres voyages où l'objet est parti, commandes du produit choisi ; source illisible nommée, « aucun événement enregistré » sinon |
| Double-touche pour choisir, glisser à gauche pour retirer | ✅ | double-touche = « Choisir » un produit / « Noter » une offre d'hébergement (comme la maquette : offre ou produit) ; glisser à gauche : « Retirer » apparaît, second geste requis |

## Carte
| Élément | État | Note |
|---|---|---|
| Carte claire, tracé, étapes numérotées, D / A | ✅ | pastilles de la maquette : D (sauge), numéros (blanc cerclé), A (vert forêt), éléments DOM nommés de 44 px ; une étape seule est « 1 » |
| Contrôles (couches, recentrer) | ✅ | agrandir, recentrer, calques |
| Personnaliser la carte (couches) | ✅ | calques réels (étapes, eau, refuges, camping, vues, sommets, parkings, profil) avec leur nombre ; calque vide grisé ; « Carte nue » / « Tout afficher » ; retenu sur l'appareil. Fond Relief / Clair / Satellite : ArcGIS Location Platform, le branchement de `/explorer` (clé publique, « Powered by Esri »), retenu sur l'appareil |
| Encart du point touché (callout) | ✅ | capsule de verre de la maquette : titre, jour · distance · dénivelé · nuit (parties absentes omises), « Voir dans Parcours », fermer. Rendu mesuré dans Chromium (captures), à revoir sur appareil |

## Création d'aventure
| Élément | État | Note |
|---|---|---|
| Le Compas est le seul préparateur | ✅ | Compas vide au premier passage, le premier geste crée l'aventure ; anciens préparateurs supprimés |

## Bureau et tablette (768 px et plus)
| Élément | État | Note |
|---|---|---|
| Deux colonnes : étape à gauche, carte large à droite | ✅ | `compas.css`, bloc « Bureau et tablette » ; sous 768 px rien ne change (verrou `bureauTablette.test.ts`) |
| Tiroirs latéraux | ✅ | à gauche, sur la colonne de l'étape et toute sa hauteur : la carte (crédit Esri compris) reste entière ; « grand » s'élargit par-dessus. Animation transform et opacité, coupée avec `prefers-reduced-motion` |
| Mesures | ✅ | `scripts/e2e/compas-bureau.spec.ts` : 390 × 844, 767, 768 × 1024, 1280 × 800, 0 débordement horizontal, 0 erreur console ; captures dans `docs/compas/preuves/` |
| Limites | 🟡 | page `/dev/compas` (données d'essai, `next dev` seulement) pour l'écran complet : le vrai `/compas` exige session et base ; navigation du site (en-tête bureau) non mesurée ici ; clavier et VoiceOver sur bureau non passés |
