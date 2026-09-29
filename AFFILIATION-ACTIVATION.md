# Activation de l'Affiliation LKDV — guide exécutable

État vérifié dans le code le 2026-09-29 (dépôt `kitduvoyageur_1783951966810`, feature `src/features/affiliation/`).

## Diagnostic : pourquoi l'affiliation ne « fonctionne » pas aujourd'hui

| # | Constat | Preuve |
|---|---|---|
| 1 | Les **5 partenaires** Travelpayouts ont tous `category` **NULL** | Migration `20260905130000_affiliate_travelpayouts.sql` insère sans la colonne ; mesuré en base (J4 de la checklist) |
| 2 | La table `affiliate_links` (les offres réelles) n'est **jamais semée par migration** : seul le script **manuel** `npx tsx scripts/seed-affiliate.ts` la remplit (24 liens curés : FR 7, NP 5, PE 4, IS 4, MA 4) | Aucun `INSERT INTO affiliate_links` dans `supabase/migrations/` ; base fraîche/prod = 0 offre → `getAffiliateLinks` renvoie `[]` **en silence** |
| 3 | Les identifiants de tracking sont des **valeurs de démonstration** : Booking `aid: '800100'`, Travelpayouts `marker: '584920'`, GetYourGuide `partner_id: 'LKDV2026'` — et le marker est **codé en dur** dans `src/app/go/[slug]/route.ts:41` | Aucun revenu ne peut être attribué sans VOS identifiants réels |

Le reste est **déjà en place et de qualité** : moteur (`buildAffiliateUrl`, garde-fou open redirect, refus du clair), route `/go/[slug]` (redirection 307 + log de clic RGPD avec `session_hash`), webhook postback `api/affiliate/travelpayouts` → `recordAffiliateConversion`, intégration préparateur (`PrepItinerarySheets` : `AffiliateDisclosure` + `AffiliateLinkCard`, « sans offre réelle, aucun bloc »), RLS, tests.

## Les 5 étapes d'activation

1. **Migration catégories** — appliquer `20260929220000_affiliate_partners_categories.sql` :
   `booking=hotel`, `aviasales=flight`, `getyourguide=activity`, `airalo=esim`, `chapka=insurance`.
   Idempotent (ne touche que les lignes NULL). `transport` et `gear` restent sans partenaire — c'est le contrat honnête J4, ne rien inventer.
2. **Migration semis des liens** — appliquer `20260929220100_affiliate_links_seed.sql` (24 liens générés depuis `affiliateSeed.ts`, `ON CONFLICT (slug) DO UPDATE`, donc rejouable).
   Pré-requis : vérifier la FK pays — `SELECT iso_a2 FROM countries_geo WHERE iso_a2 IN ('FR','NP','PE','IS','MA');`
3. **Remplacer les identifiants de démonstration** par vos identifiants réels (sinon les clics partent mais **aucune commission n'est tracée**) :
   - `affiliateSeed.ts` (et la migration du semis) : `aid` Booking, `marker` Travelpayouts, `partner_id` GetYourGuide ;
   - `src/app/go/[slug]/route.ts:41` : sortir `marker: '584920'` vers `process.env.TRAVELPAYOUTS_MARKER` (un secret d'affiliation ne vit jamais en dur dans le code).
4. **Câbler le postback Travelpayouts** vers `POST /api/affiliate/travelpayouts` dans votre tableau de bord Travelpayouts (les conversions arrivent alors dans `affiliate_conversions`, statuts `pending/confirmed/rejected`).
5. **Rejouer les preuves** :
   - `npm test -- tests/affiliation/queries-affiliation.spec.ts` (4 cas : liens par pays, lien par slug, clic RGPD, conversion postback) ;
   - en base : `SELECT category, count(*) FROM public.affiliate_links WHERE is_active GROUP BY category;`
   - à l'écran : générer un parcours France dans `/prepare`, ouvrir le tiroir d'une étape → la carte d'offre + la mention de transparence doivent apparaître ; `/go/booking-chamonix-alpes-hebergements` doit rediriger en 307 et écrire 1 ligne dans `affiliate_clicks`.

## Garde-fous à ne pas casser (déjà codés)

- Le badge de commission n'existe que pour un partenaire réel de la base — jamais de badge dérivé d'une liste en dur TS.
- « Sans offre réelle, aucun bloc affiliation : pas de carte vide, pas de "à venir" » (`PrepItinerarySheets.tsx`).
- `/go/[slug]` refuse une cible non valide et retombe sur `/voyages` (jamais d'open redirect).
- RGPD : clics loggés par `session_hash` salé, jamais d'IP brute.
