import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

export const metadata = {
  title: 'Politique de confidentialité | Le Kit du Voyageur',
  description: 'Politique de confidentialité et traitement des données personnelles — RGPD Art. 13 et 14. Le Kit du Voyageur.',
};

function MobilePCContent() {
  const s: React.CSSProperties = { marginBottom: '24px' };
  const h2: React.CSSProperties = { fontSize: '14px', fontWeight: 600, color: '#1C2620', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid rgba(11,31,23,0.06)' };
  const p: React.CSSProperties = { fontSize: '13px', color: 'rgba(28,38,32,0.8)', lineHeight: '1.6' };
  const link: React.CSSProperties = { color: '#17402C', textDecoration: 'underline', fontSize: '13px' };
  return (
    <div style={{ padding: '16px' }}>
      <p style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#17402C', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '12px' }}>RGPD · Données personnelles</p>
      <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#1C2620', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>Politique de confidentialité</h1>
      <p style={{ fontSize: '12px', color: 'rgba(28,38,32,0.5)', marginBottom: '24px' }}>Conformément au RGPD (UE) 2016/679 et à la loi Informatique et Libertés</p>

      <section style={s}><h2 style={h2}>1. Responsable du traitement</h2><p style={p}>Le Kit du Voyageur (SAS). DPO : <a href="mailto:dpo@lekitduvoyageur.fr" style={link}>dpo@lekitduvoyageur.fr</a></p></section>
      <section style={s}><h2 style={h2}>2. Données collectées</h2><p style={p}>Nous collectons : données d&apos;identification (nom, email), données de navigation (IP anonymisée), données de transaction (historique commandes), données de profil (préférences voyage), données générées par l&apos;IA. Aucune donnée sensible (Art. 9 RGPD) n&apos;est collectée.</p></section>
      <section style={s}><h2 style={h2}>3. Finalités</h2><p style={p}>Les données sont traitées pour : gestion du compte, traitement des commandes, personnalisation IA, envoi d&apos;emails transactionnels, communications marketing (avec consentement), statistiques d&apos;audience, prévention de la fraude.</p></section>
      <section style={s}><h2 style={h2}>4. Destinataires</h2><p style={p}>Vos données peuvent être transmises à Supabase (hébergement DB), Stripe (paiement), Netlify (hébergement web), Google Analytics (avec consentement), et les services IA (Anthropic, Google Gemini). Aucune donnée n&apos;est vendue à des tiers.</p></section>
      <section style={s}><h2 style={h2}>5. Transferts hors UE</h2><p style={p}>Encadrés par les Clauses Contractuelles Types (CCT) et le Data Privacy Framework UE-États-Unis.</p></section>
      <section style={s}><h2 style={h2}>6. Durée de conservation</h2><p style={p}>Compte : durée + 3 ans. Commandes : 10 ans. Cookies analytics : 13 mois max. Consentement cookies : 6 mois.</p></section>
      <section style={s}><h2 style={h2}>7. Vos droits</h2><p style={p}>Accès, rectification, effacement, portabilité, opposition, limitation, retrait du consentement. Contact : <a href="mailto:privacy@lekitduvoyageur.fr" style={link}>privacy@lekitduvoyageur.fr</a>. Réclamation auprès de la <a href="https://www.cnil.fr" style={link} target="_blank" rel="noopener noreferrer">CNIL</a>.</p></section>
      <section style={s}><h2 style={h2}>8. Sécurité</h2><p style={p}>Chiffrement TLS 1.3, AES-256, authentification JWT, RLS Supabase, mots de passe hachés (bcrypt), sauvegardes quotidiennes.</p></section>
      <section style={s}><h2 style={h2}>9. Cookies</h2><p style={p}>Voir notre <Link href="/cookies" style={link}>Politique de gestion des cookies</Link>.</p></section>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingTop: '16px', borderTop: '1px solid rgba(11,31,23,0.06)' }}>
        <Link href="/mentions-legales" style={link}>Mentions légales</Link>
        <span style={{ color: 'rgba(28,38,32,0.2)', fontSize: '12px' }}>·</span>
        <Link href="/cgu" style={link}>CGU</Link>
        <span style={{ color: 'rgba(28,38,32,0.2)', fontSize: '12px' }}>·</span>
        <Link href="/cgv" style={link}>CGV</Link>
        <span style={{ color: 'rgba(28,38,32,0.2)', fontSize: '12px' }}>·</span>
        <Link href="/cookies" style={link}>Cookies</Link>
      </div>
    </div>
  );
}

export default function PolitiqueConfidentialitePage() {
  return (
    <>
      {/* DESKTOP */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-background text-foreground">
          <Header />
          <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
            <p className="text-xs font-mono text-primary tracking-widest uppercase mb-3" style={{ fontFamily: 'var(--font-mono)' }}>RGPD · Données personnelles</p>
            <h1 className="font-display text-3xl text-foreground mb-2" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>Politique de confidentialité</h1>
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
