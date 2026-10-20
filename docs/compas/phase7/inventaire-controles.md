# Compas — inventaire des contrôles (phase 7)

> Généré par `node scripts/compas/inventory-controls.mjs` — ne pas modifier à la main.
> Source de vérité lisible par machine : `inventaire-controles.json`.

**302 contrôles** dans 34 fichiers (plus 1 bouton(s) générique(s) de primitive, comptés à chaque usage).

| Étape | Contrôles |
|---|---:|
| Départ (Compas vide, choix du voyage) | 38 |
| Commun (capsule, tiroirs, carte, affichage) | 49 |
| Où | 66 |
| Nous | 44 |
| Résa | 22 |
| Verdict | 13 |
| Kit | 70 |

## Départ (Compas vide, choix du voyage) — 38

| Nom accessible | Type | Écran | Source |
|---|---|---|---|
| [select] | liste · désactivé parfois | Compas vide › profil voyageur | `src/components/identity/TravellerCard.tsx:128` |
| Lyon | champ · désactivé parfois | Compas vide › profil voyageur | `src/components/identity/TravellerCard.tsx:161` |
| Enregistrement… | bouton | Compas vide › profil voyageur | `src/components/identity/TravellerCard.tsx:177` |
| Passer | bouton · désactivé parfois | Compas vide › profil voyageur | `src/components/identity/TravellerCard.tsx:181` |
| Où | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:101` |
| Nous | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:101` |
| Résa | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:101` |
| Verdict | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:101` |
| Kit | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:101` |
| Ta demande | zone de texte · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:144` |
| Préciser (facultatif) | résumé | Compas vide | `src/features/compas/components/CompasStart.tsx:185` |
| Randonnée | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:188` |
| Trek | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:188` |
| Trail | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:188` |
| Course à pied | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:188` |
| Bivouac | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:188` |
| Vélo | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:188` |
| Alpinisme | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:188` |
| Escalade | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:188` |
| Ski | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:188` |
| Eau | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:188` |
| Road trip | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:188` |
| Van | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:188` |
| Culturel | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:188` |
| City trip | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:188` |
| Plage | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:188` |
| Bushcraft | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:188` |
| Mixte | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:188` |
| Plus | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:208` |
| … : moins | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:237` |
| … : plus | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:247` |
| Création de l’aventure… | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:262` |
| Connecte-toi | lien | Compas vide | `src/features/compas/components/CompasStart.tsx:286` |
| …… · partagé avec toiOuverture… | bouton · désactivé parfois | choix du voyage | `src/features/compas/components/CompasTripPicker.tsx:77` |
| Nouvelle aventure | lien | choix du voyage | `src/features/compas/components/CompasTripPicker.tsx:109` |
| Refuser | bouton · désactivé parfois | invitations | `src/features/compas/components/TripInvitations.tsx:106` |
| Accepter | bouton · désactivé parfois | invitations | `src/features/compas/components/TripInvitations.tsx:109` |
| Voir | bouton · désactivé parfois | invitations | `src/features/compas/components/TripInvitations.tsx:115` |

## Commun (capsule, tiroirs, carte, affichage) — 49

| Nom accessible | Type | Écran | Source |
|---|---|---|---|
| Réessayer | bouton | erreur de page | `src/app/compas/error.tsx:69` |
| Retour au hub | lien | erreur de page | `src/app/compas/error.tsx:76` |
| Ce qui lui est envoyé | lien | avis IA | `src/features/compas/components/AiNotice.tsx:32` |
| … | curseur | carte › profil | `src/features/compas/components/CompasAccessory.tsx:83` |
| … | geste (glisser) | carte › profil | `src/features/compas/components/CompasAccessory.tsx:83` |
| … | lien | carte de l’étape | `src/features/compas/components/CompasCards.tsx:256` |
| … | bouton | carte de l’étape | `src/features/compas/components/CompasCards.tsx:260` |
| Prochaine décision | zone cliquable | carte › prochaine décision | `src/features/compas/components/CompasDecision.tsx:76` |
| Voir : … | bouton | carte › prochaine décision | `src/features/compas/components/CompasDecision.tsx:103` |
| Appliquer : … | bouton · désactivé parfois | carte › prochaine décision | `src/features/compas/components/CompasDecision.tsx:112` |
| … | case · désactivé parfois | tiroir › Dis-le | `src/features/compas/components/CompasDisLe.tsx:138` |
| Effacer | bouton | tiroir › Dis-le | `src/features/compas/components/CompasDisLe.tsx:162` |
| Appliquer (…) | bouton · désactivé parfois | tiroir › Dis-le | `src/features/compas/components/CompasDisLe.tsx:166` |
| Dis-le | champ | tiroir › Dis-le | `src/features/compas/components/CompasDisLe.tsx:191` |
| Comprendre la phrase | bouton · désactivé parfois | tiroir › Dis-le | `src/features/compas/components/CompasDisLe.tsx:205` |
| Glisser pour réduire la carte | bouton | carte | `src/features/compas/components/CompasMap.tsx:133` |
| Réduire la carte | bouton | carte | `src/features/compas/components/CompasMap.tsx:163` |
| Recentrer | bouton | carte | `src/features/compas/components/CompasMap.tsx:172` |
| Personnaliser la carte | bouton | carte | `src/features/compas/components/CompasMap.tsx:176` |
| … | bouton | carte | `src/features/compas/components/CompasMap.tsx:200` |
| … | interrupteur · désactivé parfois | carte | `src/features/compas/components/CompasMap.tsx:216` |
| Carte nue | bouton | carte | `src/features/compas/components/CompasMap.tsx:234` |
| Tout afficher | bouton | carte | `src/features/compas/components/CompasMap.tsx:237` |
| Voir dans Parcours | bouton | carte | `src/features/compas/components/CompasMap.tsx:256` |
| Fermer l’encart | bouton | carte | `src/features/compas/components/CompasMap.tsx:265` |
| Page précédente | bouton · désactivé parfois | primitives | `src/features/compas/components/CompasPrimitives.tsx:90` |
| Page suivante | bouton · désactivé parfois | primitives | `src/features/compas/components/CompasPrimitives.tsx:101` |
| Étapes du Compas | geste (glisser) | écran du Compas | `src/features/compas/components/CompasScreen.tsx:898` |
| … | bouton | écran du Compas | `src/features/compas/components/CompasScreen.tsx:970` |
| Affichage : plein soleil et transparence du verre | bouton | écran du Compas | `src/features/compas/components/CompasScreen.tsx:978` |
| Réduire la carte | bouton | écran du Compas | `src/features/compas/components/CompasScreen.tsx:998` |
| Mode plein soleil | interrupteur | écran du Compas | `src/features/compas/components/CompasScreen.tsx:1062` |
| Transparence du verreTransparentOpaque | curseur · désactivé parfois | écran du Compas | `src/features/compas/components/CompasScreen.tsx:1073` |
| Durée de « Annuler » et des erreurs | liste | écran du Compas | `src/features/compas/components/CompasScreen.tsx:1088` |
| voir la version hors ligne | lien | écran du Compas | `src/features/compas/components/CompasScreen.tsx:1104` |
| … | zone cliquable | écran du Compas | `src/features/compas/components/CompasScreen.tsx:1159` |
| Annuler | bouton · désactivé parfois | écran du Compas | `src/features/compas/components/CompasScreen.tsx:1182` |
| Fermer le tiroir | bouton | tiroir (poignée, en-tête) | `src/features/compas/components/CompasSheet.tsx:90` |
| Réduire le tiroir | bouton | tiroir (poignée, en-tête) | `src/features/compas/components/CompasSheet.tsx:106` |
| Réduire le tiroir | geste (glisser) | tiroir (poignée, en-tête) | `src/features/compas/components/CompasSheet.tsx:106` |
| Retour | bouton | tiroir (poignée, en-tête) | `src/features/compas/components/CompasSheet.tsx:140` |
| Fermer | bouton | tiroir (poignée, en-tête) | `src/features/compas/components/CompasSheet.tsx:149` |
| Taille moyenne | bouton | tiroir (poignée, en-tête) | `src/features/compas/components/CompasSheet.tsx:160` |
| Onglet précédent : … | bouton · désactivé parfois | tiroir › pied (Retour, Suivant) | `src/features/compas/components/CompasSheets.tsx:1109` |
| Suivant | bouton | tiroir › pied (Retour, Suivant) | `src/features/compas/components/CompasSheets.tsx:1125` |
| Terminer | bouton | tiroir › pied (Retour, Suivant) | `src/features/compas/components/CompasSheets.tsx:1134` |
| Powered by Geoapify | lien | crédits | `src/features/compas/components/GeoapifyCredit.tsx:20` |
| Garder mon voyage | lien | note d’essai | `src/features/compas/components/TrialNote.tsx:16` |
| …… | bouton | carte | `src/features/hub/components/mobile/HubGlobeMap.tsx:263` |

## Où — 66

| Nom accessible | Type | Écran | Source |
|---|---|---|---|
| Dis-le | champ | carte où | `src/features/compas/components/CompasCards.tsx:314` |
| Effacer le départ | bouton · désactivé parfois | carte où | `src/features/compas/components/CompasCards.tsx:450` |
| Annuler la préparation | bouton · désactivé parfois | carte où | `src/features/compas/components/CompasCards.tsx:492` |
| Tout préparer pour moi | bouton · désactivé parfois | carte où | `src/features/compas/components/CompasCards.tsx:508` |
| Randonnée | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:141` |
| Trek | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:141` |
| Trail | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:141` |
| Course à pied | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:141` |
| Bivouac | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:141` |
| Vélo | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:141` |
| Alpinisme | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:141` |
| Escalade | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:141` |
| Ski | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:141` |
| Eau | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:141` |
| Road trip | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:141` |
| Van | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:141` |
| Culturel | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:141` |
| City trip | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:141` |
| Plage | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:141` |
| Bushcraft | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:141` |
| Mixte | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:141` |
| Chercher un parcours | champ | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:318` |
| Chercher | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:326` |
| … | bouton | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:338` |
| … | bouton | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:349` |
| … | lien | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:454` |
| ……fait ×… | bouton | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:470` |
| Un jour de moins | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:573` |
| Un jour de plus | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:583` |
| Retour | bouton | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:596` |
| Choisir ce parcours | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:601` |
| Départ | champ | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:738` |
| Unité de durée | liste | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:749` |
| Nombre de jours | champ | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:758` |
| Nombre d’heures | champ | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:772` |
| Enregistrer | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:797` |
| J… | bouton | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:868` |
| … | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:908` |
| [button] | onglet | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:1144` |
| … | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:1162` |
| Voir le groupe | bouton | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:1209` |
| … | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:1287` |
| … | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:1315` |
| Sans voiture | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:1341` |
| Libre | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:1365` |
| Sans limite | champ · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:1394` |
| Retirer … | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:1440` |
| … | bouton | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:1461` |
| Ajouter : … | champ | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:1477` |
| Ajouter à … | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:1484` |
| Voir mon aventure | bouton | préparation | `src/features/compas/components/CompasPrep.tsx:109` |
| Préciser ma demande | bouton | préparation | `src/features/compas/components/CompasPrep.tsx:116` |
| Reprendre | bouton | préparation | `src/features/compas/components/CompasPrep.tsx:119` |
| Arrêter | bouton | préparation | `src/features/compas/components/CompasPrep.tsx:125` |
| Annuler | bouton | tiroir ou › durée | `src/features/compas/components/CompasRuler.tsx:137` |
| Appliquer : … | bouton · désactivé parfois | tiroir ou › durée | `src/features/compas/components/CompasRuler.tsx:145` |
| Durée de la sortie | zone cliquable | tiroir ou › durée | `src/features/compas/components/CompasRuler.tsx:163` |
| Durée de la sortie | geste (glisser) | tiroir ou › durée | `src/features/compas/components/CompasRuler.tsx:163` |
| Où | bouton | écran du Compas | `src/features/compas/components/CompasScreen.tsx:949` |
| Activité | onglet | tiroir ou › Activité | `src/features/compas/components/CompasSheets.tsx:1141` |
| Parcours | onglet | tiroir ou › Parcours | `src/features/compas/components/CompasSheets.tsx:1141` |
| Quand | onglet | tiroir ou › Quand | `src/features/compas/components/CompasSheets.tsx:1141` |
| Préférences | onglet | tiroir ou › Préférences | `src/features/compas/components/CompasSheets.tsx:1141` |
| Sac | onglet | tiroir ou › Sac | `src/features/compas/components/CompasSheets.tsx:1141` |
| Sur place | onglet | tiroir ou › Sur place | `src/features/compas/components/CompasSheets.tsx:1141` |
| Tout (…) | onglet | tiroir où › sur place | `src/features/compas/components/CompasSheets.tsx:3313` |

## Nous — 44

| Nom accessible | Type | Écran | Source |
|---|---|---|---|
| Voir qui est dans le voyage | bouton | carte nous | `src/features/compas/components/CompasCards.tsx:604` |
| …prévus et dépensés · … | bouton | carte nous | `src/features/compas/components/CompasCards.tsx:633` |
| Dépenses au-dessus de l’enveloppe | bouton | carte nous | `src/features/compas/components/CompasCards.tsx:669` |
| L’équipe et ses sacs | bouton | carte nous | `src/features/compas/components/CompasCards.tsx:679` |
| …… (moi)………… | bouton | tiroir nous › équipe | `src/features/compas/components/CompasMembers.tsx:77` |
| Gérer le groupe dans le Hub | lien | tiroir nous › équipe | `src/features/compas/components/CompasMembers.tsx:123` |
| Si tu pars à (heure de départ de chaque jour) | champ | tiroir nous › passage | `src/features/compas/components/CompasPassage.tsx:101` |
| Enregistrer cette heure | bouton · désactivé parfois | tiroir nous › passage | `src/features/compas/components/CompasPassage.tsx:122` |
| Effacer l’heure enregistrée (…) | bouton · désactivé parfois | tiroir nous › passage | `src/features/compas/components/CompasPassage.tsx:132` |
| Nous | bouton | écran du Compas | `src/features/compas/components/CompasScreen.tsx:949` |
| Équipe | onglet | tiroir nous › Équipe | `src/features/compas/components/CompasSheets.tsx:1141` |
| Qui | onglet | tiroir nous › Qui | `src/features/compas/components/CompasSheets.tsx:1141` |
| Budget | onglet | tiroir nous › Budget | `src/features/compas/components/CompasSheets.tsx:1141` |
| Bouteille | onglet | tiroir nous › Bouteille | `src/features/compas/components/CompasSheets.tsx:1141` |
| Une personne de moins | bouton · désactivé parfois | tiroir nous › équipe | `src/features/compas/components/CompasSheets.tsx:1249` |
| Une personne de plus | bouton · désactivé parfois | tiroir nous › équipe | `src/features/compas/components/CompasSheets.tsx:1258` |
| … objet commun sans porteur | bouton | tiroir nous › équipe | `src/features/compas/components/CompasSheets.tsx:1324` |
| Enveloppe du voyage (…) | champ | tiroir nous › budget | `src/features/compas/components/CompasSheets.tsx:1481` |
| Enregistrer | bouton · désactivé parfois | tiroir nous › budget | `src/features/compas/components/CompasSheets.tsx:1492` |
| Ajouter une dépense | bouton | tiroir nous › budget › dépense | `src/features/compas/components/CompasSheets.tsx:1594` |
| Nom | champ | tiroir nous › budget › dépense | `src/features/compas/components/CompasSheets.tsx:1629` |
| Montant (…) | champ | tiroir nous › budget › dépense | `src/features/compas/components/CompasSheets.tsx:1639` |
| Catégorie | liste | tiroir nous › budget › dépense | `src/features/compas/components/CompasSheets.tsx:1652` |
| Groupe | onglet | tiroir nous › budget › dépense | `src/features/compas/components/CompasSheets.tsx:1666` |
| Par pers. | onglet | tiroir nous › budget › dépense | `src/features/compas/components/CompasSheets.tsx:1667` |
| Prévue | onglet | tiroir nous › budget › dépense | `src/features/compas/components/CompasSheets.tsx:1675` |
| Payée par moi | onglet | tiroir nous › budget › dépense | `src/features/compas/components/CompasSheets.tsx:1676` |
| Ajouter | bouton · désactivé parfois | tiroir nous › budget › dépense | `src/features/compas/components/CompasSheets.tsx:1692` |
| Annuler | bouton | tiroir nous › budget › dépense | `src/features/compas/components/CompasSheets.tsx:1695` |
| Refuser … | bouton · désactivé parfois | tiroir nous › annonce | `src/features/compas/components/CompasSheets.tsx:1894` |
| Accepter … | bouton · désactivé parfois | tiroir nous › annonce | `src/features/compas/components/CompasSheets.tsx:1903` |
| Retirer de la communauté | bouton · désactivé parfois | tiroir nous › annonce | `src/features/compas/components/CompasSheets.tsx:1916` |
| Titre | champ | tiroir nous › annonce | `src/features/compas/components/CompasSheets.tsx:1951` |
| Confiance minimale : …/100 | curseur | tiroir nous › annonce | `src/features/compas/components/CompasSheets.tsx:1964` |
| … | onglet | tiroir nous › annonce | `src/features/compas/components/CompasSheets.tsx:1978` |
| … | onglet | tiroir nous › annonce | `src/features/compas/components/CompasSheets.tsx:1979` |
| … | onglet | tiroir nous › annonce | `src/features/compas/components/CompasSheets.tsx:1980` |
| Places dans le groupe | champ | tiroir nous › annonce | `src/features/compas/components/CompasSheets.tsx:1985` |
| Départ | champ | tiroir nous › annonce | `src/features/compas/components/CompasSheets.tsx:2002` |
| Retour | champ | tiroir nous › annonce | `src/features/compas/components/CompasSheets.tsx:2006` |
| Message | zone de texte | tiroir nous › annonce | `src/features/compas/components/CompasSheets.tsx:2012` |
| J’ai 18 ans ou plus | case | tiroir nous › annonce | `src/features/compas/components/CompasSheets.tsx:2020` |
| Lancer | bouton · désactivé parfois | tiroir nous › annonce | `src/features/compas/components/CompasSheets.tsx:2023` |
| Inviter quelqu’un que je connais, dans le Hub | lien | tiroir nous › annonce | `src/features/compas/components/CompasSheets.tsx:2031` |

## Résa — 22

| Nom accessible | Type | Écran | Source |
|---|---|---|---|
| … | bouton · désactivé parfois | carte résa | `src/features/compas/components/CompasCards.tsx:732` |
| Jour …… | bouton | carte résa | `src/features/compas/components/CompasCards.tsx:759` |
| Résa | bouton | écran du Compas | `src/features/compas/components/CompasScreen.tsx:949` |
| Nuits | onglet | tiroir resa › Nuits | `src/features/compas/components/CompasSheets.tsx:1141` |
| Réservations | onglet | tiroir resa › Réservations | `src/features/compas/components/CompasSheets.tsx:1141` |
| Offres | onglet | tiroir resa › Offres | `src/features/compas/components/CompasSheets.tsx:1141` |
| États | onglet | tiroir resa › États | `src/features/compas/components/CompasSheets.tsx:1141` |
| Chercher un hébergement pour | liste | tiroir résa › nuits › recherche | `src/features/compas/components/CompasSheets.tsx:2109` |
| Chercher | bouton · désactivé parfois | tiroir résa › nuits › recherche | `src/features/compas/components/CompasSheets.tsx:2117` |
| [cp-row] | geste (double-touche) | tiroir résa › nuits › recherche | `src/features/compas/components/CompasSheets.tsx:2146` |
| Noter | bouton · désactivé parfois | tiroir résa › nuits › recherche | `src/features/compas/components/CompasSheets.tsx:2176` |
| Voir l’offre | lien | tiroir résa › nuits › recherche | `src/features/compas/components/CompasSheets.tsx:2190` |
| Hébergement de la nuit du jour … | champ | tiroir résa › nuits | `src/features/compas/components/CompasSheets.tsx:2251` |
| OK | bouton · désactivé parfois | tiroir résa › nuits | `src/features/compas/components/CompasSheets.tsx:2274` |
| …… | lien | tiroir résa › nuits | `src/features/compas/components/CompasSheets.tsx:2290` |
| [button] | onglet | tiroir résa › offres | `src/features/compas/components/CompasSheets.tsx:2486` |
| Chercher un hébergement nuit par nuit | bouton | tiroir résa › offres | `src/features/compas/components/CompasSheets.tsx:2508` |
| …… | lien | tiroir résa › offres | `src/features/compas/components/CompasSheets.tsx:2528` |
| Départ de | champ | tiroir résa › offres › recherche | `src/features/compas/components/CompasSheets.tsx:2616` |
| Prise du véhicule à | champ | tiroir résa › offres › recherche | `src/features/compas/components/CompasSheets.tsx:2631` |
| Recherche… | bouton · désactivé parfois | tiroir résa › offres › recherche | `src/features/compas/components/CompasSheets.tsx:2645` |
| … | lien | tiroir résa › offres › recherche | `src/features/compas/components/CompasSheets.tsx:2715` |

## Verdict — 13

| Nom accessible | Type | Écran | Source |
|---|---|---|---|
| … autre signal | bouton | carte verdict | `src/features/compas/components/CompasCards.tsx:942` |
| Verdict | bouton | écran du Compas | `src/features/compas/components/CompasScreen.tsx:949` |
| Risques | onglet | tiroir verdict › Risques | `src/features/compas/components/CompasSheets.tsx:1141` |
| Météo | onglet | tiroir verdict › Météo | `src/features/compas/components/CompasSheets.tsx:1141` |
| Veille | onglet | tiroir verdict › Veille | `src/features/compas/components/CompasSheets.tsx:1141` |
| Sources | onglet | tiroir verdict › Sources | `src/features/compas/components/CompasSheets.tsx:1141` |
| L’IA lit les signaux… | bouton · désactivé parfois | tiroir verdict › explication | `src/features/compas/components/CompasSheets.tsx:2851` |
| Décaler | bouton · désactivé parfois | tiroir verdict › veille | `src/features/compas/components/CompasSheets.tsx:2994` |
| Ajouter à l’inventaire | bouton | tiroir verdict › sources | `src/features/compas/components/CompasSheets.tsx:3107` |
| Meteoalarm | lien | verdict › alertes officielles | `src/features/compas/components/MeteoalarmNotice.tsx:35` |
| www.meteoalarm.org | lien | verdict › alertes officielles | `src/features/compas/components/MeteoalarmNotice.tsx:47` |
| … | résumé | verdict › alertes officielles | `src/features/compas/components/OfficialAlertTexts.tsx:50` |
| … | lien | verdict › alertes officielles | `src/features/compas/components/WorldAlertNotice.tsx:36` |

## Kit — 70

| Nom accessible | Type | Écran | Source |
|---|---|---|---|
| …… × …… · … · … · vital · boutique … | zone cliquable | ligne d’objet | `src/features/compas/components/CompasCards.tsx:113` |
| …… × …… · … · … · vital · boutique … | geste (appui long) | ligne d’objet | `src/features/compas/components/CompasCards.tsx:113` |
| [cp-row] | geste (glisser) | ligne d’objet | `src/features/compas/components/CompasCards.tsx:113` |
| …… × …… · … · … · vital · boutique … | bouton | ligne d’objet | `src/features/compas/components/CompasCards.tsx:146` |
| Retirer du kit : … | bouton · désactivé parfois | ligne d’objet | `src/features/compas/components/CompasCards.tsx:169` |
| … | bouton · désactivé parfois | ligne d’objet | `src/features/compas/components/CompasCards.tsx:187` |
| ……— | bouton | carte kit | `src/features/compas/components/CompasCards.tsx:1027` |
| … | bouton | carte kit | `src/features/compas/components/CompasCards.tsx:1046` |
| Voir le sac de … | bouton | carte kit | `src/features/compas/components/CompasCards.tsx:1076` |
| … | bouton | carte kit | `src/features/compas/components/CompasCards.tsx:1103` |
| Réessayer | bouton | fiche objet › historique | `src/features/compas/components/CompasItemHistory.tsx:81` |
| Voir mes commandes | lien | fiche objet › historique | `src/features/compas/components/CompasItemHistory.tsx:118` |
| Kit | bouton | écran du Compas | `src/features/compas/components/CompasScreen.tsx:949` |
| Fiche | onglet | fiche objet | `src/features/compas/components/CompasSheets.tsx:198` |
| Historique | onglet | fiche objet | `src/features/compas/components/CompasSheets.tsx:199` |
| Déballer | bouton | fiche objet | `src/features/compas/components/CompasSheets.tsx:283` |
| Porteur | bouton | fiche objet | `src/features/compas/components/CompasSheets.tsx:291` |
| Je l’ai récupéré | bouton · désactivé parfois | fiche objet | `src/features/compas/components/CompasSheets.tsx:302` |
| … | bouton | fiche objet | `src/features/compas/components/CompasSheets.tsx:325` |
| Fiche produit | lien | fiche objet | `src/features/compas/components/CompasSheets.tsx:339` |
| Confirmer le retrait | bouton · désactivé parfois | fiche objet | `src/features/compas/components/CompasSheets.tsx:347` |
| Annuler | bouton | fiche objet | `src/features/compas/components/CompasSheets.tsx:361` |
| Retirer du kit | bouton | fiche objet | `src/features/compas/components/CompasSheets.tsx:366` |
| …… · occasion… · ★ … (… avis)… | geste (double-touche) | fiche objet › produits | `src/features/compas/components/CompasSheets.tsx:412` |
| Fiche produit : … | lien | fiche objet › produits | `src/features/compas/components/CompasSheets.tsx:452` |
| … | bouton · désactivé parfois | fiche objet › produits | `src/features/compas/components/CompasSheets.tsx:460` |
| … | champ | recherche | `src/features/compas/components/CompasSheets.tsx:485` |
| Emprunter · … | onglet | trouver un objet | `src/features/compas/components/CompasSheets.tsx:542` |
| Louer · … | onglet | trouver un objet | `src/features/compas/components/CompasSheets.tsx:547` |
| Acheter · … | onglet | trouver un objet | `src/features/compas/components/CompasSheets.tsx:552` |
| Inviter depuis le Hub | lien | trouver un objet | `src/features/compas/components/CompasSheets.tsx:571` |
| Emprunter | bouton · désactivé parfois | trouver un objet | `src/features/compas/components/CompasSheets.tsx:586` |
| Voir la location | lien | trouver un objet | `src/features/compas/components/CompasSheets.tsx:638` |
| Voir le panier | lien | trouver un objet | `src/features/compas/components/CompasSheets.tsx:685` |
| [button] | onglet | ajouter un objet | `src/features/compas/components/CompasSheets.tsx:754` |
| Ajouter à l’inventaire | bouton | ajouter un objet | `src/features/compas/components/CompasSheets.tsx:772` |
| Ajouter | bouton · désactivé parfois | ajouter un objet | `src/features/compas/components/CompasSheets.tsx:797` |
| Voir toute la boutique | bouton | ajouter un objet | `src/features/compas/components/CompasSheets.tsx:832` |
| Nom | champ | ajouter un objet › libre | `src/features/compas/components/CompasSheets.tsx:910` |
| Catégorie | liste | ajouter un objet › libre | `src/features/compas/components/CompasSheets.tsx:921` |
| Poids (g), si connu | champ | ajouter un objet › libre | `src/features/compas/components/CompasSheets.tsx:931` |
| Vital | case | ajouter un objet › libre | `src/features/compas/components/CompasSheets.tsx:937` |
| Consommable | case | ajouter un objet › libre | `src/features/compas/components/CompasSheets.tsx:940` |
| Quantité | champ | ajouter un objet › libre | `src/features/compas/components/CompasSheets.tsx:944` |
| Ajouter | bouton · désactivé parfois | ajouter un objet › libre | `src/features/compas/components/CompasSheets.tsx:955` |
| Commun au groupe | onglet | porteur | `src/features/compas/components/CompasSheets.tsx:1034` |
| Personnel | onglet | porteur | `src/features/compas/components/CompasSheets.tsx:1035` |
| …… (moi)porte … sur … | bouton · désactivé parfois | porteur | `src/features/compas/components/CompasSheets.tsx:1042` |
| Personne pour l’instant | bouton · désactivé parfois | porteur | `src/features/compas/components/CompasSheets.tsx:1077` |
| Conseils | onglet | tiroir kit › Conseils | `src/features/compas/components/CompasSheets.tsx:1141` |
| Mes kits | onglet | tiroir kit › Mes kits | `src/features/compas/components/CompasSheets.tsx:1141` |
| Inventaire | onglet | tiroir kit › Inventaire | `src/features/compas/components/CompasSheets.tsx:1141` |
| Trouver | onglet | tiroir kit › Trouver | `src/features/compas/components/CompasSheets.tsx:1141` |
| Emballer | onglet | tiroir kit › Emballer | `src/features/compas/components/CompasSheets.tsx:1141` |
| Tout | onglet | tiroir kit › Tout | `src/features/compas/components/CompasSheets.tsx:1141` |
| Sacs | onglet | tiroir kit › Sacs | `src/features/compas/components/CompasSheets.tsx:1141` |
| Eau | onglet | tiroir kit › Eau | `src/features/compas/components/CompasSheets.tsx:1141` |
| Ajouter au kit | bouton | tiroir kit › liste | `src/features/compas/components/CompasSheets.tsx:3147` |
| Ajouter | bouton | tiroir kit › conseils | `src/features/compas/components/CompasSheets.tsx:3238` |
| Créer mon kit | bouton | tiroir kit › mes kits | `src/features/compas/components/CompasSheets.tsx:3440` |
| Nom | champ | tiroir kit › mes kits | `src/features/compas/components/CompasSheets.tsx:3465` |
| Saison | liste | tiroir kit › mes kits | `src/features/compas/components/CompasSheets.tsx:3479` |
| Ajoute d’abord des objets | bouton · désactivé parfois | tiroir kit › mes kits | `src/features/compas/components/CompasSheets.tsx:3489` |
| Déjà complet | bouton · désactivé parfois | tiroir kit › mes kits | `src/features/compas/components/CompasSheets.tsx:3543` |
| Ajouter à l’inventaire | bouton | tiroir kit › inventaire | `src/features/compas/components/CompasSheets.tsx:3760` |
| Tout (…) | onglet | tiroir kit › inventaire | `src/features/compas/components/CompasSheets.tsx:3777` |
| Fiche : … | bouton | tiroir kit › inventaire | `src/features/compas/components/CompasSheets.tsx:3809` |
| Ajouter au kit : … | bouton · désactivé parfois | tiroir kit › inventaire | `src/features/compas/components/CompasSheets.tsx:3818` |
| ……Commun sans porteur · à peserQui porte ? | bouton | tiroir kit › sacs | `src/features/compas/components/CompasSheets.tsx:3868` |
| …Sac de …… sur … | bouton | tiroir kit › sacs | `src/features/compas/components/CompasSheets.tsx:3895` |

## Primitives (non comptées : chaque usage est inventorié)

- `src/features/compas/components/CompasPrimitives.tsx:280` Segments › bouton

