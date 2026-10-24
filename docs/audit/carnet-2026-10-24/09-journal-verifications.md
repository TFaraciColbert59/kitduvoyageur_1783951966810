# Journal des vérifications live — 24 octobre 2026

Ce journal consigne les commandes et résultats bruts utilisés dans l'audit. Il ne contient aucun secret.

## Environnement

| Élément | Valeur |
|---|---|
| Repo | `/Users/fr168256/Desktop/lkdv-communaute-feed` |
| Branche | `chantier/post-system` |
| Dev | `http://127.0.0.1:4015` (`next dev`, `DIST_DIR=.next-post-dev`) |
| Prod local | `http://127.0.0.1:4014` (`next start`, `DIST_DIR=.next-post-build`) |
| Base | Supabase `icxyvwzfjbflcbqukpfz` |
| Navigateur | Chromium Playwright, 430×932 / 768×1024 / 1024×768 / 1440×900 |

## 1. Statut HTTP et 404

```bash
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" \
  http://127.0.0.1:4015/carnets/does-not-exist-xyz
# 200 text/html; charset=utf-8

curl -s http://127.0.0.1:4015/carnets/does-not-exist-xyz \
  | grep -o '<meta name="robots"[^>]*>'
# <meta name="robots" content="noindex, nofollow"/>
```

**Conclusion :** soft 404, pas de `notFound()`.

## 2. API carnet

```bash
curl -s -o /tmp/carnet-api.json -w "%{http_code} %{size_download}\n" \
  http://127.0.0.1:4015/api/carnets/6f39f0d3-2f4b-5006-a1f1-0e0c0d354802
# 200 1255

curl -s -o /tmp/carnet-api-404.json -w "%{http_code} %{size_download}\n" \
  http://127.0.0.1:4015/api/carnets/does-not-exist
# 404 30
# {"error":"Carnet introuvable"}
```

## 3. Auth des routes

```bash
curl -s -o /tmp/species.json -w "%{http_code}\n" \
  -X POST http://127.0.0.1:4015/api/carnet/identify-species \
  -H 'Content-Type: application/json' --data '{"imageBase64":"AAAA"}'
# 401
# {"error":"Authentification requise"}

curl -s -o /tmp/publish.json -w "%{http_code}\n" \
  -X POST http://127.0.0.1:4015/api/carnets/6f39f0d3-2f4b-5006-a1f1-0e0c0d354802/publish
# 401
# {"error":"Non authentifié"}
```

**Conclusion :** les deux routes sont bien protégées par session. Le problème est le rendu serveur de la page, pas ces routes.

## 4. Base — volumétrie et cohérence

```sql
select
 (select count(*) from public.carnets) as carnets,
 (select count(*) from public.carnets where visibility='public') as public_carnets,
 (select count(*) from public.carnets where author_id is null) as author_null,
 (select count(*) from public.carnets where groupe_id is not null) as groupe_linked,
 (select count(*) from public.carnets where cover_image is null or cover_image='') as cover_missing,
 (select count(*) from public.carnet_moments) as moments,
 (select count(*) from public.carnet_moments where image_url is null or image_url='') as moments_without_image,
 (select count(*) from public.carnet_moments where auteur_id is null) as moments_author_null,
 (select count(*) from public.carnet_kit_items) as kit_items,
 (select count(*) from public.carnet_favorites) as favorites,
 (select count(*) from public.carnet_comments) as comments,
 (select count(*) from public.carnet_likes) as likes,
 (select count(*) from public.carnet_views) as views,
 (select count(*) from public.carnet_media) as media;
```

Résultat :

```json
{
  "carnets": 82,
  "public_carnets": 82,
  "author_null": 3,
  "groupe_linked": 1,
  "cover_missing": 11,
  "moments": 228,
  "moments_without_image": 35,
  "moments_author_null": 39,
  "kit_items": 223,
  "favorites": 178,
  "comments": 130,
  "likes": 596,
  "views": 2320,
  "media": 258
}
```

## 5. Carnet test « Tour du Mont-Blanc »

```sql
select c.id, c.title, c.visibility, c.author_id, c.verified,
 c.likes_count, c.comments_count, c.favorites_count,
 (select count(*) from public.carnet_likes l where l.carnet_id=c.id) as likes_real,
 (select count(*) from public.carnet_comments cm where cm.carnet_id=c.id) as comments_real,
 (select count(*) from public.carnet_media m where m.carnet_id=c.id) as media_real,
 (select count(*) from public.carnet_views v where v.carnet_id=c.id) as views_real
from public.carnets c
where c.id='6f39f0d3-2f4b-5006-a1f1-0e0c0d354802';
```

Résultat :

- `visibility = public`
- `verified = false`
- `likes_count = 0`, `comments_count = 0`, `favorites_count = 0`
- `likes_real = 6`, `comments_real = 3`, `media_real = 6`, `views_real = 47`

**Écart affiché :** 24 likes et 8 commentaires (desktop), 24 et 2 (mobile).

## 6. Carnet sans auteur / avec groupe

```sql
select id, title, groupe_id, author_id, visibility
from public.carnets where groupe_id is not null;
```

Résultat : `5f319c5d-1008-4bc8-ae63-9dd788dae440` — « Trois jours dans la Chartreuse », `author_id = null`.

```sql
select table_name from information_schema.tables
where table_schema='public'
  and table_name in ('groupe_etapes','groupe_hebergements');
```

Résultat : **aucune ligne**. Les deux tables n'existent pas.

Rendu live du carnet :

```text
Antoine Duprès
24
2
JOUR 1 ... 9.1 km ... 540 m D+
JOUR 2 ... 9.1 km ... 540 m D+
JOUR 3 ... 9.1 km ... 540 m D+
```

**Conclusion :** auteur fictif, statistiques divisées (27,4/3 et 1 620/3), lieux répétés.

## 7. Like — aucune requête

Avant clic : 6 requêtes `rest/v1` (profils, présence, favoris).

Clic sur « Aimer ce carnet » → compteur 24 → 25.

Après clic : **toujours 6 requêtes `rest/v1`**. Aucun `POST /rest/v1/carnet_likes`.

Refresh → 24.

## 8. Mesures DOM

### 768×1024

```json
{
  "mainW": 768,
  "children": [
    { "tag": "DIV", "w": 230, "h": 912 },
    { "tag": "DIV", "w": 152, "h": 912 },
    { "tag": "ASIDE", "w": 300, "h": 912 }
  ]
}
```

### 1024×768

```json
{
  "children": [
    { "w": 230 },
    { "w": 379, "scrollH": 3089 },
    { "w": 300 }
  ]
}
```

### 1440×900

```json
{
  "center": { "w": 702, "h": 788, "scrollH": 2207 },
  "docScrollH": 900
}
```

### Clavier

Focus initial : `BODY`. `PageDown` → `scrollTop` du centre = `0`, `scrollY = 0`.

### Nav mobile

```json
{
  "nav": { "y": 830, "h": 102 },
  "plateauButtons": { "y": 828.5, "h": 44 },
  "bottomBar": { "y": 870, "h": 60 }
}
```

### Champ commentaire

```json
{
  "placeholder": "Ajouter un commentaire...",
  "color": "rgb(255, 255, 255)",
  "backgroundColor": "rgb(255, 255, 255)",
  "fontSize": "16px"
}
```

### Cibles < 44 px

- Like carnet : 61×36
- Commentaire : 47×36
- Save : 36×36
- Share : 36×36
- GPX : 66×36
- Zoom carte : 24×24
- Chips kit : 32 px de haut

## 9. Performance (build production, port 4014)

```json
{
  "lcp": [
    { "t": 4328, "tag": "P" },
    { "t": 5492, "tag": "IMG", "class": "h-full w-full object-cover opacity-70" }
  ],
  "cls": 0.000566,
  "ttfb": 2572,
  "fcp": 4276,
  "domContentLoaded": 5522,
  "load": 7027
}
```

Chunks de la route :

```text
20 fichiers
1 076 434 octets raw
305 980 octets gzip
```

Réseau (1440, cache froid) :

```text
JS ~821 Ko
CSS ~333 Ko (dont image de fond 248 Ko)
```

## 10. Réseau et images

- 6 tuiles OSM chargées au premier écran desktop.
- Cover mobile : Unsplash 1200 px, `<img>` natif, `opacity-70`.
- Avatars : `i.pravatar.cc` 400 px pour 38 px affichés.
- Moments : Unsplash 800 px pour ~195 px affichés.
- Aucun `next/image` dans `src/components/carnet/**`.

## 11. Captures

| Capture | Ce qu'elle prouve |
|---|---|
| `evidence/carnet-1440.png` | layout 3 colonnes, hero, sidebars |
| `evidence/carnet-1440-light.png` | thème clair identique, encre blanche |
| `evidence/carnet-768.png` | centre 152 px, titre cassé |
| `evidence/carnet-430.png` | mobile, double barre, faux contenus |
| `evidence/carnet-430-map.png` | carte + plateau + barre basse |
| `evidence/carnet-430-comments.png` | champ blanc sur blanc, faux commentaires |
| `evidence/carnet-chartreuse-430.png` | auteur fictif, stats divisées |
| `evidence/carnet-404.png` | 404 soft avec navigation active |
| `evidence/communaute-430.png` | référence de style |
| `evidence/communaute-1440.png` | référence desktop 520 px |

## 12. Limites du journal

- Les mesures perf sont locales.
- L'XSS JSON-LD n'a pas été exploitée.
- Aucun carnet privé n'existe en base pour tester ARCH-003.
- Pas de test lecteur d'écran.
