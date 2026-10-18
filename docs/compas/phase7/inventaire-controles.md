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
| [select] | liste · désactivé parfois | Compas vide › profil voyageur | `src/components/identity/TravellerCard.tsx:126` |
| Lyon | champ · désactivé parfois | Compas vide › profil voyageur | `src/components/identity/TravellerCard.tsx:159` |
| Enregistrement… | bouton | Compas vide › profil voyageur | `src/components/identity/TravellerCard.tsx:175` |
| Passer | bouton · désactivé parfois | Compas vide › profil voyageur | `src/components/identity/TravellerCard.tsx:179` |
| Où | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:100` |
| Nous | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:100` |
| Résa | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:100` |
| Verdict | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:100` |
| Kit | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:100` |
| Ta demande | zone de texte · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:143` |
| Préciser (facultatif) | résumé | Compas vide | `src/features/compas/components/CompasStart.tsx:184` |
| Randonnée | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:187` |
| Trek | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:187` |
| Trail | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:187` |
| Course à pied | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:187` |
| Bivouac | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:187` |
| Vélo | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:187` |
| Alpinisme | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:187` |
| Escalade | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:187` |
| Ski | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:187` |
| Eau | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:187` |
| Road trip | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:187` |
| Van | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:187` |
| Culturel | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:187` |
| City trip | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:187` |
| Plage | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:187` |
| Bushcraft | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:187` |
| Mixte | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:187` |
| Plus | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:207` |
| … : moins | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:236` |
| … : plus | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:246` |
| Création de l’aventure… | bouton · désactivé parfois | Compas vide | `src/features/compas/components/CompasStart.tsx:261` |
| Connecte-toi | lien | Compas vide | `src/features/compas/components/CompasStart.tsx:285` |
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
| … | lien | carte de l’étape | `src/features/compas/components/CompasCards.tsx:253` |
| … | bouton | carte de l’étape | `src/features/compas/components/CompasCards.tsx:257` |
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
| Étapes du Compas | geste (glisser) | écran du Compas | `src/features/compas/components/CompasScreen.tsx:897` |
| … | bouton | écran du Compas | `src/features/compas/components/CompasScreen.tsx:969` |
| Affichage : plein soleil et transparence du verre | bouton | écran du Compas | `src/features/compas/components/CompasScreen.tsx:977` |
| Réduire la carte | bouton | écran du Compas | `src/features/compas/components/CompasScreen.tsx:997` |
| Mode plein soleil | interrupteur | écran du Compas | `src/features/compas/components/CompasScreen.tsx:1061` |
| Transparence du verreTransparentOpaque | curseur · désactivé parfois | écran du Compas | `src/features/compas/components/CompasScreen.tsx:1072` |
| Durée de « Annuler » et des erreurs | liste | écran du Compas | `src/features/compas/components/CompasScreen.tsx:1087` |
| voir la version hors ligne | lien | écran du Compas | `src/features/compas/components/CompasScreen.tsx:1103` |
| … | zone cliquable | écran du Compas | `src/features/compas/components/CompasScreen.tsx:1158` |
| Annuler | bouton · désactivé parfois | écran du Compas | `src/features/compas/components/CompasScreen.tsx:1181` |
| Fermer le tiroir | bouton | tiroir (poignée, en-tête) | `src/features/compas/components/CompasSheet.tsx:90` |
| Réduire le tiroir | bouton | tiroir (poignée, en-tête) | `src/features/compas/components/CompasSheet.tsx:106` |
| Réduire le tiroir | geste (glisser) | tiroir (poignée, en-tête) | `src/features/compas/components/CompasSheet.tsx:106` |
| Retour | bouton | tiroir (poignée, en-tête) | `src/features/compas/components/CompasSheet.tsx:140` |
| Fermer | bouton | tiroir (poignée, en-tête) | `src/features/compas/components/CompasSheet.tsx:149` |
| Taille moyenne | bouton | tiroir (poignée, en-tête) | `src/features/compas/components/CompasSheet.tsx:160` |
| Onglet précédent : … | bouton · désactivé parfois | tiroir › pied (Retour, Suivant) | `src/features/compas/components/CompasSheets.tsx:1105` |
| Suivant | bouton | tiroir › pied (Retour, Suivant) | `src/features/compas/components/CompasSheets.tsx:1121` |
| Terminer | bouton | tiroir › pied (Retour, Suivant) | `src/features/compas/components/CompasSheets.tsx:1130` |
| Powered by Geoapify | lien | crédits | `src/features/compas/components/GeoapifyCredit.tsx:20` |
| Garder mon voyage | lien | note d’essai | `src/features/compas/components/TrialNote.tsx:16` |
| …… | bouton | carte | `src/features/hub/components/mobile/HubGlobeMap.tsx:263` |

## Où — 66

| Nom accessible | Type | Écran | Source |
|---|---|---|---|
| Dis-le | champ | carte où | `src/features/compas/components/CompasCards.tsx:311` |
| Effacer le départ | bouton · désactivé parfois | carte où | `src/features/compas/components/CompasCards.tsx:447` |
| Annuler la préparation | bouton · désactivé parfois | carte où | `src/features/compas/components/CompasCards.tsx:489` |
| Tout préparer pour moi | bouton · désactivé parfois | carte où | `src/features/compas/components/CompasCards.tsx:505` |
| Randonnée | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:139` |
| Trek | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:139` |
| Trail | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:139` |
| Course à pied | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:139` |
| Bivouac | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:139` |
| Vélo | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:139` |
| Alpinisme | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:139` |
| Escalade | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:139` |
| Ski | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:139` |
| Eau | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:139` |
| Road trip | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:139` |
| Van | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:139` |
| Culturel | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:139` |
| City trip | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:139` |
| Plage | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:139` |
| Bushcraft | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:139` |
| Mixte | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:139` |
| Chercher un parcours | champ | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:316` |
| Chercher | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:324` |
| … | bouton | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:336` |
| … | bouton | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:347` |
| … | lien | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:452` |
| ……fait ×… | bouton | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:468` |
| Un jour de moins | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:571` |
| Un jour de plus | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:581` |
| Retour | bouton | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:594` |
| Choisir ce parcours | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:599` |
| Départ | champ | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:737` |
| Unité de durée | liste | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:748` |
| Nombre de jours | champ | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:757` |
| Nombre d’heures | champ | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:771` |
| Enregistrer | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:796` |
| J… | bouton | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:867` |
| … | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:907` |
| [button] | onglet | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:1143` |
| … | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:1161` |
| Voir le groupe | bouton | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:1208` |
| … | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:1286` |
| … | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:1314` |
| Sans voiture | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:1340` |
| Libre | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:1364` |
| Sans limite | champ · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:1393` |
| Retirer … | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:1439` |
| … | bouton | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:1460` |
| Ajouter : … | champ | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:1476` |
| Ajouter à … | bouton · désactivé parfois | tiroir ou | `src/features/compas/components/CompasOuFlows.tsx:1483` |
| Voir mon aventure | bouton | préparation | `src/features/compas/components/CompasPrep.tsx:109` |
| Préciser ma demande | bouton | préparation | `src/features/compas/components/CompasPrep.tsx:116` |
| Reprendre | bouton | préparation | `src/features/compas/components/CompasPrep.tsx:119` |
| Arrêter | bouton | préparation | `src/features/compas/components/CompasPrep.tsx:125` |
| Annuler | bouton | tiroir ou › durée | `src/features/compas/components/CompasRuler.tsx:137` |
| Appliquer : … | bouton · désactivé parfois | tiroir ou › durée | `src/features/compas/components/CompasRuler.tsx:145` |
| Durée de la sortie | zone cliquable | tiroir ou › durée | `src/features/compas/components/CompasRuler.tsx:163` |
| Durée de la sortie | geste (glisser) | tiroir ou › durée | `src/features/compas/components/CompasRuler.tsx:163` |
| Où | bouton | écran du Compas | `src/features/compas/components/CompasScreen.tsx:948` |
| Activité | onglet | tiroir ou › Activité | `src/features/compas/components/CompasSheets.tsx:1137` |
| Parcours | onglet | tiroir ou › Parcours | `src/features/compas/components/CompasSheets.tsx:1137` |
| Quand | onglet | tiroir ou › Quand | `src/features/compas/components/CompasSheets.tsx:1137` |
| Préférences | onglet | tiroir ou › Préférences | `src/features/compas/components/CompasSheets.tsx:1137` |
| Sac | onglet | tiroir ou › Sac | `src/features/compas/components/CompasSheets.tsx:1137` |
| Sur place | onglet | tiroir ou › Sur place | `src/features/compas/components/CompasSheets.tsx:1137` |
| Tout (…) | onglet | tiroir où › sur place | `src/features/compas/components/CompasSheets.tsx:3301` |

## Nous — 44

| Nom accessible | Type | Écran | Source |
|---|---|---|---|
| Voir qui est dans le voyage | bouton | carte nous | `src/features/compas/components/CompasCards.tsx:601` |
| …prévus et dépensés · … | bouton | carte nous | `src/features/compas/components/CompasCards.tsx:629` |
| Dépenses au-dessus de l’enveloppe | bouton | carte nous | `src/features/compas/components/CompasCards.tsx:665` |
| L’équipe et ses sacs | bouton | carte nous | `src/features/compas/components/CompasCards.tsx:675` |
| …… (moi)………… | bouton | tiroir nous › équipe | `src/features/compas/components/CompasMembers.tsx:77` |
| Gérer le groupe dans le Hub | lien | tiroir nous › équipe | `src/features/compas/components/CompasMembers.tsx:123` |
| Si tu pars à (heure de départ de chaque jour) | champ | tiroir nous › passage | `src/features/compas/components/CompasPassage.tsx:101` |
| Enregistrer cette heure | bouton · désactivé parfois | tiroir nous › passage | `src/features/compas/components/CompasPassage.tsx:122` |
| Effacer l’heure enregistrée (…) | bouton · désactivé parfois | tiroir nous › passage | `src/features/compas/components/CompasPassage.tsx:132` |
| Nous | bouton | écran du Compas | `src/features/compas/components/CompasScreen.tsx:948` |
| Équipe | onglet | tiroir nous › Équipe | `src/features/compas/components/CompasSheets.tsx:1137` |
| Qui | onglet | tiroir nous › Qui | `src/features/compas/components/CompasSheets.tsx:1137` |
| Budget | onglet | tiroir nous › Budget | `src/features/compas/components/CompasSheets.tsx:1137` |
| Bouteille | onglet | tiroir nous › Bouteille | `src/features/compas/components/CompasSheets.tsx:1137` |
| Une personne de moins | bouton · désactivé parfois | tiroir nous › équipe | `src/features/compas/components/CompasSheets.tsx:1245` |
| Une personne de plus | bouton · désactivé parfois | tiroir nous › équipe | `src/features/compas/components/CompasSheets.tsx:1254` |
| … objet commun sans porteur | bouton | tiroir nous › équipe | `src/features/compas/components/CompasSheets.tsx:1320` |
| Enveloppe du voyage (…) | champ | tiroir nous › budget | `src/features/compas/components/CompasSheets.tsx:1474` |
| Enregistrer | bouton · désactivé parfois | tiroir nous › budget | `src/features/compas/components/CompasSheets.tsx:1485` |
| Ajouter une dépense | bouton | tiroir nous › budget › dépense | `src/features/compas/components/CompasSheets.tsx:1587` |
| Nom | champ | tiroir nous › budget › dépense | `src/features/compas/components/CompasSheets.tsx:1622` |
| Montant (…) | champ | tiroir nous › budget › dépense | `src/features/compas/components/CompasSheets.tsx:1632` |
| Catégorie | liste | tiroir nous › budget › dépense | `src/features/compas/components/CompasSheets.tsx:1645` |
| Groupe | onglet | tiroir nous › budget › dépense | `src/features/compas/components/CompasSheets.tsx:1659` |
| Par pers. | onglet | tiroir nous › budget › dépense | `src/features/compas/components/CompasSheets.tsx:1660` |
| Prévue | onglet | tiroir nous › budget › dépense | `src/features/compas/components/CompasSheets.tsx:1668` |
| Payée par moi | onglet | tiroir nous › budget › dépense | `src/features/compas/components/CompasSheets.tsx:1669` |
| Ajouter | bouton · désactivé parfois | tiroir nous › budget › dépense | `src/features/compas/components/CompasSheets.tsx:1685` |
| Annuler | bouton | tiroir nous › budget › dépense | `src/features/compas/components/CompasSheets.tsx:1688` |
| Refuser … | bouton · désactivé parfois | tiroir nous › annonce | `src/features/compas/components/CompasSheets.tsx:1887` |
| Accepter … | bouton · désactivé parfois | tiroir nous › annonce | `src/features/compas/components/CompasSheets.tsx:1896` |
| Retirer de la communauté | bouton · désactivé parfois | tiroir nous › annonce | `src/features/compas/components/CompasSheets.tsx:1909` |
| Titre | champ | tiroir nous › annonce | `src/features/compas/components/CompasSheets.tsx:1944` |
| Confiance minimale : …/100 | curseur | tiroir nous › annonce | `src/features/compas/components/CompasSheets.tsx:1957` |
| … | onglet | tiroir nous › annonce | `src/features/compas/components/CompasSheets.tsx:1971` |
| … | onglet | tiroir nous › annonce | `src/features/compas/components/CompasSheets.tsx:1972` |
| … | onglet | tiroir nous › annonce | `src/features/compas/components/CompasSheets.tsx:1973` |
| Places dans le groupe | champ | tiroir nous › annonce | `src/features/compas/components/CompasSheets.tsx:1978` |
| Départ | champ | tiroir nous › annonce | `src/features/compas/components/CompasSheets.tsx:1995` |
| Retour | champ | tiroir nous › annonce | `src/features/compas/components/CompasSheets.tsx:1999` |
| Message | zone de texte | tiroir nous › annonce | `src/features/compas/components/CompasSheets.tsx:2005` |
| J’ai 18 ans ou plus | case | tiroir nous › annonce | `src/features/compas/components/CompasSheets.tsx:2013` |
| Lancer | bouton · désactivé parfois | tiroir nous › annonce | `src/features/compas/components/CompasSheets.tsx:2016` |
| Inviter quelqu’un que je connais, dans le Hub | lien | tiroir nous › annonce | `src/features/compas/components/CompasSheets.tsx:2024` |

## Résa — 22

| Nom accessible | Type | Écran | Source |
|---|---|---|---|
| … | bouton · désactivé parfois | carte résa | `src/features/compas/components/CompasCards.tsx:728` |
| Jour …… | bouton | carte résa | `src/features/compas/components/CompasCards.tsx:755` |
| Résa | bouton | écran du Compas | `src/features/compas/components/CompasScreen.tsx:948` |
| Nuits | onglet | tiroir resa › Nuits | `src/features/compas/components/CompasSheets.tsx:1137` |
| Réservations | onglet | tiroir resa › Réservations | `src/features/compas/components/CompasSheets.tsx:1137` |
| Offres | onglet | tiroir resa › Offres | `src/features/compas/components/CompasSheets.tsx:1137` |
| États | onglet | tiroir resa › États | `src/features/compas/components/CompasSheets.tsx:1137` |
| Chercher un hébergement pour | liste | tiroir résa › nuits › recherche | `src/features/compas/components/CompasSheets.tsx:2102` |
| Chercher | bouton · désactivé parfois | tiroir résa › nuits › recherche | `src/features/compas/components/CompasSheets.tsx:2110` |
| [cp-row] | geste (double-touche) | tiroir résa › nuits › recherche | `src/features/compas/components/CompasSheets.tsx:2136` |
| Noter | bouton · désactivé parfois | tiroir résa › nuits › recherche | `src/features/compas/components/CompasSheets.tsx:2166` |
| Voir l’offre | lien | tiroir résa › nuits › recherche | `src/features/compas/components/CompasSheets.tsx:2180` |
| Hébergement de la nuit du jour … | champ | tiroir résa › nuits | `src/features/compas/components/CompasSheets.tsx:2241` |
| OK | bouton · désactivé parfois | tiroir résa › nuits | `src/features/compas/components/CompasSheets.tsx:2264` |
| …… | lien | tiroir résa › nuits | `src/features/compas/components/CompasSheets.tsx:2280` |
| [button] | onglet | tiroir résa › offres | `src/features/compas/components/CompasSheets.tsx:2476` |
| Chercher un hébergement nuit par nuit | bouton | tiroir résa › offres | `src/features/compas/components/CompasSheets.tsx:2498` |
| …… | lien | tiroir résa › offres | `src/features/compas/components/CompasSheets.tsx:2518` |
| Départ de | champ | tiroir résa › offres › recherche | `src/features/compas/components/CompasSheets.tsx:2606` |
| Prise du véhicule à | champ | tiroir résa › offres › recherche | `src/features/compas/components/CompasSheets.tsx:2621` |
| Recherche… | bouton · désactivé parfois | tiroir résa › offres › recherche | `src/features/compas/components/CompasSheets.tsx:2635` |
| … | lien | tiroir résa › offres › recherche | `src/features/compas/components/CompasSheets.tsx:2703` |

## Verdict — 13

| Nom accessible | Type | Écran | Source |
|---|---|---|---|
| … autre signal | bouton | carte verdict | `src/features/compas/components/CompasCards.tsx:938` |
| Verdict | bouton | écran du Compas | `src/features/compas/components/CompasScreen.tsx:948` |
| Risques | onglet | tiroir verdict › Risques | `src/features/compas/components/CompasSheets.tsx:1137` |
| Météo | onglet | tiroir verdict › Météo | `src/features/compas/components/CompasSheets.tsx:1137` |
| Veille | onglet | tiroir verdict › Veille | `src/features/compas/components/CompasSheets.tsx:1137` |
| Sources | onglet | tiroir verdict › Sources | `src/features/compas/components/CompasSheets.tsx:1137` |
| L’IA lit les signaux… | bouton · désactivé parfois | tiroir verdict › explication | `src/features/compas/components/CompasSheets.tsx:2839` |
| Décaler | bouton · désactivé parfois | tiroir verdict › veille | `src/features/compas/components/CompasSheets.tsx:2982` |
| Ajouter à l’inventaire | bouton | tiroir verdict › sources | `src/features/compas/components/CompasSheets.tsx:3095` |
| Meteoalarm | lien | verdict › alertes officielles | `src/features/compas/components/MeteoalarmNotice.tsx:35` |
| www.meteoalarm.org | lien | verdict › alertes officielles | `src/features/compas/components/MeteoalarmNotice.tsx:47` |
| … | résumé | verdict › alertes officielles | `src/features/compas/components/OfficialAlertTexts.tsx:50` |
| … | lien | verdict › alertes officielles | `src/features/compas/components/WorldAlertNotice.tsx:36` |

## Kit — 70

| Nom accessible | Type | Écran | Source |
|---|---|---|---|
| …… × …… · … · … · vital · boutique … | zone cliquable | ligne d’objet | `src/features/compas/components/CompasCards.tsx:110` |
| …… × …… · … · … · vital · boutique … | geste (appui long) | ligne d’objet | `src/features/compas/components/CompasCards.tsx:110` |
| [cp-row] | geste (glisser) | ligne d’objet | `src/features/compas/components/CompasCards.tsx:110` |
| …… × …… · … · … · vital · boutique … | bouton | ligne d’objet | `src/features/compas/components/CompasCards.tsx:143` |
| Retirer du kit : … | bouton · désactivé parfois | ligne d’objet | `src/features/compas/components/CompasCards.tsx:166` |
| … | bouton · désactivé parfois | ligne d’objet | `src/features/compas/components/CompasCards.tsx:184` |
| ……— | bouton | carte kit | `src/features/compas/components/CompasCards.tsx:1023` |
| … | bouton | carte kit | `src/features/compas/components/CompasCards.tsx:1042` |
| Voir le sac de … | bouton | carte kit | `src/features/compas/components/CompasCards.tsx:1072` |
| … | bouton | carte kit | `src/features/compas/components/CompasCards.tsx:1099` |
| Réessayer | bouton | fiche objet › historique | `src/features/compas/components/CompasItemHistory.tsx:81` |
| Voir mes commandes | lien | fiche objet › historique | `src/features/compas/components/CompasItemHistory.tsx:118` |
| Kit | bouton | écran du Compas | `src/features/compas/components/CompasScreen.tsx:948` |
| Fiche | onglet | fiche objet | `src/features/compas/components/CompasSheets.tsx:195` |
| Historique | onglet | fiche objet | `src/features/compas/components/CompasSheets.tsx:196` |
| Déballer | bouton | fiche objet | `src/features/compas/components/CompasSheets.tsx:280` |
| Porteur | bouton | fiche objet | `src/features/compas/components/CompasSheets.tsx:288` |
| Je l’ai récupéré | bouton · désactivé parfois | fiche objet | `src/features/compas/components/CompasSheets.tsx:299` |
| … | bouton | fiche objet | `src/features/compas/components/CompasSheets.tsx:322` |
| Fiche produit | lien | fiche objet | `src/features/compas/components/CompasSheets.tsx:336` |
| Confirmer le retrait | bouton · désactivé parfois | fiche objet | `src/features/compas/components/CompasSheets.tsx:344` |
| Annuler | bouton | fiche objet | `src/features/compas/components/CompasSheets.tsx:358` |
| Retirer du kit | bouton | fiche objet | `src/features/compas/components/CompasSheets.tsx:363` |
| …… · occasion… · ★ … (… avis)… | geste (double-touche) | fiche objet › produits | `src/features/compas/components/CompasSheets.tsx:409` |
| Fiche produit : … | lien | fiche objet › produits | `src/features/compas/components/CompasSheets.tsx:449` |
| … | bouton · désactivé parfois | fiche objet › produits | `src/features/compas/components/CompasSheets.tsx:457` |
| … | champ | recherche | `src/features/compas/components/CompasSheets.tsx:482` |
| Emprunter · … | onglet | trouver un objet | `src/features/compas/components/CompasSheets.tsx:538` |
| Louer · … | onglet | trouver un objet | `src/features/compas/components/CompasSheets.tsx:543` |
| Acheter · … | onglet | trouver un objet | `src/features/compas/components/CompasSheets.tsx:548` |
| Inviter depuis le Hub | lien | trouver un objet | `src/features/compas/components/CompasSheets.tsx:567` |
| Emprunter | bouton · désactivé parfois | trouver un objet | `src/features/compas/components/CompasSheets.tsx:582` |
| Voir la location | lien | trouver un objet | `src/features/compas/components/CompasSheets.tsx:634` |
| Voir le panier | lien | trouver un objet | `src/features/compas/components/CompasSheets.tsx:681` |
| [button] | onglet | ajouter un objet | `src/features/compas/components/CompasSheets.tsx:750` |
| Ajouter à l’inventaire | bouton | ajouter un objet | `src/features/compas/components/CompasSheets.tsx:768` |
| Ajouter | bouton · désactivé parfois | ajouter un objet | `src/features/compas/components/CompasSheets.tsx:793` |
| Voir toute la boutique | bouton | ajouter un objet | `src/features/compas/components/CompasSheets.tsx:828` |
| Nom | champ | ajouter un objet › libre | `src/features/compas/components/CompasSheets.tsx:906` |
| Catégorie | liste | ajouter un objet › libre | `src/features/compas/components/CompasSheets.tsx:917` |
| Poids (g), si connu | champ | ajouter un objet › libre | `src/features/compas/components/CompasSheets.tsx:927` |
| Vital | case | ajouter un objet › libre | `src/features/compas/components/CompasSheets.tsx:933` |
| Consommable | case | ajouter un objet › libre | `src/features/compas/components/CompasSheets.tsx:936` |
| Quantité | champ | ajouter un objet › libre | `src/features/compas/components/CompasSheets.tsx:940` |
| Ajouter | bouton · désactivé parfois | ajouter un objet › libre | `src/features/compas/components/CompasSheets.tsx:951` |
| Commun au groupe | onglet | porteur | `src/features/compas/components/CompasSheets.tsx:1030` |
| Personnel | onglet | porteur | `src/features/compas/components/CompasSheets.tsx:1031` |
| …… (moi)porte … sur … | bouton · désactivé parfois | porteur | `src/features/compas/components/CompasSheets.tsx:1038` |
| Personne pour l’instant | bouton · désactivé parfois | porteur | `src/features/compas/components/CompasSheets.tsx:1073` |
| Conseils | onglet | tiroir kit › Conseils | `src/features/compas/components/CompasSheets.tsx:1137` |
| Mes kits | onglet | tiroir kit › Mes kits | `src/features/compas/components/CompasSheets.tsx:1137` |
| Inventaire | onglet | tiroir kit › Inventaire | `src/features/compas/components/CompasSheets.tsx:1137` |
| Trouver | onglet | tiroir kit › Trouver | `src/features/compas/components/CompasSheets.tsx:1137` |
| Emballer | onglet | tiroir kit › Emballer | `src/features/compas/components/CompasSheets.tsx:1137` |
| Tout | onglet | tiroir kit › Tout | `src/features/compas/components/CompasSheets.tsx:1137` |
| Sacs | onglet | tiroir kit › Sacs | `src/features/compas/components/CompasSheets.tsx:1137` |
| Eau | onglet | tiroir kit › Eau | `src/features/compas/components/CompasSheets.tsx:1137` |
| Ajouter au kit | bouton | tiroir kit › liste | `src/features/compas/components/CompasSheets.tsx:3135` |
| Ajouter | bouton | tiroir kit › conseils | `src/features/compas/components/CompasSheets.tsx:3226` |
| Créer mon kit | bouton | tiroir kit › mes kits | `src/features/compas/components/CompasSheets.tsx:3428` |
| Nom | champ | tiroir kit › mes kits | `src/features/compas/components/CompasSheets.tsx:3453` |
| Saison | liste | tiroir kit › mes kits | `src/features/compas/components/CompasSheets.tsx:3467` |
| Ajoute d’abord des objets | bouton · désactivé parfois | tiroir kit › mes kits | `src/features/compas/components/CompasSheets.tsx:3477` |
| Déjà complet | bouton · désactivé parfois | tiroir kit › mes kits | `src/features/compas/components/CompasSheets.tsx:3531` |
| Ajouter à l’inventaire | bouton | tiroir kit › inventaire | `src/features/compas/components/CompasSheets.tsx:3748` |
| Tout (…) | onglet | tiroir kit › inventaire | `src/features/compas/components/CompasSheets.tsx:3765` |
| Fiche : … | bouton | tiroir kit › inventaire | `src/features/compas/components/CompasSheets.tsx:3797` |
| Ajouter au kit : … | bouton · désactivé parfois | tiroir kit › inventaire | `src/features/compas/components/CompasSheets.tsx:3806` |
| ……Commun sans porteur · à peserQui porte ? | bouton | tiroir kit › sacs | `src/features/compas/components/CompasSheets.tsx:3856` |
| …Sac de …… sur … | bouton | tiroir kit › sacs | `src/features/compas/components/CompasSheets.tsx:3883` |

## Primitives (non comptées : chaque usage est inventorié)

- `src/features/compas/components/CompasPrimitives.tsx:280` Segments › bouton

