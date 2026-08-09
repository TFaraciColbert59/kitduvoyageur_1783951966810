import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Rate limiting: simple in-memory store (use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, limit = 10, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

interface CartItem {
  id: string;
  name: string;
  priceEur: number;
  quantity: number;
  image?: string;
  type?: 'product' | 'kit';
}

async function validatePrices(items: CartItem[]): Promise<{ valid: boolean; errors: string[]; validatedItems: { name: string; unitAmount: number; quantity: number; image?: string }[] }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { valid: false, errors: ['Configuration serveur manquante'], validatedItems: [] };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const errors: string[] = [];
  const validatedItems: { name: string; unitAmount: number; quantity: number; image?: string }[] = [];

  for (const item of items) {
    // Try to find in products table
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('price_eur, name')
      .eq('id', item.id)
      .eq('is_active', true)
      .single();

    if (!productError && product) {
      const serverPrice = Number(product.price_eur);
      if (Math.abs(serverPrice - item.priceEur) > 0.01) {
        errors.push(`Prix incorrect pour "${item.name}". Attendu: ${serverPrice}€, reçu: ${item.priceEur}€`);
      }
      validatedItems.push({
        name: product.name || item.name,
        unitAmount: Math.round(serverPrice * 100),
        quantity: item.quantity,
        image: item.image,
      });
      continue;
    }

    // Try to find in kits table
    const { data: kit, error: kitError } = await supabase
      .from('kits')
      .select('prix_cents, nom')
      .eq('id', item.id)
      .single();

    if (!kitError && kit) {
      const serverPriceCents = kit.prix_cents;
      const clientPriceCents = Math.round(item.priceEur * 100);
      if (Math.abs(serverPriceCents - clientPriceCents) > 1) {
        const serverPriceEur = serverPriceCents / 100;
        errors.push(`Prix incorrect pour "${item.name}". Attendu: ${serverPriceEur}€, reçu: ${item.priceEur}€`);
      }
      validatedItems.push({
        name: kit.nom || item.name,
        unitAmount: serverPriceCents,
        quantity: item.quantity,
        image: item.image,
      });
      continue;
    }

    // Try shop_products for marketplace items
    const { data: shopProduct, error: shopError } = await supabase
      .from('shop_products')
      .select('price_eur, name')
      .eq('id', item.id)
      .eq('available', true)
      .single();

    if (!shopError && shopProduct) {
      const serverPrice = Number(shopProduct.price_eur);
      if (Math.abs(serverPrice - item.priceEur) > 0.01) {
        errors.push(`Prix incorrect pour "${item.name}". Attendu: ${serverPrice}€, reçu: ${item.priceEur}€`);
      }
      validatedItems.push({
        name: shopProduct.name || item.name,
        unitAmount: Math.round(serverPrice * 100),
        quantity: item.quantity,
        image: item.image,
      });
      continue;
    }

    errors.push(`Produit non trouvé: ${item.name} (${item.id})`);
  }

  return { valid: errors.length === 0, errors, validatedItems };
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';

  if (!checkRateLimit(ip, 5, 60_000)) {
    return NextResponse.json({ error: 'Trop de requêtes. Réessayez dans une minute.' }, { status: 429 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey || stripeKey.includes('your-')) {
    return NextResponse.json(
      { error: 'Stripe n\'est pas configuré. Ajoutez STRIPE_SECRET_KEY dans vos variables d\'environnement.' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { items, successUrl, cancelUrl } = body as {
      items: CartItem[];
      successUrl: string;
      cancelUrl: string;
    };

    if (!items?.length) {
      return NextResponse.json({ error: 'Panier vide' }, { status: 400 });
    }

    // Validate prices server-side against database
    const validation = await validatePrices(items);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Validation des prix échouée', details: validation.errors },
        { status: 400 }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.com';

    // Dynamic import to avoid build errors when Stripe is not installed
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(stripeKey, { apiVersion: '2025-02-24.acacia' as const });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      locale: 'fr',
      line_items: validation.validatedItems.map((item) => ({
        price_data: {
          currency: 'eur',
          product_data: {
            name: item.name,
            ...(item.image ? { images: [item.image] } : {}),
          },
          unit_amount: item.unitAmount,
        },
        quantity: item.quantity,
      })),
      success_url: successUrl || `${siteUrl}/checkout?success=true`,
      cancel_url: cancelUrl || `${siteUrl}/panier`,
      shipping_address_collection: { allowed_countries: ['FR', 'BE', 'CH', 'LU', 'MC'] },
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur Stripe inconnue';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
