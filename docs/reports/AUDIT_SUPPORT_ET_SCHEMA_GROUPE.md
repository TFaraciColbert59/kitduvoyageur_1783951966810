# Rapport d'Audit Préalable — Support & Schéma Groupes LKDV

Ce rapport documente les résultats factuels et vérifiés sur le code front réel pour les deux axes d'audit demandés.

---

## 🔎 AUDIT 1 — Canal de Support / Contact Existant

### 1. Résultats bruts des commandes exécutées

#### A. Recherche des liens `mailto:` dans le projet
```
src/app/contact/page.tsx:23               sav@lekitduvoyageur.fr (Support client)
src/app/contact/page.tsx:24               retour@lekitduvoyageur.fr (Retours & remboursements)
src/app/contact/page.tsx:25               dpo@lekitduvoyageur.fr (DPO — Données personnelles)
src/app/contact/page.tsx:26               contact@lekitduvoyageur.fr (Partenariats & B2B)
src/app/cgu/page.tsx:61, 96, 162          contact@lekitduvoyageur.fr
src/app/cgv/page.tsx:31, 85, 87           contact@lekitduvoyageur.fr
src/app/mentions-legales/page.tsx:26, 86  contact@lekitduvoyageur.fr
src/app/politique-confidentialite/...     dpo@lekitduvoyageur.fr / contact@lekitduvoyageur.fr
```

#### B. Recherche de widgets de chat tiers (`crisp`, `intercom`, `zendesk`, `freshdesk`, `tawk`)
- **Résultat dans `package.json` et `src/`** : Aucun package ni script de widget de chat tiers n'est installé ou importé.

#### C. Analyse des pages Contact & FAQ
- **Page `/contact` (`src/app/contact/page.tsx`)** : Page officielle et active contenant :
  1. Les adresses mailto officielles (`sav@lekitduvoyageur.fr`, `contact@lekitduvoyageur.fr`).
  2. Un formulaire d'envoi de message avec confirmation visuelle.
- **Page `/faq` (`src/app/faq/page.tsx`)** : Base de connaissances sans chat direct.

### 💡 Conclusion Audit 1
> **Canaux existants réutilisables** :
> - Email général / modération : `contact@lekitduvoyageur.fr`
> - Support client : `sav@lekitduvoyageur.fr`
> - Page web de contact : `/contact`
> 
> *Aucun widget tiers n'existe. Tous les messages de suspension, de signalement et de rappel de sécurité doivent orienter vers `contact@lekitduvoyageur.fr` et la page `/contact`.*

---

## 🔎 AUDIT 2 — Schéma de Groupe Réellement Actif (`travel_groups` vs `groupes`)

### 1. Résultats bruts des commandes exécutées

#### A. Fichiers utilisant `travel_groups` / `group_members` :
1. `src/app/nouveau-groupe/page.tsx` (L155) : **Écriture** — Crée les nouveaux groupes dans `travel_groups` et l'organisateur dans `group_members`.
2. `src/app/groupes/[groupId]/page.tsx` via `src/lib/queries/groupe.ts` (L45) : **Lecture** — Charge en priorité depuis `travel_groups`, puis charge les membres depuis `group_members`, les dépenses depuis `group_expenses`, les tâches depuis `group_tasks`, les messages depuis `group_messages`, et les sondages depuis `group_polls`.
3. `src/components/pays/BouteilleALaMer.tsx` : **Lecture & Écriture** — Lit les groupes publics depuis `travel_groups`, crée les groupes dans `travel_groups`, gère les demandes dans `group_members`.
4. `src/app/groupes/page.tsx` : **Lecture** — Liste les groupes de voyage depuis `travel_groups`.
5. `src/app/communaute/page.tsx` : **Lecture** — Affiche les expéditions actives depuis `travel_groups`.
6. `src/components/groupes/VoyageursCard.tsx` : **Lecture & Écriture** — Gère les membres actifs/invités depuis `group_members`.
7. `src/components/compte/MobileCompteV2.tsx` : **Lecture** — Affiche les groupes rejoints par l'utilisateur depuis `travel_groups` et `group_members`.

#### B. Fichiers utilisant `groupes` / `groupe_membres` (schéma français) :
1. `src/components/compte/AventuresTab.tsx` (L36) : **Lecture** — Tente de lire `groupes` (retourne une liste vide car `groupes` est vide en base).
2. `src/app/profil/[id]/page.tsx` (L86) : **Lecture** — Tente de lire l'onglet groupes d'un profil tiers dans `groupes`.
3. `src/lib/supabase/queries-compte.ts` (L385) : **Lecture** — Fonction utilitaire non appelée par le flux principal.

### 💡 Conclusion Audit 2
> **Schéma actif unifié** : 
> - **`travel_groups` + `group_members`** est le schéma actif utilisé de bout en bout pour la **création** (`/nouveau-groupe`, `BouteilleALaMer.tsx`), l'**affichage détail/cockpit** (`/groupes/[groupId]`), et les **listes communautaires** (`/groupes`, `/communaute`, `/pays/[code]`).
> - Il n'y a **pas d'incohérence entre la création et l'affichage détail** : un groupe créé dans `travel_groups` est bien lu par `/groupes/[groupId]` via `getGroupeComplet()` dans `travel_groups`.
> - La table française `groupes` est un reliquat legacy (ouvert pour compatibilité descendante) qui n'est plus alimenté par aucun flux de création.
