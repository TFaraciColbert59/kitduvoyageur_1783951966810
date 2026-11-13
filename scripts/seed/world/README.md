# Monde LKDV — seed de démonstration

Ce dossier contient le système qui a créé le « Monde LKDV » dans le projet
Supabase `icxyvwzfjbflcbqukpfz` : 50 résidents fictifs, 1 compte démo
ultra-complet, et la vie sociale, voyage, club, matériel et fidélité
correspondante.

## Accès démo

- Email : `demo@lkdv.app`
- Mot de passe : dans `scripts/seed/world/.manifest/world-v1.credentials.json`
  (fichier local, chmod 600, jamais versionné).
- Profil : Léa Fontaine, Lille, `@lea_fontaine`.

## Chiffres du monde (vérifiés le 2026-10-23)

| Élément | Volume |
|---|---|
| Résidents | 50 (47 publics, 3 privés) |
| Compte démo | 14 posts, 10 carnets, 12 voyages, 18 sorties, 50 abonnés |
| Posts | 196 |
| Commentaires | 828 |
| Likes | ~2 700 |
| Stories actives | 85 |
| Carnets | 82 (dont 10 pour la démo) |
| Médias de carnet | 258 |
| Sorties | 131 (dont 72 photos uploadées) |
| Voyages | 56 créés par le seed (+ existants) |
| Clubs enrichis | 18 |
| Événements à venir | 18 |
| Conversations | 66 |
| Messages | 395 |
| Kits matériel | 86 |
| Commandes | 101 |
| Badges attribués | 221 |
| Notifications | ~5 000 (12 non lues pour la démo) |
| Événements live | 155 |

## Commandes

```bash
# Vérifier les invariants (aucune écriture)
node scripts/seed/world/verify.mjs

# Rejouer une phase (idempotent)
node scripts/seed/world/run.mjs --only=identity --apply
node scripts/seed/world/run.mjs --only=carnets --apply
node scripts/seed/world/run.mjs --only=social --apply
node scripts/seed/world/run.mjs --only=outings --apply
node scripts/seed/world/run.mjs --only=trips --apply
node scripts/seed/world/run.mjs --only=community --apply
node scripts/seed/world/run.mjs --only=messaging --apply
node scripts/seed/world/run.mjs --only=extras --apply

# Tout rejouer
node scripts/seed/world/run.mjs --apply
```

Prérequis : `SUPABASE_SERVICE_ROLE_KEY` dans `.env.local` (jamais commité).

## Structure

- `run.mjs` — orchestrateur CLI (`--dry-run`, `--apply`, `--only=...`).
- `data/personas/` — les 50 biographies + la démo.
- `data/clubs.mjs`, `data/events.mjs`, `data/guides.mjs`, `data/media.mjs`.
- `build/` — un constructeur par domaine (identité, social, sorties, carnets,
  voyages, clubs, messagerie, profil+).
- `lib/` — env, IDs UUID v5, horloge, client, batchs, schéma, médias, manifeste.
- `verify.mjs` — 21 invariants (profils, visibilité, volumes, cohérence).
- `.manifest/` — manifeste des entités et identifiants (local, ignoré par git).

## Notes

- Les identifiants des résidents sont aléatoires (auth Supabase) ; les IDs des
  contenus sont déterministes (UUID v5) pour permettre le rejeu.
- Les photos publiques sont des URLs Unsplash. Les photos de sortie sont
  uploadées dans le bucket privé `outing-media`.
- Les 19 clubs historiques sans vie ont été masqués (`privacy = secret`) et
  leurs compteurs remis à zéro. Réversible.
- Les événements historiques passés ont été marqués `past`.
- Les comptes de test historiques n'ont pas été supprimés ; ils restent hors du
  casting.
- Limites connues de l'app (hors périmètre données) :
  - les statistiques d'un profil public (`/profil/[id]`) sont calculées depuis
    `activities`, dont la RLS ne montre que ses propres lignes ; un visiteur
    voit donc 0 sortie/0 km. Le drawer Compte, lui, affiche les vrais chiffres.
  - `/feed` est statique ; la surface sociale réelle est `/communaute`.
  - les pages `/experts`, `/ambassadeurs`, `/createurs` sont des placeholders
    sans lecture en base.
