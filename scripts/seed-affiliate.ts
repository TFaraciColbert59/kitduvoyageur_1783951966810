/**
 * LKDV — Script d'Idempotence de Seed des Liens d'Affiliation (Chantier 5)
 * Associe les partenaires officiels Travelpayouts et injecte les offres vérifiées pour FR, NP, PE, IS, MA.
 * Exécution : npx tsx scripts/seed-affiliate.ts
 */

import { createClient } from '@supabase/supabase-js';
import { REAL_AFFILIATE_LINKS_SEED } from '../src/features/affiliation/data/affiliateSeed';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[SEED AFFILIATE] Erreur : URL Supabase ou Clé manquante dans l’environnement.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedAffiliate() {
  console.log('[SEED AFFILIATE] Récupération des partenaires Travelpayouts...');

  const { data: partners, error: partErr } = await supabase
    .from('affiliate_partners')
    .select('id, slug');

  if (partErr || !partners || partners.length === 0) {
    console.error('[SEED AFFILIATE] Échec : aucun partenaire trouvé dans affiliate_partners.', partErr);
    process.exit(1);
  }

  const partnerMap = new Map<string, string>();
  for (const p of partners) {
    partnerMap.set(p.slug, p.id);
  }

  console.log(`[SEED AFFILIATE] ${partnerMap.size} partenaires identifiés.`);
  console.log(`[SEED AFFILIATE] Préparation de ${REAL_AFFILIATE_LINKS_SEED.length} liens affiliés curés...`);

  const payload = REAL_AFFILIATE_LINKS_SEED.map((link) => {
    const partnerId = partnerMap.get(link.partner_slug);
    if (!partnerId) {
      throw new Error(`Partenaire inconnu pour le slug : ${link.partner_slug}`);
    }

    return {
      slug: link.slug,
      partner_id: partnerId,
      category: link.category,
      country_code: link.country_code,
      title: link.title,
      destination_name: link.destination_name,
      target_url: link.target_url,
      tracking_params: link.tracking_params,
      is_active: true,
    };
  });

  const { data, error } = await supabase
    .from('affiliate_links')
    .upsert(payload, { onConflict: 'slug' })
    .select('slug, category, country_code');

  if (error) {
    console.error('[SEED AFFILIATE] Échec de l’insertion des liens :', error);
    process.exit(1);
  }

  console.log(`[SEED AFFILIATE] Succès ! ${data?.length || 0} liens affiliés synchronisés.`);

  // Répartition par pays et catégorie
  const countryCounts: Record<string, number> = {};
  const catCounts: Record<string, number> = {};
  for (const item of REAL_AFFILIATE_LINKS_SEED) {
    countryCounts[item.country_code] = (countryCounts[item.country_code] || 0) + 1;
    catCounts[item.category] = (catCounts[item.category] || 0) + 1;
  }

  console.log('\n[RÉPARTITION PAR PAYS]');
  for (const [code, count] of Object.entries(countryCounts)) {
    console.log(`- ${code} : ${count} liens qualifiés`);
  }

  console.log('\n[RÉPARTITION PAR CATÉGORIE]');
  for (const [cat, count] of Object.entries(catCounts)) {
    console.log(`- ${cat} : ${count}`);
  }
}

seedAffiliate().catch((err) => {
  console.error('[SEED AFFILIATE] Erreur inattendue :', err);
  process.exit(1);
});
