# 07 — Recette et rapport final

Chaque case cochée l'est avec une preuve (capture, sortie de commande, lien de run CI) rangée dans `docs/audit/carnet-v2-<date>/` (règle CLAUDE.md § 1.4 : aucune case cochée sans preuve).

## A. Aperçu Vercel
- [ ] Fiche d'un carnet public de démo : rendu identique à la maquette (captures 390×844 côte à côte, chaque tiroir et lentille).
- [ ] Gestes : swipe de jour (2 sens), capsule, trace sur la carte, tiroir (ouverture, poignée, Échap), lentilles (glisser, mini-capsule), appuis longs, story (maintien, tap, glisser).
- [ ] Post : like, commentaire, partage, options, navigation entre médias.
- [ ] Réactions par jour isolées par jour.
- [ ] Nuit cliquable, fiche participant en grille, pilule Reprendre.
- [ ] Visiteur : restrictions (`01` § 7), carnet privé = 404.
- [ ] 0 erreur console, 0 débordement 360/390/430, a11y sans critical/serious.

## B. Production
- [ ] Même liste qu'en A sur la prod, avec un vrai carnet de démo et un carnet de test créé pour l'occasion (repassé en privé à la fin).
- [ ] Réponse à une story reçue dans la messagerie du compte de démo destinataire.
- [ ] Position en direct : exacte côté participant, zone arrondie et différée côté visiteur, rien si le partage est off.
- [ ] `/compte`, `/communaute`, `/messagerie`, hub carnets, création de carnet : aucune régression (parcours rapide + e2e existants verts).
- [ ] 30 min de surveillance sans 5xx ni rapport CSP nouveau.

## C. iPhone
- [ ] App installée via Xcode, ouverture d'un carnet depuis la communauté et depuis une notification.
- [ ] Haptique sur sélecteurs, ouverture/fermeture de tiroir, like, envoi.
- [ ] Safe areas correctes (encoche, indicateur d'accueil), clavier qui ne masque pas le champ de réponse.
- [ ] Flow Maestro `.maestro/carnet.yaml` vert.

## Modèle de `handoff/carnet-v2/RAPPORT.md`
```markdown
# Rapport — fiche carnet v2
Statut : TERMINÉ | TERMINÉ SAUF <étape> (raison, commande pour reprendre)
PR : <lien> · Commit de fusion : <sha> · Déploiement prod : <url> · Drapeau NEXT_PUBLIC_CARNET_V2 : true
Migrations appliquées en prod : <liste version → lot> · Sauvegarde : <id run db-backup>
Portes qualité : <liens des runs CI> · Tests ajoutés : <nombre par type>
Recette A/B/C : <cases + lien du dossier de preuves>
iPhone : <modèle, iOS, résultat>
Écarts assumés vs maquette / /compte : <liste + raison>
Décisions prises seul : <renvoi au JOURNAL.md>
Retour arrière : <commandes exactes>
Suites proposées : accès anonyme aux carnets publics (middleware), TestFlight, retrait de CarnetScreen v1 (PR brouillon <lien>)
```
