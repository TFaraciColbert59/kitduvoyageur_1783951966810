# Audit carnet — dossier de livraison

**Date :** 2026-10-24
**Route :** `/carnets/[id]`
**Repo :** `/Users/fr168256/Desktop/lkdv-communaute-feed`
**Statut :** audit terminé, aucune modification du code applicatif.

## Fichiers

| Fichier | Contenu |
|---|---|
| `00-synthese.md` | Synthèse exécutive, 20 constats majeurs, scorecard, décision demandée |
| `AUDIT-COMPLET.md` | Audit détaillé : architecture, BDD/RLS, API/sécurité, fonctionnel, visuel, perf, a11y, SEO, tests, contenu |
| `08-contrat-refonte.md` | Contrat de refonte : 2 variantes, anatomie cible, tokens, mapping composants, plan de migration |
| `09-journal-verifications.md` | Journal brut des commandes, mesures et réponses live |
| `10-spec-visuelle-carnet.md` | Dictionnaire des composants, boutons, drawers, typographie, couleurs, accessibilité |
| `11-disposition-compte-carnet.md` | **Disposition autoritaire** : la fiche carnet reprend le shell et la carte d’identité de la page Compte |
| `BRIEF.md` | Cadre et règles de l'audit |
| `evidence/` | Captures desktop/tablette/mobile, 404, commentaires, carte, carnet sans auteur |

## Les 5 preuves à regarder en premier

1. `evidence/carnet-768.png` — le centre fait **152 px** à 768 px, la page est illisible.
2. `evidence/carnet-chartreuse-430.png` — carnet sans auteur : « Antoine Duprès », 3 jours à 9,1 km / 540 m inventés, 24 likes et 2 commentaires faux.
3. `evidence/carnet-430-comments.png` — champ de commentaire blanc sur blanc.
4. `evidence/carnet-430-map.png` — deux barres empilées de 102 px, carte sous le contenu.
5. `evidence/carnet-404.png` — 404 soft (HTTP 200) avec la navigation carnet encore active.

## Chiffres clés

- 82 carnets, tous publics ; 3 sans auteur ; 1 avec `groupe_id`.
- 228 moments, 35 sans image, 39 sans auteur.
- 130 commentaires, 596 likes, 2 320 vues, 258 médias **non utilisés** par la fiche.
- Carnet test : 6 likes / 3 commentaires en base, **24 / 8 affichés**.
- 768 px : centre **152 px** ; 1024 px : **379 px** ; 1440 px : **702 px**.
- Route : **306 Ko gzip** de JS, **~1,08 Mo** raw.
- LCP mesuré : **5,49 s** (local, cover Unsplash 1200 px) ; TTFB **2,1–2,6 s**.
- **0 test** dédié à la fiche carnet.

## Comment reproduire

```bash
# serveur de dev utilisé
cd /Users/fr168256/Desktop/lkdv-communaute-feed
npx next dev -p 4015

# carnet public riche
open http://127.0.0.1:4015/carnets/6f39f0d3-2f4b-5006-a1f1-0e0c0d354802

# carnet sans auteur / groupe
open http://127.0.0.1:4015/carnets/5f319c5d-1008-4bc8-ae63-9dd788dae440

# 404 soft
curl -i http://127.0.0.1:4015/carnets/does-not-exist-xyz
```

## Limites

- Mesures perf locales, non représentatives du CDN.
- Contraste non mesuré au pixel (suspicions).
- XSS JSON-LD prouvée par le code, non exploitée en live.
- Carnet privé prouvé par le chemin de code, aucun carnet privé en base.
- Pas de test lecteur d'écran manuel.
