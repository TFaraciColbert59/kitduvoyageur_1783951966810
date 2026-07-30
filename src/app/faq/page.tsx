'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import NewFooterSection from '@/app/components/home/NewFooterSection';
import Icon from '@/components/ui/AppIcon';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

interface FAQItem { q: string; a: string; }
interface FAQCategory { title: string; icon: string; items: FAQItem[]; }

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

const FAQ_DATA: FAQCategory[] = [
  {
    title: 'Commandes & Livraison',
    icon: 'ShoppingBagIcon',
    items: [
      { q: 'Quels sont les délais de livraison ?', a: 'Livraison standard (Colissimo) : 3 à 5 jours ouvrés. Livraison express (Chronopost) : 1 à 2 jours ouvrés. Point relais (Mondial Relay) : 2 à 4 jours ouvrés. La livraison est offerte dès 99 € d\'achat.' },
      { q: 'Comment suivre ma commande ?', a: 'Dès l\'expédition de votre commande, vous recevez un email avec un numéro de suivi. Vous pouvez également consulter l\'état de votre commande depuis votre espace compte.' },
      { q: 'Livrez-vous à l\'international ?', a: 'Oui, nous livrons dans toute l\'Union Européenne. Pour les livraisons hors UE, contactez notre service client à sav@lekitduvoyageur.fr.' },
    ],
  },
  {
    title: 'Retours & Remboursements',
    icon: 'ArrowPathIcon',
    items: [
      { q: 'Quel est le délai de rétractation ?', a: 'Vous disposez de 14 jours calendaires à compter de la réception de votre commande pour exercer votre droit de rétractation, sans justification. Envoyez votre demande à retour@lekitduvoyageur.fr.' },
      { q: 'Comment retourner un produit ?', a: 'Contactez notre équipe à retour@lekitduvoyageur.fr avec votre numéro de commande. Nous vous enverrons les instructions de retour.' },
      { q: 'Quand serai-je remboursé ?', a: 'Le remboursement est effectué dans les 14 jours suivant la réception du produit retourné, par le même moyen de paiement.' },
    ],
  },
  {
    title: 'Configurateur IA',
    icon: 'SparklesIcon',
    items: [
      { q: 'Comment fonctionne le configurateur IA ?', a: 'Notre configurateur IA analyse votre destination, la saison, votre profil et vos contraintes pour générer une liste d\'équipement personnalisée.' },
      { q: 'Faut-il un compte pour utiliser le configurateur ?', a: 'Vous pouvez utiliser le configurateur sans compte. Cependant, créer un compte vous permet de sauvegarder vos kits.' },
      { q: 'Puis-je modifier les recommandations ?', a: 'Oui, les recommandations sont entièrement personnalisables.' },
    ],
  },
  {
    title: 'Compte & Fidélité',
    icon: 'UserCircleIcon',
    items: [
      { q: 'Comment créer un compte ?', a: 'Cliquez sur "Connexion" dans le menu, puis sur "Créer un compte". Renseignez votre email et un mot de passe.' },
      { q: 'Comment fonctionne le programme de fidélité ?', a: 'Vous gagnez des points à chaque achat (1 € = 10 points), en publiant des avis, en partageant des guides et en parrainant des amis.' },
      { q: 'J\'ai oublié mon mot de passe, que faire ?', a: 'Sur la page de connexion, cliquez sur "Mot de passe oublié". Entrez votre email et vous recevrez un lien de réinitialisation.' },
    ],
  },
  {
    title: 'Produits & Garanties',
    icon: 'ShieldCheckIcon',
    items: [
      { q: 'Les produits sont-ils authentiques ?', a: 'Oui, tous les produits vendus sur Le Kit du Voyageur sont authentiques et proviennent directement des marques ou de distributeurs officiels agréés.' },
      { q: 'Quelle est la garantie sur les produits ?', a: 'Tous les produits bénéficient de la garantie légale de conformité (2 ans) et de la garantie contre les vices cachés.' },
      { q: 'Un produit est défectueux, que faire ?', a: 'Contactez notre SAV à sav@lekitduvoyageur.fr avec votre numéro de commande et des photos du défaut.' },
    ],
  },
];

function FAQAccordion({ items }: { items: FAQItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="border border-border rounded-xl overflow-hidden">
          <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-foreground/3 transition-colors">
            <span className="font-medium text-foreground text-sm">{item.q}</span>
            <Icon name="ChevronDownIcon" size={16} variant="outline" className={`flex-shrink-0 text-foreground/40 transition-transform duration-200 ${open === i ? 'rotate-180' : ''}`} />
          </button>
          {open === i && <div className="px-5 pb-4 text-sm text-foreground/70 leading-relaxed border-t border-border bg-foreground/2">{item.a}</div>}
        </div>
      ))}
    </div>
  );
}

function FAQAccordionMobile({ items }: { items: FAQItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {items.map((item, i) => (
        <div key={i} style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(11,31,23,0.06)' }}>
          <button onClick={() => setOpen(open === i ? null : i)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '14px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: '#1C2620', flex: 1 }}>{item.q}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(28,38,32,0.4)" strokeWidth="2" style={{ flexShrink: 0, transform: open === i ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {open === i && <div style={{ padding: '0 16px 12px 16px', fontSize: '13px', color: 'rgba(28,38,32,0.7)', lineHeight: '1.6', borderTop: '1px solid rgba(11,31,23,0.06)', paddingTop: '12px' }}>{item.a}</div>}
        </div>
      ))}
    </div>
  );
}

function FAQPageContent() {
  const [activeCategory, setActiveCategory] = useState(0);

  return (
    <div className="min-h-screen" style={{ background: '#F5F2EC' }}>
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <p className="text-xs font-mono text-primary tracking-widest uppercase mb-3" style={{ fontFamily: 'var(--font-mono)' }}>Centre d&apos;aide</p>
        <h1 className="font-display text-3xl md:text-4xl text-foreground mb-3" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>Questions fréquentes</h1>
        <p className="text-foreground/60 mb-10 max-w-xl">Trouvez rapidement une réponse à votre question. Si vous ne trouvez pas ce que vous cherchez, <Link href="/contact" className="text-primary hover:underline">contactez-nous</Link>.</p>
        <div className="flex flex-wrap gap-2 mb-8">
          {FAQ_DATA.map((cat, i) => (
            <button key={i} onClick={() => setActiveCategory(i)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeCategory === i ? 'bg-primary text-white' : 'bg-card border border-border text-foreground/60 hover:border-primary/40 hover:text-foreground'}`}>
              <Icon name={cat.icon} size={14} variant="outline" />{cat.title}
            </button>
          ))}
        </div>
        <FAQAccordion items={FAQ_DATA[activeCategory].items} />
        <div className="mt-12 p-6 bg-card border border-border rounded-2xl flex flex-col sm:flex-row items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0"><Icon name="ChatBubbleLeftRightIcon" size={22} className="text-primary" variant="outline" /></div>
          <div className="flex-1 text-center sm:text-left"><p className="font-semibold text-foreground">Vous n&apos;avez pas trouvé votre réponse ?</p><p className="text-sm text-foreground/60">Notre équipe répond sous 48 heures ouvrées.</p></div>
          <Link href="/contact" className="flex-shrink-0 flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all"><Icon name="EnvelopeIcon" size={14} variant="outline" />Nous contacter</Link>
        </div>
      </main>

      <NewFooterSection />
    </div>
  );
}

function MobileFAQContent() {
  const [activeCategory, setActiveCategory] = useState(0);
  const linkStyle: React.CSSProperties = { color: '#17402C', textDecoration: 'underline' };

  return (
    <div style={{ padding: '16px' }}>
      <p style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#17402C', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '12px' }}>Centre d&apos;aide</p>
      <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#1C2620', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>Questions fréquentes</h1>
      <p style={{ fontSize: '13px', color: 'rgba(28,38,32,0.6)', marginBottom: '20px' }}>Trouvez rapidement une réponse à votre question.</p>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {FAQ_DATA.map((cat, i) => (
          <button key={i} onClick={() => setActiveCategory(i)} style={{ padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: 500, border: 'none', cursor: 'pointer', background: activeCategory === i ? '#17402C' : '#F4F1EA', color: activeCategory === i ? 'white' : 'rgba(28,38,32,0.6)', border: activeCategory === i ? 'none' : '1px solid rgba(11,31,23,0.06)' }}>
            {cat.title}
          </button>
        ))}
      </div>

      <FAQAccordionMobile items={FAQ_DATA[activeCategory].items} />

      <div style={{ marginTop: '24px', padding: '16px', background: '#F4F1EA', borderRadius: '12px', border: '1px solid rgba(11,31,23,0.06)' }}>
        <p style={{ fontSize: '14px', fontWeight: 600, color: '#1C2620', marginBottom: '4px' }}>Vous n&apos;avez pas trouvé votre réponse ?</p>
        <p style={{ fontSize: '13px', color: 'rgba(28,38,32,0.6)', marginBottom: '12px' }}>Notre équipe répond sous 48 heures.</p>
        <Link href="/contact" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#17402C', color: 'white', padding: '10px 20px', borderRadius: '12px', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>
          Nous contacter
        </Link>
      </div>
    </div>
  );
}

export default function FAQPage() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_DATA.flatMap((category) =>
      category.items.map((item) => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } }))
    ),
  };

  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Questions fréquentes — Le Kit du Voyageur',
    description: 'Trouvez les réponses à vos questions sur les commandes, livraisons, retours, le configurateur IA et votre compte.',
    url: `${siteUrl}/faq`,
    isPartOf: { '@type': 'WebSite', name: 'Le Kit du Voyageur', url: siteUrl },
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Questions fréquentes', item: `${siteUrl}/faq` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} suppressHydrationWarning />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }} suppressHydrationWarning />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} suppressHydrationWarning />

      {/* DESKTOP */}
      <div className="hidden md:block">
        <FAQPageContent />
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <MobilePageShell>
          <MobileFAQContent />
        </MobilePageShell>
        
      </div>
    </>
  );
}
