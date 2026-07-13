import { NextRequest, NextResponse } from 'next/server';

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
      items: { name: string; priceEur: number; quantity: number; image?: string }[];
      successUrl: string;
      cancelUrl: string;
    };

    if (!items?.length) {
      return NextResponse.json({ error: 'Panier vide' }, { status: 400 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.com';

    // Dynamic import to avoid build errors when Stripe is not installed
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(stripeKey, { apiVersion: '2025-02-24.acacia' as const });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      locale: 'fr',
      line_items: items.map((item) => ({
        price_data: {
          currency: 'eur',
          product_data: {
            name: item.name,
            ...(item.image ? { images: [item.image] } : {}),
          },
          unit_amount: Math.round(item.priceEur * 100),
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
