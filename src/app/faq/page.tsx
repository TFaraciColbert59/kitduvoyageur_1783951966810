'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import { Button, Card, Chip } from '@/components/ui';

interface FAQItem {
  q: string;
  a: string;
}

interface FAQCategory {
  title: string;
  icon: string;
  items: FAQItem[];
}

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
    <div className="flex flex-col gap-[var(--space-2)]">
      {items.map((item, i) => (
        <Card key={i} variant="standard" className="overflow-hidden p-0">
          <button
            type="button"
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
            className="flex min-h-[var(--lkv-touch-min)] w-full items-center justify-between gap-[var(--space-3)] px-[var(--space-4)] py-[10px] text-left text-[color:var(--lkv-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]"
          >
            <span className="text-[length:var(--lkv-text-body-sm)] font-medium">{item.q}</span>
            <Icon name="ChevronDownIcon" size={16} variant="outline" className={`shrink-0 transition-transform duration-200 ${open === i ? 'rotate-180' : ''}`} />
          </button>
          {open === i && (
            <div className="border-t border-[color:var(--lkv-border-subtle)] bg-[color:var(--lkv-surface-muted)] px-[var(--space-5)] pb-[var(--space-4)] pt-[var(--space-3)] text-[length:var(--lkv-text-body-sm)] leading-[var(--leading-relaxed)] text-[color:var(--lkv-text-secondary)]">
              {item.a}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function FAQContent({ mobile = false }: { mobile?: boolean }) {
  const [activeCategory, setActiveCategory] = useState(0);

  const categories = (
    <div className={`flex flex-wrap gap-[var(--space-2)] ${mobile ? 'mb-[var(--space-5)]' : 'shrink-0'}`}>
      {FAQ_DATA.map((cat, i) => (
        <Chip key={i} selected={activeCategory === i} onClick={() => setActiveCategory(i)} icon={<Icon name={cat.icon} size={14} variant="outline" />}>
          {cat.title}
        </Chip>
      ))}
    </div>
  );

  const helpCard = (
    <Card variant="standard" className="flex flex-col items-center gap-[var(--space-4)] p-[var(--space-5)] text-center sm:flex-row sm:text-left">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--lkv-radius-sm)] bg-[color:var(--lkv-surface-muted)]">
        <Icon name="ChatBubbleLeftRightIcon" size={22} className="text-[color:var(--lkv-secondary)]" variant="outline" />
      </div>
      <div className="flex-1">
        <p className="font-semibold text-[color:var(--lkv-primary)]">Vous n&apos;avez pas trouvé votre réponse ?</p>
        <p className="text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-secondary)]">Notre équipe répond sous 48 heures ouvrées.</p>
      </div>
      <Link href="/contact">
        <Button variant="secondary" icon={<Icon name="EnvelopeIcon" size={14} variant="outline" />}>
          Nous contacter
        </Button>
      </Link>
    </Card>
  );

  if (mobile) {
    return (
      <div className="p-[var(--space-4)]">
        <p className="mb-[var(--space-3)] font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[0.14em] text-[color:var(--sage-100)]">Centre d&apos;aide</p>
        <h1 className="mb-[var(--space-2)] font-display text-[24px] font-extrabold text-[color:var(--lkv-surface)]">Questions fréquentes</h1>
        <p className="mb-[var(--space-5)] text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-forest-100)]">Trouvez rapidement une réponse à votre question.</p>
        {categories}
        <FAQAccordion items={FAQ_DATA[activeCategory].items} />
        <div className="mt-[var(--space-6)]">{helpCard}</div>
      </div>
    );
  }

  return (
    <div data-lkv-material-theme="light" className="h-dvh overflow-hidden bg-transparent">
      <Header />
      <main className="h-full overflow-hidden pt-20">
        <div className="mx-auto flex h-full w-full max-w-4xl flex-col gap-[var(--space-5)] px-[var(--space-6)] pb-[var(--space-6)]">
          <div className="shrink-0">
            <p className="mb-2 font-mono text-[length:var(--lkv-text-caption-1)] uppercase tracking-widest text-[color:var(--sage-100)]">Centre d&apos;aide</p>
            <h1 className="mb-2 font-display text-[length:var(--lkv-text-title-lg)] font-bold tracking-tight text-[color:var(--lkv-surface)]">Questions fréquentes</h1>
            <p className="max-w-xl text-[length:var(--lkv-text-footnote)] leading-[var(--leading-relaxed)] text-[color:var(--lkv-forest-100)]">
              Trouvez rapidement une réponse à votre question. Si vous ne trouvez pas ce que vous cherchez,{' '}
              <Link href="/contact" className="font-medium text-[color:var(--lkv-forest-200)] underline">contactez-nous</Link>.
            </p>
          </div>
          {categories}
          <div className="min-h-0 flex-1 overflow-y-auto pb-2 pr-1">
            <FAQAccordion items={FAQ_DATA[activeCategory].items} />
          </div>
          <div className="shrink-0">{helpCard}</div>
        </div>
      </main>
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

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} suppressHydrationWarning />

      {/* DESKTOP */}
      <div className="hidden md:block">
        <FAQContent />
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <MobilePageShell>
          <FAQContent mobile />
        </MobilePageShell>
      </div>
    </>
  );
}
