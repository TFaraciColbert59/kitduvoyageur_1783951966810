# Import catalogue kit — rapport brut

- Source : `Produits - Kit du Voyageur – 80 Produits B.csv`
- Date d'exécution : 2026-09-13T10:33:01.648Z
- Lignes CSV (hors en-tête) : 80
- Produits uniques après dédup SKU : 67
- `shop_products` avant : 67 — après : 67

> ⚠️ Ce rapport contient des prix d’achat (`cost_price_eur`) internes.
> Ne jamais les exposer dans du code client (les loaders ne sélectionnent
> que les colonnes publiques : slug, name, brand, price_eur, weight_g, …).

## Dédup (11 groupes SKU)

- SKU dédupliqués : 807382, 1063551, 1109060, 811846, 1300701, 1091707, 1228356, 724369, 1277711, 905762, 1091304
- Règle : priorité la plus forte (Indispensable > Recommandé > Optionnel)
  puis `#` le plus bas ; aucun autre champ fusionné (URL du gagnant seule).

## Poids non numériques → NULL (reportés)

- Valeurs : Léger, Moyen, Léger, Léger, Léger, Moyen, Moyen, 1.5-2 kg
- Total : 8

## Corrections de catégorie

- Randonée Famille → Randonnée Famille

## Mapping upsert

- Lignes existantes mises à jour (slug préservé) : 67
- Insertions nouvelles (slug = kebab(nom)-SKU) : 0
- Upsert `onConflict: slug` — slugs préservés pour continuer de matcher
  `contextualKitEngine.preferredProductSlug` (design §3).

## Échantillons (preuve brute)

```json
[
  {
    "slug": "poncho-impermeable-pluie-categorie-bigbuy",
    "name": "Poncho Imperméable Pluie – Catégorie BigBuy",
    "category": "Vêtements / Protection",
    "weight_g": 150,
    "price_eur": 12,
    "cost_price_eur": 5,
    "essentiality": "Indispensable",
    "product_id": null,
    "supplier": "BigBuy"
  },
  {
    "slug": "lampe-frontale-led-rechargeable-black-diamond-spot-400",
    "name": "Lampe Frontale LED Rechargeable Black Diamond Spot 400",
    "category": "Éclairage",
    "weight_g": 90,
    "price_eur": 75,
    "cost_price_eur": 38,
    "essentiality": "Indispensable",
    "product_id": "1051281",
    "supplier": "BigBuy"
  },
  {
    "slug": "lanterne-led-pour-la-tete-tm-electron",
    "name": "Lanterne LED pour la Tête TM Electron",
    "category": "Éclairage",
    "weight_g": 0,
    "price_eur": 18,
    "cost_price_eur": 8,
    "essentiality": "Recommandé",
    "product_id": "776399",
    "supplier": "BigBuy"
  },
  {
    "slug": "trousse-de-premiers-secours-kerbl-80929",
    "name": "Pansements Anti-Ampoules Trousse Kerbl 80929",
    "category": "Confort des pieds",
    "weight_g": 50,
    "price_eur": 8,
    "cost_price_eur": 3,
    "essentiality": "Indispensable",
    "product_id": "1063551",
    "supplier": "BigBuy"
  },
  {
    "slug": "baton-trekking-aktive-telescopique-135-cm",
    "name": "Bâton de Marche Télescopique Aluminium Aktive 135 cm",
    "category": "Équipement du sac",
    "weight_g": 250,
    "price_eur": 28,
    "cost_price_eur": 12,
    "essentiality": "Indispensable",
    "product_id": "1300701",
    "supplier": "BigBuy"
  }
]
```

## Slugs préservés (existant ≠ formule)

```json
[
  {
    "sku": "1051281",
    "keep": "lampe-frontale-led-rechargeable-black-diamond-spot-400",
    "computed": "lampe-frontale-led-rechargeable-black-diamond-spot-400-1051281"
  },
  {
    "sku": "776399",
    "keep": "lanterne-led-pour-la-tete-tm-electron",
    "computed": "lanterne-led-pour-la-tete-tm-electron-776399"
  },
  {
    "sku": "1230882",
    "keep": "projecteur-led-rechargeable-a-main-velamp-doomster-trekk-10w",
    "computed": "projecteur-led-rechargeable-a-main-velamp-doomster-trekk-10w-1230882"
  },
  {
    "sku": "807382",
    "keep": "trousse-de-premiers-secours-michelin-9531-44-pieces",
    "computed": "trousse-de-premiers-secours-michelin-9531-44-pieces-807382"
  },
  {
    "sku": "1063551",
    "keep": "trousse-de-premiers-secours-kerbl-80929",
    "computed": "pansements-anti-ampoules-trousse-kerbl-80929-1063551"
  },
  {
    "sku": "72898",
    "keep": "ecran-solaire-visage-nivea-sun-facial-spf-50-50-ml",
    "computed": "ecran-solaire-visage-nivea-sun-facial-spf-50-50-ml-72898"
  },
  {
    "sku": "59650",
    "keep": "creme-solaire-nivea-spf-50-200-ml",
    "computed": "creme-solaire-nivea-spf-50-200-ml-59650"
  },
  {
    "sku": "1109060",
    "keep": "sac-banane-osprey-65l-noir",
    "computed": "sac-banane-osprey-65l-noir-1109060"
  },
  {
    "sku": "1185619",
    "keep": "thermos-de-voyage-thermosport-inoxibar-61126-acier-inoxydable",
    "computed": "thermos-de-voyage-thermosport-inoxibar-61126-acier-inoxydable-1185619"
  },
  {
    "sku": "620239",
    "keep": "lit-gonflable-intex-beam-deluxe-ultra-plush-152x46x236-cm",
    "computed": "lit-gonflable-intex-beam-deluxe-ultra-plush-152x46x236-cm-620239"
  },
  {
    "sku": "1195810",
    "keep": "trousse-de-premiers-secours-francodex-animaux",
    "computed": "trousse-de-premiers-secours-francodex-animaux-1195810"
  },
  {
    "sku": "811846",
    "keep": "sac-a-dos-de-randonnee-categorie-bigbuy",
    "computed": "sac-a-dos-de-randonnee-categorie-bigbuy-811846"
  },
  {
    "sku": "1300701",
    "keep": "baton-trekking-aktive-telescopique-135-cm",
    "computed": "baton-de-marche-telescopique-aluminium-aktive-135-cm-1300701"
  },
  {
    "sku": "1091707",
    "keep": "tente-abri-camping-categorie-bigbuy",
    "computed": "tente-abri-camping-categorie-bigbuy-1091707"
  },
  {
    "sku": "1035706",
    "keep": "sac-de-couchage-domiva-au-fil-de-leau",
    "computed": "sac-de-couchage-domiva-au-fil-de-leau-1035706"
  },
  {
    "sku": "878949",
    "keep": "matelas-gonflable-camping-categorie-bigbuy",
    "computed": "matelas-gonflable-camping-categorie-bigbuy-878949"
  },
  {
    "sku": "1277709",
    "keep": "bouteille-deau-picture-acc121-a-blanc-naturel-acier",
    "computed": "bouteille-deau-picture-acc121-a-blanc-naturel-acier-1277709"
  },
  {
    "sku": "1228356",
    "keep": "couteau-pliant-opinel-n8-acier-inoxydable-8-cm",
    "computed": "couteau-pliant-opinel-n8-acier-inoxydable-8-cm-1228356"
  },
  {
    "sku": "412861",
    "keep": "chauffe-mains-chauffe-pieds-categorie-bigbuy",
    "computed": "chauffe-mains-chauffe-pieds-categorie-bigbuy-412861"
  },
  {
    "sku": "1213510",
    "keep": "crampons-a-neigeglace-baton-trekking-black-diamond-bd110045",
    "computed": "crampons-a-neige-glace-baton-trekking-black-diamond-bd110045-1213510"
  },
  {
    "sku": "1213514",
    "keep": "jumellesoptique-baton-trekking-leki-65221191",
    "computed": "jumelles-optique-baton-trekking-leki-65221191-1213514"
  },
  {
    "sku": "924718",
    "keep": "gps-et-accessoires-categorie-bigbuy",
    "computed": "gps-et-accessoires-categorie-bigbuy-924718"
  },
  {
    "sku": "1177083",
    "keep": "batterie-externe-power-bank-categorie-bigbuy",
    "computed": "batterie-externe-power-bank-categorie-bigbuy-1177083"
  },
  {
    "sku": "428470",
    "keep": "lampe-solaire-rechargeable-galix-30-lm-acier-inoxydable",
    "computed": "lampe-solaire-rechargeable-galix-30-lm-acier-inoxydable-428470"
  },
  {
    "sku": "144842",
    "keep": "repulsif-anti-insectes-anti-moustiques-categorie-bigbuy",
    "computed": "repulsif-anti-insectes-anti-moustiques-categorie-bigbuy-144842"
  },
  {
    "sku": "1268867",
    "keep": "rechaud-de-camping-categorie-bigbuy",
    "computed": "rechaud-de-camping-categorie-bigbuy-1268867"
  },
  {
    "sku": "1213513",
    "keep": "briquetallume-feu-camping-baton-trekking-black-diamond-bd110065-pourpre",
    "computed": "briquet-allume-feu-camping-baton-trekking-black-diamond-bd110065-pourpre-1213513"
  },
  {
    "sku": "724369",
    "keep": "vaisselle-exterieure-pique-nique-categorie-bigbuy",
    "computed": "vaisselle-exterieure-pique-nique-categorie-bigbuy-724369"
  },
  {
    "sku": "1277711",
    "keep": "sac-de-bivouac-sac-bandouliere-reebok-tech-style-city",
    "computed": "sac-de-bivouac-sac-bandouliere-reebok-tech-style-city-1277711"
  },
  {
    "sku": "Voir catégorie",
    "keep": "poncho-impermeable-pluie-categorie-bigbuy",
    "computed": "poncho-impermeable-pluie-categorie-bigbuy-voir-categorie"
  },
  {
    "sku": "833755",
    "keep": "gants-randonnee-froid-categorie-bigbuy",
    "computed": "gants-randonnee-froid-categorie-bigbuy-833755"
  },
  {
    "sku": "1222683",
    "keep": "accessoires-pour-sac-a-dos-categorie-bigbuy",
    "computed": "accessoires-pour-sac-a-dos-categorie-bigbuy-1222683"
  },
  {
    "sku": "1109057",
    "keep": "accessoires-tente-baton-trekking-viking-randonnee-noir-gris",
    "computed": "accessoires-tente-baton-trekking-viking-randonnee-noir-gris-1109057"
  },
  {
    "sku": "1035428",
    "keep": "porte-bebe-randonnee-categorie-bigbuy",
    "computed": "porte-bebe-randonnee-categorie-bigbuy-1035428"
  },
  {
    "sku": "979557",
    "keep": "mobilier-de-camping-chaise-pliante-categorie-bigbuy",
    "computed": "mobilier-de-camping-chaise-pliante-categorie-bigbuy-979557"
  },
  {
    "sku": "1140735",
    "keep": "valise-cabine-american-tourister-155260-1598-bleu",
    "computed": "valise-cabine-american-tourister-155260-1598-bleu-1140735"
  },
  {
    "sku": "1249055",
    "keep": "lingettes-hygieniques-elka-pieterman-1110000036-60-pieces",
    "computed": "lingettes-hygieniques-elka-pieterman-1110000036-60-pieces-1249055"
  },
  {
    "sku": "1237204",
    "keep": "detergent-liquide-irs-citronella-750-ml-anti-moustiques",
    "computed": "detergent-liquide-irs-citronella-750-ml-anti-moustiques-1237204"
  },
  {
    "sku": "353949",
    "keep": "rasoir-de-voyage-braun-series-3-300s-adaptateur-voltage",
    "computed": "rasoir-de-voyage-braun-series-3-300s-adaptateur-voltage-353949"
  },
  {
    "sku": "804675",
    "keep": "casquette-chapeau-randonnee-categorie-bigbuy",
    "computed": "casquette-chapeau-randonnee-categorie-bigbuy-804675"
  },
  {
    "sku": "905762",
    "keep": "sac-a-dos-enfant-categorie-bigbuy",
    "computed": "sac-a-dos-enfant-categorie-bigbuy-905762"
  },
  {
    "sku": "811889",
    "keep": "sac-a-dos-sport-exterieur-categorie-bigbuy",
    "computed": "sac-a-dos-sport-exterieur-categorie-bigbuy-811889"
  },
  {
    "sku": "1101476",
    "keep": "valise-bagage-voyage-categorie-bigbuy",
    "computed": "valise-bagage-voyage-categorie-bigbuy-1101476"
  },
  {
    "sku": "1235033",
    "keep": "batteries-et-chargeurs-categorie-bigbuy",
    "computed": "batteries-et-chargeurs-categorie-bigbuy-1235033"
  },
  {
    "sku": "1093084",
    "keep": "tasse-thermos-avec-couvercle-fc-barcelona-acier-inoxydable",
    "computed": "tasse-thermos-avec-couvercle-f-c-barcelona-acier-inoxydable-1093084"
  },
  {
    "sku": "1231471",
    "keep": "compas-a-charniere-a-pointes-vogel-250-mm-boussoleorientation",
    "computed": "compas-a-charniere-a-pointes-vogel-250-mm-boussole-orientation-1231471"
  },
  {
    "sku": "1099940",
    "keep": "sifflet-de-survie-urgence-categorie-bigbuy",
    "computed": "sifflet-de-survie-urgence-categorie-bigbuy-1099940"
  },
  {
    "sku": "1091304",
    "keep": "sac-etanche-dry-bag-bouteille-filtrante-brita-1052250-bleu-600-ml",
    "computed": "sac-etanche-dry-bag-bouteille-filtrante-brita-1052250-bleu-600-ml-1091304"
  },
  {
    "sku": "1153156",
    "keep": "lampe-torche-led-portable-categorie-bigbuy",
    "computed": "lampe-torche-led-portable-categorie-bigbuy-1153156"
  },
  {
    "sku": "1091688",
    "keep": "tente-de-camping-2-personnes-categorie-bigbuy",
    "computed": "tente-de-camping-2-personnes-categorie-bigbuy-1091688"
  },
  {
    "sku": "818850",
    "keep": "sac-de-couchage-enfant-tineo-summer-tifruits-6-mois-coton",
    "computed": "sac-de-couchage-enfant-tineo-summer-tifruits-6-mois-coton-818850"
  },
  {
    "sku": "1145990",
    "keep": "chaussettes-de-randonnee-categorie-bigbuy",
    "computed": "chaussettes-de-randonnee-categorie-bigbuy-1145990"
  },
  {
    "sku": "631199",
    "keep": "semelles-confort-orthopediques-categorie-bigbuy",
    "computed": "semelles-confort-orthopediques-categorie-bigbuy-631199"
  },
  {
    "sku": "381317",
    "keep": "gel-hydroalcoolique-desinfectant-categorie-bigbuy",
    "computed": "gel-hydroalcoolique-desinfectant-categorie-bigbuy-381317"
  },
  {
    "sku": "1224548",
    "keep": "kit-de-reparation-colliers-de-cable-jokari-system-4-70-n70",
    "computed": "kit-de-reparation-colliers-de-cable-jokari-system-4-70-n70-1224548"
  },
  {
    "sku": "341791",
    "keep": "anti-moustique-relec-373445-spray-repulsif",
    "computed": "anti-moustique-relec-373445-spray-repulsif-341791"
  },
  {
    "sku": "793064",
    "keep": "spray-diffuseur-ibergarden-citronnelle-100-ml",
    "computed": "spray-diffuseur-ibergarden-citronnelle-100-ml-793064"
  },
  {
    "sku": "1206601",
    "keep": "lunettes-de-soleil-sport-uv400-categorie-bigbuy",
    "computed": "lunettes-de-soleil-sport-uv400-categorie-bigbuy-1206601"
  },
  {
    "sku": "1249218",
    "keep": "genouillereprotection-couteau-workpro-outdoor",
    "computed": "genouillere-protection-couteau-workpro-outdoor-1249218"
  },
  {
    "sku": "979545",
    "keep": "tente-abri-bache-de-survie-categorie-bigbuy",
    "computed": "tente-abri-bache-de-survie-categorie-bigbuy-979545"
  },
  {
    "sku": "1256315",
    "keep": "sac-de-voyage-cabine-bagage-a-main-categorie-bigbuy",
    "computed": "sac-de-voyage-cabine-bagage-a-main-categorie-bigbuy-1256315"
  },
  {
    "sku": "262645",
    "keep": "creme-hydratante-soin-peau-apres-soleil-categorie-bigbuy",
    "computed": "creme-hydratante-soin-peau-apres-soleil-categorie-bigbuy-262645"
  },
  {
    "sku": "396575",
    "keep": "plaid-polaire-sac-de-couchage-domiva-lapinou-coton-70-cm",
    "computed": "plaid-polaire-sac-de-couchage-domiva-lapinou-coton-70-cm-396575"
  },
  {
    "sku": "818983",
    "keep": "lampe-de-camping-solaire-lanterne-led-categorie-bigbuy",
    "computed": "lampe-de-camping-solaire-lanterne-led-categorie-bigbuy-818983"
  },
  {
    "sku": "1193960",
    "keep": "couteau-multifonction-outil-camping-categorie-bigbuy",
    "computed": "couteau-multifonction-outil-camping-categorie-bigbuy-1193960"
  },
  {
    "sku": "1285218",
    "keep": "sac-a-dos-hydratation-bouteille-deau-spider-man-410-ml",
    "computed": "sac-a-dos-hydratation-bouteille-deau-spider-man-410-ml-1285218"
  },
  {
    "sku": "120241",
    "keep": "organiseur-voyage-suitcase-organiser-luggan-innovagoods-6-pieces",
    "computed": "organiseur-voyage-suitcase-organiser-luggan-innovagoods-6-pieces-120241"
  }
]
```
