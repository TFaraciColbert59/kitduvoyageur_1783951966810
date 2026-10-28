# Fiche carnet par jour — design

**Intention.** Un carnet se vit sur plusieurs jours. La carte d'identité devient le réceptacle des jours :
elle se balaie J1 → Jn, avec, pour chaque jour, ses propres photos, sa distance, son dénivelé, son activité,
et la carte du bas qui glisse **cinématiquement** sur le segment du jour. Une page **Résumé**, en tête,
agrège tout le carnet (totaux, tracé complet).

**Référence visuelle.** Page `/compte` : carte `12/48/406×541`, grille `134 / gap 2 / rayon 2`, sélecteur
`88×30`, barre basse `14/868/402×48`, verre et ombres du Compte. La carte du bas occupe **40 %** de la
hauteur de page (`height: 40dvh`). Aucune de ces valeurs ne change.

## Décisions

1. **Swipe de la carte = changement de jour.** Le carrousel (Posts / Parcours / Étapes / Matériel / Nature)
   se pilote uniquement par le sélecteur du bas.
2. **La barre d'action de la carte est celle des drawers** : on supprime la capsule actuelle (♥ 💬 🔖 ▦ 🗺)
   et on pose la capsule `88×30` à 2 segments, lentille comprise, à 10 px du bord bas-droit.
3. **Jour sans donnée** : il reste dans le balayage, avec `— km`, `— m`, aucune photo et un état vide sobre.
   On ne saute pas les jours : la numérotation doit rester vraie.
4. **Trace par jour = découpage par date** des points GPS des sorties du carnet (chaque point est horodaté).
   Plusieurs sorties le même jour → les points sont **fusionnés**. Aucune migration, aucune nouvelle table.
5. **Résumé** : page 0 du balayage, totaux du carnet et **tracé complet** ; c'est aussi l'état par défaut.

## Anatomie

```
J0 Résumé | J1 | J2 | … | Jn        ← balayage horizontal de la carte entière
┌────────────────────────────────┐
│ pill titre  ✚  🔔  ···         │ top bar 36 (inchangée)
│ ⬤ marqueur de jour  « 25 avr. »│ pastille de jour (pas un titre)
│ 18,4 km  620 m  6 h            │ stats du jour, gabarits actuels
│ Islande · Landmannalaugar      │ ligne de lieu (inchangée)
│ [participants]                 │ pastilles (inchangées)
│ grille des posts du jour       │ 134 / gap 2 / rayon 2, 3 colonnes
│              [▦ | 🗺]          │ capsule 88×30 des drawers
├────────────────────────────────┤
│ carte 3D — tracé du jour       │ 40 % de la page
└────────────────────────────────┘
```

- **Résumé** : `180 km · 1 800 m · 7 jours`, tracé complet, grille = tous les moments.
- **Jour n** : distance/D+/durée du segment, moments du jour uniquement, carte cadrée sur le segment.
- **Carte cinématique** : au changement de jour, `flyTo` (900 ms, `cubic-bezier(.22,1,.36,1)`, pitch 45)
  vers le centre du segment, puis le tracé du jour est peint (liseré blanc 6, halo `#5B7F55`, ligne `#17402C`).
  `prefers-reduced-motion` → `jumpTo` sans animation.

## Données

Aucune migration. Dérivations côté serveur (`src/features/carnet/detail`) :

- `days: CarnetDay[]` — pour chaque `jour_numero` présent dans les moments **ou** dans les points GPS :
  `{ index, date, distanceKm|null, elevationM|null, durationS|null, moments[], traceGeoJson|null }`
- `summary` — totaux du carnet (distance, D+, jours, moments), tracé complet.
- Le découpage par date utilise `start_date` du carnet + `jour_numero` ; à défaut, la date du premier point GPS.
- Aucune valeur inventée : une donnée absente reste `null` et s'affiche `—`.

## États

- Chargement : squelette de carte (barre, chiffres, grille).
- Jour vide : `— km`, `— m`, état vide de grille, carte sans tracé (état vide existant).
- Erreur : un seul message sobre dans la carte, jamais d'écran global.
- `prefers-reduced-motion` respecté pour le balayage et la caméra.

## Hors périmètre

- Création/édition d'un jour (nouvelle table, nouveau formulaire) : lot ultérieur.
- Modification du formulaire de création existant.
- Toute modification de `src/components/compte/**`, de la barre basse, de la messagerie.

## Preuves attendues

- Captures 430×932 : Résumé, J1 avec tracé, J2 sans GPS (état vide), captation de la caméra à mi-vol.
- Mesures : carte `12/48/406×541`, grille `134`, capsule `88×30` à 10/10, `scrollHeight = innerHeight`.
- Diff pixel sur le châssis : 0.
