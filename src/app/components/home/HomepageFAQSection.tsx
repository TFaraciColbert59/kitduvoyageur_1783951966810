'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';

const FAQS = [
  {
    q: 'Le configurateur IA est-il vraiment gratuit ?',
    a: 'Oui, totalement. Vous pouvez générer autant de kits que vous voulez sans créer de compte. La création de compte vous permet de sauvegarder vos kits et d\'accéder à votre inventaire.',
  },
  {
    q: 'Les produits sont-ils vraiment en stock ?',
    a: 'Nous travaillons avec des partenaires sélectionnés pour garantir la disponibilité. Chaque produit affiché est vérifiable en temps réel. En cas de rupture, une alternative équivalente vous est proposée.',
  },
  {
    q: 'Puis-je faire confiance aux recommandations IA ?',
    a: 'Notre IA est entraînée sur des données terrain réelles et des retours de voyageurs expérimentés. Elle ne recommande que des produits testés et approuvés. Vous restez libre d\'ajuster chaque suggestion.',
  },
  {
    q: 'Comment fonctionne la section Occasion ?',
    a: 'Des voyageurs vendent leur matériel directement sur la plateforme. Chaque annonce indique l\'état du matériel, et les articles achetés sur Le Kit du Voyageur sont certifiés avec un badge de confiance.',
  },
  {
    q: 'Livrez-vous en dehors de France ?',
    a: 'Actuellement, nous livrons en France métropolitaine, Belgique et Suisse. L\'extension à d\'autres pays européens est prévue pour fin 2026.',
  },
  {
    q: 'Que se passe-t-il si un article ne me convient pas ?',
    a: 'Retour gratuit sous 30 jours, sans justification. Remboursement sous 5 jours ouvrés. Pour les kits complets, chaque article peut être retourné individuellement.',
  },
];

export default function HomepageFAQSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="py-20 md:py-28" style={{ background: '#EDEAE0' }} aria-labelledby="faq-heading">
      <div className="max-w-3xl mx-auto px-5 sm:px-8">
        <div className="mb-12">
          <p className="label-eyebrow mb-4">— Questions fréquentes</p>
          <h2
            id="faq-heading"
            className="text-section-title text-[#1A1F1C]"
          >
            Tout ce que vous{' '}
            <em className="not-italic" style={{ fontStyle: 'italic', fontWeight: 400, color: 'rgba(26,31,28,0.45)' }}>
              voulez savoir.
            </em>
          </h2>
        </div>

        <div className="space-y-2">
          {FAQS.map((faq, i) => (
            <div
              key={i}
              className="rounded-xl overflow-hidden transition-shadow"
              style={{
                background: '#FFFFFF',
                border: '1px solid #DDD9CC',
                boxShadow: open === i ? '0 4px 16px rgba(26,31,28,0.06)' : 'none',
              }}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left min-h-[56px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A3D] focus-visible:ring-inset"
                aria-expanded={open === i}
              >
                <span className="text-sm font-medium text-[#1A1F1C] pr-4">{faq.q}</span>
                <Icon
                  name="ChevronDownIcon"
                  size={16}
                  variant="outline"
                  className={`flex-shrink-0 text-[#6B7568] transition-transform duration-200 ${open === i ? 'rotate-180' : ''}`}
                />
              </button>
              {open === i && (
                <div className="px-5 pb-5">
                  <p className="text-sm text-[#6B7568] leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
