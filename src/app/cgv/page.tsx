import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

export const metadata = {
  title: 'Conditions Générales de Vente | Le Kit du Voyageur',
  description: 'Conditions générales de vente — e-commerce Le Kit du Voyageur. Droit de rétractation 14 jours, garanties légales, paiement Stripe.',
};

function MobileCGVContent() {
  const s: React.CSSProperties = { marginBottom: '24px' };
  const h2: React.CSSProperties = { fontSize: '14px', fontWeight: 600, color: '#1C2620', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid rgba(11,31,23,0.06)' };
  const p: React.CSSProperties = { fontSize: '13px', color: 'rgba(28,38,32,0.8)', lineHeight: '1.6' };
  return (
    <div style={{ padding: '16px' }}>
      <p style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#17402C', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '12px' }}>Conditions de vente</p>
      <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#1C2620', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>Conditions Générales de Vente</h1>
      <p style={{ fontSize: '12px', color: 'rgba(28,38,32,0.5)', marginBottom: '24px' }}>Conformément aux articles L221-1 et suivants du Code de la consommation</p>

      <section style={s}><h2 style={h2}>1. Objet</h2><p style={p}>Les présentes CGV s&apos;appliquent à toutes les ventes de produits conclues sur le site entre Le Kit du Voyageur (SAS) et tout consommateur.</p></section>
      <section style={s}><h2 style={h2}>2. Produits</h2><p style={p}>Les produits sont décrits avec la plus grande exactitude possible. Les offres sont valables dans la limite des stocks disponibles.</p></section>
      <section style={s}><h2 style={h2}>3. Prix</h2><p style={p}>Les prix sont indiqués en euros TTC, hors frais de livraison. Le prix applicable est celui affiché au moment de la validation de la commande.</p></section>
      <section style={s}><h2 style={h2}>4. Commande</h2><p style={p}>La commande est définitivement validée à réception de la confirmation de paiement. Un email de confirmation est envoyé.</p></section>
      <section style={s}><h2 style={h2}>5. Paiement</h2><p style={p}>Paiement sécurisé par carte bancaire (Visa, Mastercard, American Express) via Stripe — certifié PCI-DSS niveau 1.</p></section>
      <section style={s}><h2 style={h2}>6. Livraison</h2><p style={p}>Livraison en France et UE. Standard (3-5j), Express (1-2j) ou Point relais (2-4j). Offerte dès 99€.</p></section>
      <section style={s}><h2 style={h2}>7. Droit de rétractation</h2><p style={p}>14 jours calendaires à compter de la réception pour exercer votre droit de rétractation, sans pénalités. Remboursement sous 14 jours.</p></section>
      <section style={s}><h2 style={h2}>8. Garanties</h2><p style={p}>Garantie légale de conformité (2 ans) et garantie contre les vices cachés (2 ans). Contact : <a href="mailto:sav@lekitduvoyageur.fr" style={{ color: '#17402C', textDecoration: 'underline' }}>sav@lekitduvoyageur.fr</a>.</p></section>
      <section style={s}><h2 style={h2}>9. Droit applicable</h2><p style={p}>Les CGV sont soumises au droit français.</p></section>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingTop: '16px', borderTop: '1px solid rgba(11,31,23,0.06)' }}>
        <Link href="/cgu" style={{ color: '#17402C', textDecoration: 'underline', fontSize: '12px' }}>CGU</Link>
        <span style={{ color: 'rgba(28,38,32,0.2)', fontSize: '12px' }}>·</span>
        <Link href="/politique-confidentialite" style={{ color: '#17402C', textDecoration: 'underline', fontSize: '12px' }}>Confidentialité</Link>
        <span style={{ color: 'rgba(28,38,32,0.2)', fontSize: '12px' }}>·</span>
        <Link href="/mentions-legales" style={{ color: '#17402C', textDecoration: 'underline', fontSize: '12px' }}>Mentions légales</Link>
        <span style={{ color: 'rgba(28,38,32,0.2)', fontSize: '12px' }}>·</span>
        <Link href="/cookies" style={{ color: '#17402C', textDecoration: 'underline', fontSize: '12px' }}>Cookies</Link>
      </div>
    </div>
  );
}

export default function CGVPage() {
  return (
    <>
      {/* DESKTOP */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-background text-foreground">
          <Header />
          <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
            <p className="text-xs font-mono text-primary tracking-widest uppercase mb-3" style={{ fontFamily: 'var(--font-mono)' }}>Conditions de vente</p>
            <h1 className="font-display text-3xl text-foreground mb-2" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>Conditions Générales de Vente</h1>
            <p className="text-sm text-foreground/50 mb-10">Conformément aux articles L221-1 et suivants du Code de la consommation — En vigueur au 1er juillet 2026</p>
            <div className="space-y-10 text-sm text-foreground/80 leading-relaxed">
              <section><h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">1. Objet et champ d&apos;application</h2><p>Les présentes Conditions Générales de Vente (ci-après « CGV ») s&apos;appliquent à toutes les ventes de produits conclues sur le site <strong>lekitduvoyageur.fr</strong> entre la société Le Kit du Voyageur (SAS, ci-après « Le Vendeur ») et tout consommateur non professionnel (ci-après « l&apos;Acheteur »), conformément aux articles L221-1 et suivants du Code de la consommation.</p></section>
              <section><h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">2. Produits et disponibilité</h2><p>Les produits proposés à la vente sont décrits avec la plus grande exactitude possible (caractéristiques essentielles, prix, poids, matières, dimensions). Les offres de produits sont valables dans la limite des stocks disponibles.</p></section>
              <section><h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">3. Prix</h2><p>Les prix sont indiqués en euros (€), toutes taxes comprises (TTC), hors frais de livraison. Le prix applicable est celui affiché au moment de la validation de la commande.</p></section>
              <section><h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">4. Processus de commande</h2><p>La commande se déroule en plusieurs étapes : sélection des produits, vérification du panier, identification, adresse de livraison, choix du mode de livraison, récapitulatif, paiement sécurisé, confirmation par email.</p></section>
              <section><h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">5. Paiement</h2><p>Le paiement s&apos;effectue en ligne par carte bancaire (Visa, Mastercard, American Express) via Stripe — certifié PCI-DSS niveau 1. Aucune donnée bancaire n&apos;est stockée sur nos serveurs.</p></section>
              <section><h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">6. Livraison</h2><p>Livraison standard (Colissimo, 3-5j, 4,90€ offerte dès 99€), express (Chronopost, 1-2j, 9,90€) ou point relais (Mondial Relay, 2-4j, 3,90€).</p></section>
              <section><h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">7. Droit de rétractation</h2><p>Conformément à l&apos;article L221-18 du Code de la consommation, vous disposez d&apos;un délai de 14 jours calendaires à compter de la réception du produit pour exercer votre droit de rétractation. Contact : <a href="mailto:retour@lekitduvoyageur.fr" className="text-primary hover:underline">retour@lekitduvoyageur.fr</a>.</p></section>
              <section><h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">8. Garanties légales</h2><p>Tous les produits bénéficient de la garantie légale de conformité (2 ans, Art. L217-4 à L217-14) et de la garantie contre les vices cachés (2 ans, Art. 1641 à 1648 du Code civil).</p></section>
              <section><h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">9. Service client</h2><p>Contact : <a href="mailto:sav@lekitduvoyageur.fr" className="text-primary hover:underline">sav@lekitduvoyageur.fr</a> — Réponse sous 48h ouvrées.</p></section>
              <section><h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">10. Droit applicable</h2><p>Les CGV sont soumises au droit français.</p></section>
              <div className="flex flex-wrap gap-3 pt-6 border-t border-border">
                <Link href="/cgu" className="text-primary hover:underline text-xs">CGU</Link>
                <span className="text-foreground/20 text-xs">·</span>
                <Link href="/politique-confidentialite" className="text-primary hover:underline text-xs">Politique de confidentialité</Link>
                <span className="text-foreground/20 text-xs">·</span>
                <Link href="/mentions-legales" className="text-primary hover:underline text-xs">Mentions légales</Link>
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
          <MobileCGVContent />
        </MobilePageShell>
        
      </div>
    </>
  );
}
