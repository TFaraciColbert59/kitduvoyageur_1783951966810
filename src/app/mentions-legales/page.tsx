import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata = {
  title: 'Mentions légales | Le Kit du Voyageur',
  description: 'Mentions légales du site lekitduvoyageur.fr, conformément à la loi LCEN n° 2004-575 du 21 juin 2004.',
};

function MobileMLContent() {
  const s: React.CSSProperties = { marginBottom: '24px' };
  const h2: React.CSSProperties = { fontSize: '14px', fontWeight: 600, color: '#17402C', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid rgba(23,64,44,0.06)' };
  const p: React.CSSProperties = { fontSize: '13px', color: 'rgba(23,64,44,0.8)', lineHeight: '1.6' };
  const link: React.CSSProperties = { color: '#17402C', textDecoration: 'underline', fontSize: '13px' };
  return (
    <div style={{ padding: '16px' }}>
      <p style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#17402C', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '12px' }}>Informations légales</p>
      <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#17402C', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>Mentions légales</h1>
      <p style={{ fontSize: '12px', color: 'rgba(23,64,44,0.5)', marginBottom: '24px' }}>Conformément à la loi LCEN n° 2004-575 du 21 juin 2004</p>

      <section style={s}><h2 style={h2}>1. Éditeur du site</h2>
        <p style={p}><strong>Le Kit du Voyageur</strong> (SAS) — Capital : 10 000€ — Siège : 1 Rue de la Paix, 75001 Paris — SIRET : 123 456 789 00010 — RCS Paris B 123 456 789 — Email : <a href="mailto:contact@lekitduvoyageur.fr" style={link}>contact@lekitduvoyageur.fr</a></p>
      </section>
      <section style={s}><h2 style={h2}>2. Directeur de la publication</h2><p style={p}>Le représentant légal de la société Le Kit du Voyageur.</p></section>
      <section style={s}><h2 style={h2}>3. Hébergement</h2><p style={p}><strong>Netlify, Inc.</strong> — 44 Montgomery Street, San Francisco, CA 94104, États-Unis. Base de données : <strong>Supabase, Inc.</strong> — Région : Europe (Frankfurt).</p></section>
      <section style={s}><h2 style={h2}>4. Propriété intellectuelle</h2><p style={p}>Les éléments du site sont la propriété exclusive de Le Kit du Voyageur. Toute reproduction non autorisée est interdite.</p></section>
      <section style={s}><h2 style={h2}>5. Responsabilité</h2><p style={p}>Le Kit du Voyageur décline toute responsabilité pour les dommages résultant de l&apos;utilisation du site.</p></section>
      <section style={s}><h2 style={h2}>6. Données personnelles</h2><p style={p}>Voir notre <Link href="/politique-confidentialite" style={link}>Politique de confidentialité</Link>. DPO : <a href="mailto:dpo@lekitduvoyageur.fr" style={link}>dpo@lekitduvoyageur.fr</a></p></section>
      <section style={s}><h2 style={h2}>7. Droit applicable</h2><p style={p}>Soumis au droit français.</p></section>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingTop: '16px', borderTop: '1px solid rgba(23,64,44,0.06)' }}>
        <Link href="/politique-confidentialite" style={link}>Confidentialité</Link>
        <span style={{ color: 'rgba(23,64,44,0.2)', fontSize: '12px' }}>·</span>
        <Link href="/cgu" style={link}>CGU</Link>
        <span style={{ color: 'rgba(23,64,44,0.2)', fontSize: '12px' }}>·</span>
        <Link href="/cgv" style={link}>CGV</Link>
        <span style={{ color: 'rgba(23,64,44,0.2)', fontSize: '12px' }}>·</span>
        <Link href="/cookies" style={link}>Cookies</Link>
      </div>
    </div>
  );
}

export default function MentionsLegalesPage() {
  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: "Mentions l\u00e9gales — Le Kit du Voyageur",
    description: "Mentions l\u00e9gales du site lekitduvoyageur.fr, conform\u00e9ment \u00e0 la loi LCEN.",
    url: `${siteUrl}/mentions-legales`,
    isPartOf: { '@id': `${siteUrl}/#website` },
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Mentions l\u00e9gales', item: `${siteUrl}/mentions-legales` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }} suppressHydrationWarning />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} suppressHydrationWarning />
      {/* DESKTOP */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-background text-foreground">
          <Header />
          <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
            <p className="text-xs font-mono text-primary tracking-widest uppercase mb-3" style={{ fontFamily: 'var(--font-mono)' }}>Informations légales</p>
            <h1 className="font-display text-3xl text-foreground mb-2" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>Mentions légales</h1>
            <p className="text-sm text-foreground/50 mb-10">Conformément à l&apos;article 6-III de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l&apos;économie numérique (LCEN)</p>
            <div className="space-y-10 text-sm text-foreground/80 leading-relaxed">
              <section><h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">1. Éditeur du site</h2>
                <div className="bg-foreground/3 rounded-xl p-4 space-y-1">
                  <p><strong className="text-foreground">Dénomination sociale :</strong> Le Kit du Voyageur</p>
                  <p><strong className="text-foreground">Forme juridique :</strong> SAS — Capital : 10 000€</p>
                  <p><strong className="text-foreground">Siège social :</strong> 1 Rue de la Paix, 75001 Paris, France</p>
                  <p><strong className="text-foreground">SIRET :</strong> 123 456 789 00010 — RCS Paris B 123 456 789</p>
                  <p><strong className="text-foreground">Email :</strong> <a href="mailto:contact@lekitduvoyageur.fr" className="text-primary hover:underline">contact@lekitduvoyageur.fr</a></p>
                </div>
              </section>
              <section><h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">2. Directeur de la publication</h2><p>Le directeur de la publication est le représentant légal de la société Le Kit du Voyageur.</p></section>
              <section><h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">3. Hébergement</h2>
                <p className="mb-3"><strong>Netlify, Inc.</strong> — 44 Montgomery Street, San Francisco, CA 94104, États-Unis</p>
                <p>Base de données : <strong>Supabase, Inc.</strong> — Région : Europe (Frankfurt)</p>
              </section>
              <section><h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">4. Propriété intellectuelle</h2><p>Les éléments du site sont la propriété exclusive de Le Kit du Voyageur. Toute reproduction non autorisée est interdite.</p></section>
              <section><h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">5. Responsabilité</h2><p>Le Kit du Voyageur décline toute responsabilité pour toute imprécision ou omission sur le site.</p></section>
              <section><h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">6. Données personnelles</h2><p>Voir notre <Link href="/politique-confidentialite" className="text-primary hover:underline">Politique de confidentialité</Link>. DPO : <a href="mailto:dpo@lekitduvoyageur.fr" className="text-primary hover:underline">dpo@lekitduvoyageur.fr</a></p></section>
              <section><h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">7. Droit applicable</h2><p>Les présentes mentions légales sont soumises au droit français.</p></section>
              <div className="flex flex-wrap gap-3 pt-6 border-t border-border">
                <Link href="/politique-confidentialite" className="text-primary hover:underline text-xs">Politique de confidentialité</Link>
                <span className="text-foreground/20 text-xs">·</span>
                <Link href="/cgu" className="text-primary hover:underline text-xs">CGU</Link>
                <span className="text-foreground/20 text-xs">·</span>
                <Link href="/cgv" className="text-primary hover:underline text-xs">CGV</Link>
                <span className="text-foreground/20 text-xs">·</span>
                <Link href="/cookies" className="text-primary hover:underline text-xs">Cookies</Link>
              </div>
            </div>
          </main>
          <Footer />
        </div>
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <MobilePageShell>
          <MobileMLContent />
        </MobilePageShell>
        
      </div>
    </>
  );
}
