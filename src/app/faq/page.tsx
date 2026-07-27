'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import NewFooterSection from '@/app/components/home/NewFooterSection';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';

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
      { q: 'Comment retourner un produit ?', a: 'Contactez notre équipe à retour@lekitduvoyageur.fr avec votre numéro de commande. Nous vous enverrons les instructions de retour. Les frais de retour sont à votre charge, sauf en cas de produit défectueux.' },
      { q: 'Quand serai-je remboursé ?', a: 'Le remboursement est effectué dans les 14 jours suivant la réception du produit retourné, par le même moyen de paiement que lors de l\'achat.' },
    ],
  },
  {
    title: 'Configurateur IA',
    icon: 'SparklesIcon',
    items: [
      { q: 'Comment fonctionne le configurateur IA ?', a: 'Notre configurateur IA analyse votre destination, la saison, votre profil de voyageur et vos contraintes de poids et budget pour générer une liste d\'équipement personnalisée et optimisée. Il utilise Google Gemini pour les recommandations.' },
      { q: 'Faut-il un compte pour utiliser le configurateur ?', a: 'Vous pouvez utiliser le configurateur sans compte. Cependant, créer un compte vous permet de sauvegarder vos kits, les retrouver plus tard et les partager.' },
      { q: 'Puis-je modifier les recommandations du configurateur ?', a: 'Oui, les recommandations sont entièrement personnalisables. Vous pouvez ajouter, retirer ou remplacer des articles selon vos préférences.' },
    ],
  },
  {
    title: 'Compte & Fidélité',
    icon: 'UserCircleIcon',
    items: [
      { q: 'Comment créer un compte ?', a: 'Cliquez sur "Connexion" dans le menu, puis sur "Créer un compte". Renseignez votre email et un mot de passe. Vous recevrez un email de confirmation.' },
      { q: 'Comment fonctionne le programme de fidélité ?', a: 'Vous gagnez des points à chaque achat (1 € = 10 points), en publiant des avis, en partageant des guides et en parrainant des amis. Les points se convertissent en réductions sur vos prochaines commandes.' },
      { q: 'J\'ai oublié mon mot de passe, que faire ?', a: 'Sur la page de connexion, cliquez sur "Mot de passe oublié". Entrez votre email et vous recevrez un lien de réinitialisation dans les minutes suivantes.' },
    ],
  },
  {
    title: 'Produits & Garanties',
    icon: 'ShieldCheckIcon',
    items: [
      { q: 'Les produits sont-ils authentiques ?', a: 'Oui, tous les produits vendus sur Le Kit du Voyageur sont authentiques et proviennent directement des marques ou de distributeurs officiels agréés.' },
      { q: 'Quelle est la garantie sur les produits ?', a: 'Tous les produits bénéficient de la garantie légale de conformité (2 ans) et de la garantie contre les vices cachés. Certains produits disposent également d\'une garantie commerciale du fabricant.' },
      { q: 'Un produit est défectueux, que faire ?', a: 'Contactez notre SAV à sav@lekitduvoyageur.fr avec votre numéro de commande et des photos du défaut. Nous traitons les réclamations sous 48 heures ouvrées.' },
    ],
  },
];

function FAQAccordion({ items }: { items: FAQItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="overflow-hidden rounded-xl transition-all" style={{ background: '#fff', border: `1px solid ${open === i ? '#4A6741' : '#E8E4DA'}` }}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left transition-colors"
            style={{ background: open === i ? 'rgba(74,103,65,0.04)' : 'transparent' }}
          >
            <span className="font-semibold text-sm" style={{ color: '#1C2620' }}>{item.q}</span>
            <Icon
              name="ChevronDownIcon"
              size={16}
              variant="outline"
              className={`flex-shrink-0 transition-transform duration-200 ${open === i ? 'rotate-180' : ''}`}
              style={{ color: open === i ? '#4A6741' : '#7A7A6E' } as React.CSSProperties}
            />
          </button>
          {open === i && (
            <div className="px-6 pb-5 text-sm leading-relaxed" style={{ color: '#5C6B5E', borderTop: '1px solid #E8E4DA' }}>
              <div className="pt-4">{item.a}</div>
            </div>
          )}
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

      {/* Hero */}
      <section className="relative overflow-hidden pt-20" style={{ background: '#1C2620' }}>
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <nav className="flex items-center gap-2 text-xs font-mono mb-8" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <Link href="/" className="hover:text-white transition-colors">Accueil</Link>
            <span>/</span>
            <span style={{ color: '#E4501C' }}>FAQ</span>
          </nav>
          <p className="text-xs font-mono tracking-[0.2em] uppercase mb-4" style={{ color: '#4A6741' }}>Centre d&apos;aide</p>
          <h1 className="font-display text-5xl md:text-6xl text-white mb-4 leading-tight" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 800 }}>
            Questions<br /><em>fréquentes.</em>
          </h1>
          <p className="text-white/60 text-lg max-w-xl">
            Trouvez rapidement une réponse à votre question. Sinon,{' '}
            <Link href="/contact" className="text-white/90 hover:text-white underline">contactez-nous</Link>.
          </p>
        </div>
      </section>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Category tabs */}
        <div className="flex flex-wrap gap-2 mb-10">
          {FAQ_DATA.map((cat, i) => (
            <button
              key={i}
              onClick={() => setActiveCategory(i)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={activeCategory === i
                ? { background: '#1C2620', color: '#fff' }
                : { background: '#fff', border: '1px solid #C8C3B0', color: '#5C6B5E' }
              }
            >
              <Icon name={cat.icon} size={14} variant="outline" />
              {cat.title}
            </button>
          ))}
        </div>

        {/* FAQ items */}
        <FAQAccordion items={FAQ_DATA[activeCategory].items} />

        {/* Still need help */}
        <div className="mt-12 p-8 rounded-2xl flex flex-col sm:flex-row items-center gap-6" style={{ background: '#1C2620' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(74,103,65,0.3)' }}>
            <Icon name="ChatBubbleLeftRightIcon" size={24} className="text-white" variant="outline" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <p className="font-display font-700 text-white text-lg" style={{ fontFamily: 'var(--font-display)' }}>Vous n&apos;avez pas trouvé votre réponse ?</p>
            <p className="text-sm text-white/60 mt-1">Notre équipe répond sous 48 heures ouvrées.</p>
          </div>
          <Link
            href="/contact"
            className="flex-shrink-0 flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white transition-all"
            style={{ background: '#4A6741' }}
          >
            <Icon name="EnvelopeIcon" size={14} variant="outline" />
            Nous contacter
          </Link>
        </div>
      </main>

      <NewFooterSection />
    </div>
  );
}

export default function FAQPage() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_DATA.flatMap((category) =>
      category.items.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      }))
    ),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} suppressHydrationWarning />
      <FAQPageContent />
    </>
  );
}
