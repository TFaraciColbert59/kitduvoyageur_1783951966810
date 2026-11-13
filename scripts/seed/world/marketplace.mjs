// Annonces marketplace (vente / location / prêt) adossées à product_ownership.
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { uuidv5 } from './lib/ids.mjs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const manifest = JSON.parse(fs.readFileSync('scripts/seed/world/.manifest/world-v1.manifest.json','utf8'));
const ids = Object.values(manifest.users||{}).map(u=>u.id);
const { data: profiles, error: pe } = await db.from('user_profiles').select('id,location,full_name').in('id', ids);
if (!profiles) { console.error('profiles', pe?.message); process.exit(1); }
const { data: products } = await db.from('shop_products').select('id,slug,name,brand,category,category_main,price_eur,weight_g,image,condition').eq('is_active',true).limit(60);
const modes=[...Array(12).fill('location'),...Array(8).fill('pret'),...Array(10).fill('vente')];
const listings=[]; const ownerships=[]; const transactions=[]; const reviews=[];
for (let i=0;i<30;i++) {
  const owner=profiles[i%profiles.length]; const prod=products[i%products.length]; if(!owner||!prod) continue;
  const mode=modes[i];
  const ownId=uuidv5('market-own:'+owner.id+':'+i);
  const listingId=uuidv5('market-listing:'+owner.id+':'+i);
  const price=Math.round((Number(prod.price_eur)||80)*100);
  const status = mode==='location'?'a_louer':mode==='pret'?'a_preter':'en_stock';
  ownerships.push({
    id: ownId, user_id: owner.id, name: prod.name, brand: prod.brand ?? 'LKDV',
    category: prod.category_main ?? prod.category ?? 'Équipement', weight_g: prod.weight_g ?? 800,
    price_cents: price, purchase_date: '2025-06-01', condition: i%3===0?'neuf':'bon', photo_url: prod.image ?? null,
    barcode:null, is_lent:false, maintenance_due_at:null, expiry_date:null, tags:[prod.category??'équipement'], quantity:1,
    product_id: prod.id, serial_number:null, description:null, location: (owner.location||'').split(',')[0]||'France', listing_mode: mode,
    status, rental_price_cents: mode==='location'?Math.round(price/10):null, deposit_cents: mode==='pret'?price:null,
    created_at: new Date(Date.now()-((i+1)*86400000)).toISOString(), updated_at: new Date().toISOString(),
  });
  listings.push({
    id: listingId, item_id: ownId, owner_id: owner.id, name: prod.name, brand: prod.brand ?? 'LKDV',
    category: prod.category_main ?? prod.category ?? 'Équipement', condition: i%3===0?'neuf':'bon', photo_url: prod.image ?? null,
    mode, description: mode==='vente' ? `Revendu après une saison d'utilisation, très bon état. ${prod.name}, révisé et propre.` : mode==='location' ? `Loué à la journée ou au week-end. ${prod.name} en excellent état, notice fournie.` : `Prêté gratuitement entre membres du club. ${prod.name}, à rendre propre.`,
    public_location: (owner.location||'').split(',')[0]||'France', price_cents: mode==='vente'?price:mode==='location'?Math.round(price/10):0, deposit_cents: price,
    status:'published', created_at: new Date(Date.now()-((i+1)*43200000)).toISOString(),
  });
  if (i<10) {
    const buyer=profiles[(i+5)%profiles.length];
    const txId=uuidv5('market-tx:'+listingId);
    transactions.push({ id: txId, listing_id: listingId, item_id: ownId, owner_id: owner.id, buyer_id: buyer.id, mode, status:'completed', listing_snapshot:{name:prod.name,brand:prod.brand}, price_cents:price, deposit_cents:price, start_date:'2026-09-01', end_date:'2026-09-08', tracking_code:null, created_at:new Date(Date.now()-((i+3)*86400000)).toISOString(), updated_at:new Date().toISOString() });
    reviews.push({ id: uuidv5('market-review:'+txId), transaction_id: txId, listing_id: listingId, author_id: buyer.id, subject_id: owner.id, rating: 5-(i%2), comment: 'Échange simple, matériel conforme et très bien entretenu. Je recommande.', created_at:new Date(Date.now()-((i+1)*86400000)).toISOString() });
  }
}
for (const rows of [ownerships,listings,transactions,reviews]) {
  const table = rows===ownerships?'product_ownership':rows===listings?'marketplace_listings':rows===transactions?'marketplace_transactions':'marketplace_reviews';
  const { error } = await db.from(table).upsert(rows,{onConflict:'id'});
  console.log(table, error?error.message:rows.length);
}
