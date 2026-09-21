import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata = {
  title: 'Politique de confidentialité | Le Kit du Voyageur',
  description: 'Politique de confidentialité et traitement des données personnelles — RGPD Art. 13 et 14. Le Kit du Voyageur.',
};

function MobilePCContent() {
  const s = 'mb-[var(--space-6)]';
  const h2 = 'mb-[var(--space-2)] border-b border-[color:var(--lkv-border-subtle)] pb-1.5 text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-primary)]';
  const p = 'text-[length:var(--lkv-text-caption-1)] leading-[var(--leading-relaxed)] text-[color:var(--lkv-primary)]/80';
  const link = 'text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-primary)] underline';
  return (
    <div className="p-[var(--space-4)]">
      <p className="mb-[var(--space-3)] font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[0.14em] text-[color:var(--lkv-primary)]">RGPD · Données personnelles</p>
      <h1 className="mb-[var(--space-2)] font-display text-[length:var(--lkv-text-title-lg)] font-extrabold text-[color:var(--lkv-primary)]">Politique de confidentialité</h1>
      <p className="mb-[var(--space-6)] text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-primary)]/50">Conformément au RGPD (UE) 2016/679 et à la loi Informatique et Libertés</p>

      <section className={s}><h2 className={h2}>1. Responsable du traitement</h2><p className={p}>Le Kit du Voyageur (SAS). DPO : <a href="mailto:dpo@lekitduvoyageur.fr" className={link}>dpo@lekitduvoyageur.fr</a></p></section>
      <section className={s}><h2 className={h2}>2. Données collectées</h2><p className={p}>Nous collectons : données d&apos;identification (nom, email), données de navigation (IP anonymisée), données de transaction (historique commandes), données de profil (préférences voyage), données générées par l&apos;IA. Aucune donnée sensible (Art. 9 RGPD) n&apos;est collectée.</p></section>
      <section className={s}><h2 className={h2}>3. Finalités</h2><p className={p}>Les données sont traitées pour : gestion du compte, traitement des commandes, personnalisation IA, envoi d&apos;emails transactionnels, communications marketing (avec consentement), statistiques d&apos;audience, prévention de la fraude.</p></section>
      <section className={s}><h2 className={h2}>4. Destinataires</h2><p className={p}>Vos données peuvent être transmises à Supabase (hébergement DB), Stripe (paiement), Netlify (hébergement web), Google Analytics (avec consentement), et les services IA (Anthropic, Google Gemini). Aucune donnée n&apos;est vendue à des tiers.</p></section>
      <section className={s}><h2 className={h2}>5. Transferts hors UE</h2><p className={p}>Encadrés par les Clauses Contractuelles Types (CCT) et le Data Privacy Framework UE-États-Unis.</p></section>
      <section className={s}><h2 className={h2}>6. Durée de conservation</h2><p className={p}>Compte : durée + 3 ans. Commandes : 10 ans. Cookies analytics : 13 mois max. Consentement cookies : 6 mois.</p></section>
      <section className={s}><h2 className={h2}>7. Vos droits</h2><p className={p}>Accès, rectification, effacement, portabilité, opposition, limitation, retrait du consentement. Contact : <a href="mailto:privacy@lekitduvoyageur.fr" className={link}>privacy@lekitduvoyageur.fr</a>. Réclamation auprès de la <a href="https://www.cnil.fr" className={link} target="_blank" rel="noopener noreferrer">CNIL</a>.</p></section>
      <section className={s}><h2 className={h2}>8. Sécurité</h2><p className={p}>Chiffrement TLS 1.3, AES-256, authentification JWT, RLS Supabase, mots de passe hachés (bcrypt), sauvegardes quotidiennes.</p></section>
      <section className={s}><h2 className={h2}>9. Cookies</h2><p className={p}>Voir notre <Link href="/cookies" className={link}>Politique de gestion des cookies</Link>.</p></section>

      <div className="flex flex-wrap gap-[var(--space-2)] border-t border-[color:var(--lkv-border-subtle)] pt-[var(--space-4)]">
        <Link href="/mentions-legales" className={link}>Mentions légales</Link>
        <span className="text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-primary)]/20">·</span>
        <Link href="/cgu" className={link}>CGU</Link>
        <span className="text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-primary)]/20">·</span>
        <Link href="/cgv" className={link}>CGV</Link>
        <span className="text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-primary)]/20">·</span>
        <Link href="/cookies" className={link}>Cookies</Link>
      </div>
    </div>
  );
}

export default function PolitiqueConfidentialitePage() {
  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: "Politique de confidentialit\u00e9 — Le Kit du Voyageur",
    description: "Politique de confidentialit\u00e9 et traitement des donn\u00e9es personnelles — RGPD.",
    url: `${siteUrl}/politique-confidentialite`,
    isPartOf: { '@id': `${siteUrl}/#website` },
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Politique de confidentialit\u00e9', item: `${siteUrl}/politique-confidentialite` },
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
            <p className="text-xs font-mono text-primary tracking-widest uppercase mb-3">RGPD · Données personnelles</p>
            <h1 className="font-display text-3xl text-foreground mb-2" font-extrabold>Politique de confidentialité</h1>
            <p className="text-sm text-foreground/50 mb-10">Conformément au Règlement (UE) 2016/679 (RGPD), articles 13 et 14 — Loi Informatique et Libertés n° 78-17 du 6 janvier 1978 modifiée</p>
            <div className="space-y-10 text-sm text-foreground/80 leading-relaxed">
              <section><h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">1. Responsable du traitement</h2>
                <div className="bg-foreground/3 rounded-xl p-4 space-y-1">
                  <p><strong className="text-foreground">Le Kit du Voyageur</strong> (SAS)</p>
                  <p>Email : <a href="mailto:privacy@lekitduvoyageur.fr" className="text-primary hover:underline">privacy@lekitduvoyageur.fr</a></p>
                  <p className="mt-2 pt-2 border-t border-border/50"><strong className="text-foreground">DPO :</strong> <a href="mailto:dpo@lekitduvoyageur.fr" className="text-primary hover:underline">dpo@lekitduvoyageur.fr</a></p>
                </div>
              </section>
              <section><h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">2. Données personnelles collectées</h2>
                <p className="mb-3">Nous collectons : données d&apos;identification (nom, email), données de navigation (IP anonymisée), données de transaction (historique commandes, aucun stockage bancaire), données de profil (préférences voyage), données générées par l&apos;IA. Aucune donnée sensible (Art. 9 RGPD).</p>
              </section>
              <section><h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">3. Finalités du traitement</h2>
                <p>Gestion du compte, commandes, personnalisation IA, emails transactionnels, marketing (consentement), analytics (consentement), prévention de la fraude, obligations légales.</p>
              </section>
              <section><h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">4. Destinataires</h2>
                <p>Sous-traitants : Supabase (DB), Stripe (paiement PCI-DSS), Netlify (hébergement), Google (Analytics), Anthropic/Gemini (IA). Aucune vente de données.</p>
              </section>
              <section><h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">5. Transferts hors UE</h2>
                <p>Encadrés par CCT et Data Privacy Framework UE-États-Unis. Chiffrement TLS 1.3 et AES-256.</p>
              </section>
              <section><h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">6. Durées de conservation</h2>
                <p>Compte : durée + 3 ans. Commandes : 10 ans (comptable). Cookies analytics : 13 mois. Consentement cookies : 6 mois.</p>
              </section>
              <section><h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">7. Vos droits (RGPD)</h2>
                <p>Accès, rectification, effacement, portabilité, opposition, limitation, retrait du consentement. Contact : <a href="mailto:privacy@lekitduvoyageur.fr" className="text-primary hover:underline">privacy@lekitduvoyageur.fr</a>. Réclamation : <a href="https://www.cnil.fr" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">CNIL</a>.</p>
              </section>
              <section><h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">8. Sécurité</h2>
                <p>Chiffrement TLS 1.3, AES-256, RLS, JWT, bcrypt, sauvegardes quotidiennes. Aucune donnée bancaire stockée.</p>
              </section>
              <section><h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">9. Cookies</h2>
                <p>Voir notre <Link href="/cookies" className="text-primary hover:underline">Politique de gestion des cookies</Link>.</p>
              </section>
              <div className="flex flex-wrap gap-3 pt-6 border-t border-border">
                <Link href="/mentions-legales" className="text-primary hover:underline text-xs">Mentions légales</Link>
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
          <MobilePCContent />
        </MobilePageShell>
        
      </div>
    </>
  );
}
