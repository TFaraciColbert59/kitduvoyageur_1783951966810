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
| Accessoire au-dessus de la barre (altitude max + profil) | 🟡 | montre D+ et km ; profil d'altitude à brancher |
| Barre d'onglets qui se réduit au défilement | ⬜ | |
| Lentille qui suit le doigt (maintenir et glisser) | ⬜ | |
| Îlot dynamique : prochaine décision, appliquer | ⬜ | |
| Annuler (îlot, Ctrl/⌘+Z, deux doigts vers la gauche) | ⬜ | |
| Mode extérieur + intensité du verre (☀) | ✅ | |

## Où
| Élément | État | Note |
|---|---|---|
| « Dis-le » sur la carte | ✅ | |
| Règle de durée | ✅ | piste remplie (sage) jusqu'au curseur |
| Lignes Activité · Parcours · Quand · Préférences · Sac | ✅ | |
| Tiroir « Préparer » : Activité · Parcours · Quand · Préférences · Sac | ✅ | onglet « Sur le tracé » conservé en dernier (données réelles) |
| Activités en tuiles (grille 4 colonnes) | ✅ | description de l'activité choisie en note |
| Quand : calendrier des conditions, heure par heure, passage à chaque étape | 🟡 | calendrier et heure par heure faits ; heure de passage par étape à vérifier |

## Nous
| Élément | État | Note |
|---|---|---|
| Avatars, niveau, « en ligne » | 🟡 | avatars ; niveau et présence à brancher |
| Qui : ajouter par @pseudo, glisser pour retirer | ⛔/🟡 | gestion du groupe = `/hub/groupe` (bouton Hub) |
| Niveaux calculés (sorties, D+ moyen, allure, fiabilité) | 🟡 | allure et niveau dans « Équipe » ; les sorties des autres membres (`hike_sessions`, RLS « own ») ne sont pas lisibles sans leur consentement : à cadrer avec l'Empreinte (`get_user_signature`) |
| Rôles (pilules) | ⬜ | à cadrer avec la règle `/hub` |
| Budget : postes, plafond par personne, partage, qui doit quoi | 🟡 | enveloppe, qui doit quoi faits ; postes et partage à compléter |
| Paliers Serré / Confort / Libre | ⛔ | montants inventés |
| Annonce (publier pour trouver des compagnons) | ⬜ | |

## Résa
| Élément | État | Note |
|---|---|---|
| Six catégories (Randos, Activités, Nuits, Vols, Trajets, Extras) | 🟡 | quatre aujourd'hui |
| Jours avec cases (H, T, A…) | ✅ | |
| Résumé choisies · à réserver · en attente | ✅ | |
| Mes réservations : Mes choix · États | ✅ | tiroir « Mes réservations » ; « Réservations » tient lieu de « Mes choix » ; « États » compte les réservations réelles par état et les nuits à trouver |

## Verdict
| Élément | État | Note |
|---|---|---|
| Jauge « sur 100 » | ⛔ | pas de score unique |
| Risques (barres par risque, source datée) | 🟡 | onglet « Risques » : axes physique / technique / conjoncturel, signaux sourcés |
| Météo (jours, vent) | ✅ | par jour du voyage : ciel, min/max, pluie, rafales, isotherme 0 °C ; source et horizon affichés |
| Veille (règles, alertes proposées) | ✅ | seuils réels du moteur (`engine/watch.ts`) ; décalage proposé seulement sur prévision, appliqué au geste « Décaler » |
| Sources + fraîcheur | ✅ | alertes officielles Meteoalarm branchées |

## Kit
| Élément | État | Note |
|---|---|---|
| Répartition base / consommable / porté | ✅ | |
| Prêt sur les points vérifiés + % | ✅ | |
| Charge par membre (barre / limite) | 🟡 | |
| Inventaire (catégories, appui long : fiche) | ✅ | onglet « Inventaire » : inventaire réel par catégorie, « Dans le kit » ouvre la fiche, « Ajouter » sinon ; prêté, entretien dû, périmé affichés |
| Manques : Emprunter · Louer · Acheter, boutique | 🟡 | modes d'acquisition existants |
| Eau par personne (minimum, contenants, points d'eau) | ✅ | onglet « Eau » : repère par heure de marche jour par jour, contenants au volume écrit (`engine/water.ts`), points d'eau OSM du tracé |
| Appui long : fiche, historique, commandes | 🟡 | |
| Double-touche pour choisir, glisser à gauche pour retirer | ⬜ | |

## Carte
| Élément | État | Note |
|---|---|---|
| Carte claire, tracé, étapes numérotées, D / A | 🟡 | carte réelle (tuiles), pastilles claires |
| Contrôles (couches, recentrer) | 🟡 | |
| Personnaliser la carte (couches) | ⬜ | |
| Encart du point touché (callout) | ⬜ | |

## Création d'aventure (`/compas?nouvelle=1`)
| Élément | État | Note |
|---|---|---|
| Matériau du Compas | ✅ | `prep-compas.css` |
