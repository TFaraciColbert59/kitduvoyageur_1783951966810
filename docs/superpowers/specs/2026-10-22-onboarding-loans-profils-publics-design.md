# Prêts, parcours de démarrage et profils publics — design

**Date :** 2026-10-22
**Statut :** validé par la demande « carte blanche, plan puis démarre »

## 1. Objectif

Trois surfaces restent en retrait par rapport au nouveau drawer Profil :

1. **J’emprunte** (drawer Prêts) doit avoir la même qualité de contenu et de
   matière que les autres sous-drawers.
2. Un compte qui vient d’être créé doit être accompagné par un **parcours de
   commencement** non bloquant, fluide, qui explique le produit et donne envie
   d’agir sans rien forcer.
3. Les **profils des autres utilisateurs** doivent utiliser le même langage
   visuel que le drawer Profil, sur mobile et sur desktop, à 100 %.

## 2. J’emprunte — contenu

- En-tête : « X emprunts en cours · Y à rendre cette semaine » et un état
  « en retard » discret.
- Filtre local : **Tous / À rendre / En retard / Historique**.
- Carte d’emprunt :
  - objet, propriétaire (avatar + nom), dates, échéance relative
    (« dans 3 j », « en retard de 2 j ») ;
  - statut, note éventuelle ;
  - action principale **Rendre** (ou **Accepter** si en attente), menu
    **Signaler**.
- État vide : « Tu n’empruntes rien pour le moment », texte, bouton
  **Découvrir le matériel** → `/materiel`.
- La lentille Confiance garde sa carte agrégée, sans historique détaillé.
- Toutes les actions passent par `/api/compte/loans` ; aucune donnée inventée.

## 3. Parcours de commencement

### Déclenchement

- Compte authentifié créé depuis moins de 7 jours **et** aucune activité
  (0 sortie, 0 kit, 0 abonnement, 0 carnet).
- Ouverture automatique **une seule fois**, 1,4 s après le chargement du
  Compte, uniquement si l’utilisateur ne l’a pas déjà fermé.
- Jamais de blocage : bouton **Plus tard**, **Passer**, clic hors feuille,
  et entrée permanente **Parcours de découverte** dans Paramètres.

### Étapes (5)

1. **Bienvenue** — ce que LKDV fait : trace, kit, cordée.
2. **Ton profil** — photo, bio, massif → ouvre l’onglet Profil du drawer Compte.
3. **Ta première sortie** — enregistrer une trace → `/compas`.
4. **Ton premier kit** — composer un kit → `/materiel`.
5. **Ta cordée** — suivre et être suivi → ouvre le drawer Réseau.
6. **Partager** — lien/QR → ouvre l’onglet Partager.

Chaque étape se valide par les **faits réels** (profil complété, sortie
existante, kit existant, follow/cordée, partage) et non par un simple clic.
Le parcours se ferme dès qu’une action est lancée ; il se reprend plus tard.

### Persistance

- `localStorage` par utilisateur : `lkdv_onboarding_<userId>` avec
  `{ dismissedAt, completed, lastStep }`.
- Aucune migration : le parcours est une aide, pas une donnée métier.
- Un endpoint `/api/compte/onboarding` renvoie les compteurs réels et
  `isNew` pour décider de l’ouverture.

### UX

- Feuille basse en verre, sans scrim noir bloquant ; elle laisse voir le
  Compte derrière.
- Progression 1/5, titre, 2 lignes, CTA principal, **Plus tard**.
- Transition douce (translateY + opacité), `prefers-reduced-motion` respecté.

## 4. Profils publics — refonte 100 %

- Nouveau composant `PublicProfileV2` :
  - en-tête compact : retour, avatar, nom, handle, massif, **Suivre**,
    message, partage, signalement ;
  - puis le **même shell que le drawer Profil** (`ProfileDrawerHost`,
    viewer `visitor`) : capsule 48 px, 5 slots, lentille basse, glissement
    sans ghost ;
  - mobile : plein écran ; desktop : colonne de 480 px centrée sur fond
    d’ambiance, même expérience.
- Données réelles uniquement :
  - profil, carnets, clubs, badges, activité déjà chargés par
    `/profil/[id]` ;
  - agrégats Vitrine depuis `profile.stats` ;
  - albums À la une depuis les carnets ;
  - sorties : vides si la RLS ne les expose pas (aucune fausse trace).
- Le propriétaire qui ouvre son propre `/profil/[id]` garde les actions
  propriétaire ; un visiteur ne voit que Suivre / Message / Signaler.
- `PublicMobileProfileView` et le rendu desktop historique sont remplacés
  par `PublicProfileV2`.

## 5. Fichiers

```
src/components/compte/drawer/slots/LoansSlot.tsx      (J’emprunte)
src/components/compte/onboarding/FirstRunJourney.tsx
src/components/compte/onboarding/onboardingSteps.ts
src/app/api/compte/onboarding/route.ts
src/features/compte/server/onboarding.ts
src/components/profile/PublicProfileV2.tsx
src/app/profil/[id]/page.tsx
src/components/compte/CompteLiquidGlassV8.tsx
```

## 6. Vérification

- Tests unitaires : mapping des étapes, compteurs, payload public.
- Tests UI : filtre emprunts, état vide, parcours (ouverture/fermeture,
  progression), profil public (visiteur, propriétaire, privé).
- `tsc`, build, captures mobile 430 et 390, production, console 0 erreur.
