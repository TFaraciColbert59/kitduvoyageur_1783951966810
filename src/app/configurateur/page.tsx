'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { addToCart } from '@/lib/cart';

type Step = 1 | 2 | 3 | 4 | 5;

interface KitItem {
  id: string;
  name: string;
  nameItalic: string;
  price: number | null;
  weightG: number | null;
  confirmed: boolean;
}

const STEP_LABELS = ['Usage', 'Durée', 'Météo', 'Confort', 'Récap'];

const USAGE_OPTIONS = [
  { id: 'randonnee', label: 'Randonnée', labelItalic: 'journée.', desc: 'Sorties à la journée, sentiers balisés, retour au gîte.' },
  { id: 'bivouac', label: 'Bivouac', labelItalic: 'autonome.', desc: 'Nuits en pleine nature, autonomie totale.' },
  { id: 'trek', label: 'Trek', labelItalic: 'longue durée.', desc: 'Expéditions de plusieurs semaines, haute montagne.' },
  { id: 'voyage', label: 'Voyage', labelItalic: 'léger.', desc: 'Déplacements urbains et semi-urbains, mobilité.' },
];

const DUREE_OPTIONS = [
  { id: '1-2', label: '1 à 2 jours', labelItalic: 'week-end.', desc: 'Sortie courte, kit minimaliste.' },
  { id: '3-5', label: '3 à 5 jours', labelItalic: 'semaine.', desc: 'Notre configuration par défaut.' },
  { id: '1-2-sem', label: '1 à 2 semaines', labelItalic: 'autonomie.', desc: 'Kit complet, chaque gramme compte.' },
  { id: '3-plus', label: '3 semaines et plus', labelItalic: 'expédition.', desc: 'Équipement renforcé, durabilité maximale.' },
];

const METEO_OPTIONS = [
  { id: 'chaud', label: 'Sec et', labelItalic: 'chaud.', desc: '15 à 25 °C, faible humidité. On priorise la respirabilité.' },
  { id: 'brumeux', label: 'Frais et', labelItalic: 'brumeux.', desc: '5 à 15 °C avec humidité. Notre configuration par défaut.' },
  { id: 'pluvieux', label: 'Pluvieux et', labelItalic: 'venté.', desc: '0 à 10 °C, précipitations fréquentes. Coques imper renforcées.' },
  { id: 'froid', label: 'Froid', labelItalic: 'sec.', desc: '-5 à 5 °C. Duvet gonflant, base couche lourde.' },
];

const CONFORT_OPTIONS = [
  { id: 'minimaliste', label: 'Minimaliste', labelItalic: 'essentiel.', desc: 'Le strict nécessaire. Chaque gramme est justifié.' },
  { id: 'equilibre', label: 'Équilibré', labelItalic: 'confort.', desc: 'Bon compromis poids / confort. Notre recommandation.' },
  { id: 'confort', label: 'Confort', labelItalic: 'premium.', desc: 'Matelas épais, oreiller, accessoires de confort.' },
];

const INITIAL_KIT: KitItem[] = [
  { id: 'sac', name: 'Sac 45 L', nameItalic: 'toile cirée', price: 340, weightG: 1200, confirmed: true },
  { id: 'duvet', name: 'Duvet', nameItalic: '3 saisons', price: 248, weightG: 800, confirmed: true },
  { id: 'gourde', name: 'Gourde titane', nameItalic: '1 L', price: 68, weightG: 180, confirmed: true },
  { id: 'veste', name: 'Veste', nameItalic: '3 couches', price: null, weightG: null, confirmed: false },
  { id: 'confort', name: 'Confort', nameItalic: 'à choisir', price: null, weightG: null, confirmed: false },
];

export default function ConfigurateurPage() {
  const [step, setStep] = useState<Step>(1);
  const [usage, setUsage] = useState<string>('');
  const [duree, setDuree] = useState<string>('3-5');
  const [meteo, setMeteo] = useState<string>('brumeux');
  const [confort, setConfort] = useState<string>('');
  const [kit] = useState<KitItem[]>(INITIAL_KIT);
  const router = useRouter();

  const confirmedItems = kit.filter(i => i.confirmed);
  const totalPrice = confirmedItems.reduce((sum, i) => sum + (i.price ?? 0), 0);
  const totalWeight = confirmedItems.reduce((sum, i) => sum + (i.weightG ?? 0), 0);
  const meteoLabel = METEO_OPTIONS.find(m => m.id === meteo)?.labelItalic?.replace('.', '') ?? '';

  const handleNext = () => {
    if (step < 5) setStep((step + 1) as Step);
  };
  const handlePrev = () => {
    if (step > 1) setStep((step - 1) as Step);
  };

  const handleFinish = () => {
    // Add confirmed items to cart
    confirmedItems.forEach(item => {
      if (item.price) {
        addToCart({
          id: item.id,
          slug: item.id,
          name: `${item.name} ${item.nameItalic}`,
          priceEur: item.price,
          image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&q=80',
          imageAlt: item.name,
          quantity: 1,
          weightG: item.weightG ?? 0,
          brand: 'Le Kit du Voyageur',
          category: 'Kit',
        });
      }
    });
    window.dispatchEvent(new Event('storage'));
    router.push('/panier');
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div>
            <p className="label-overline mb-3">01 USAGE PRÉVU — SÉLECTIONNEZ UNE RÉPONSE</p>
            <h1 className="mb-2" style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 600, letterSpacing: '-0.025em', color: '#0E1512' }}>
              Quel est votre{' '}
              <em style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontWeight: 400 }}>usage ?</em>
            </h1>
            <p className="text-sm text-[#4A6355] mb-8 leading-relaxed">On adapte le volume du sac, le type de couchage et les accessoires. Une seule réponse : la plus fréquente.</p>
            <div className="flex flex-col gap-3">
              {USAGE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setUsage(opt.id)}
                  className="radio-card text-left"
                  style={{ borderColor: usage === opt.id ? '#1C2620' : '#E0DDD0', backgroundColor: usage === opt.id ? '#EBF0EB' : '#FFFFFF' }}
                >
                  <p style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '1rem', fontWeight: 600, color: '#0E1512' }}>
                    {opt.label}{' '}
                    <em style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontWeight: 400 }}>{opt.labelItalic}</em>
                  </p>
                  <p className="text-sm text-[#4A6355] mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
        );
      case 2:
        return (
          <div>
            <p className="label-overline mb-3">02 DURÉE DU VOYAGE — SÉLECTIONNEZ UNE RÉPONSE</p>
            <h1 className="mb-2" style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 600, letterSpacing: '-0.025em', color: '#0E1512' }}>
              Combien de{' '}
              <em style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontWeight: 400 }}>jours ?</em>
            </h1>
            <p className="text-sm text-[#4A6355] mb-8 leading-relaxed">On adapte le volume du sac et la quantité de consommables. Une seule réponse : la durée typique.</p>
            <div className="flex flex-col gap-3">
              {DUREE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setDuree(opt.id)}
                  className="radio-card text-left"
                  style={{ borderColor: duree === opt.id ? '#1C2620' : '#E0DDD0', backgroundColor: duree === opt.id ? '#EBF0EB' : '#FFFFFF' }}
                >
                  <p style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '1rem', fontWeight: 600, color: '#0E1512' }}>
                    {opt.label}{' '}
                    <em style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontWeight: 400 }}>{opt.labelItalic}</em>
                  </p>
                  <p className="text-sm text-[#4A6355] mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
        );
      case 3:
        return (
          <div>
            <p className="label-overline mb-3">03 MÉTÉO ATTENDUE — SÉLECTIONNEZ UNE RÉPONSE</p>
            <h1 className="mb-2" style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 600, letterSpacing: '-0.025em', color: '#0E1512' }}>
              Quelle météo vous{' '}
              <em style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontWeight: 400 }}>attend ?</em>
            </h1>
            <p className="text-sm text-[#4A6355] mb-8 leading-relaxed">On adapte l&apos;épaisseur du duvet, la respirabilité de la veste et la sensibilité de vos couches. Une seule réponse : la plus fréquente.</p>
            <div className="flex flex-col gap-3">
              {METEO_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setMeteo(opt.id)}
                  className="radio-card text-left"
                  style={{ borderColor: meteo === opt.id ? '#1C2620' : '#E0DDD0', backgroundColor: meteo === opt.id ? '#EBF0EB' : '#FFFFFF' }}
                >
                  <p style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '1rem', fontWeight: 600, color: '#0E1512' }}>
                    {opt.label}{' '}
                    <em style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontWeight: 400 }}>{opt.labelItalic}</em>
                  </p>
                  <p className="text-sm text-[#4A6355] mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
        );
      case 4:
        return (
          <div>
            <p className="label-overline mb-3">04 NIVEAU DE CONFORT — SÉLECTIONNEZ UNE RÉPONSE</p>
            <h1 className="mb-2" style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 600, letterSpacing: '-0.025em', color: '#0E1512' }}>
              Votre niveau de{' '}
              <em style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontWeight: 400 }}>confort ?</em>
            </h1>
            <p className="text-sm text-[#4A6355] mb-8 leading-relaxed">On adapte le matelas, l&apos;oreiller et les accessoires de confort. Une seule réponse.</p>
            <div className="flex flex-col gap-3">
              {CONFORT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setConfort(opt.id)}
                  className="radio-card text-left"
                  style={{ borderColor: confort === opt.id ? '#1C2620' : '#E0DDD0', backgroundColor: confort === opt.id ? '#EBF0EB' : '#FFFFFF' }}
                >
                  <p style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '1rem', fontWeight: 600, color: '#0E1512' }}>
                    {opt.label}{' '}
                    <em style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontWeight: 400 }}>{opt.labelItalic}</em>
                  </p>
                  <p className="text-sm text-[#4A6355] mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
        );
      case 5:
        return (
          <div>
            <p className="label-overline mb-3">05 RÉCAPITULATIF — VOTRE KIT EST PRÊT</p>
            <h1 className="mb-2" style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 600, letterSpacing: '-0.025em', color: '#0E1512' }}>
              Votre kit{' '}
              <em style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontWeight: 400 }}>sur mesure.</em>
            </h1>
            <p className="text-sm text-[#4A6355] mb-8 leading-relaxed">On a assemblé votre kit en fonction de vos réponses. Vous pouvez tout modifier avant de passer commande.</p>
            <div className="border border-[#E0DDD0]" style={{ borderRadius: '2px' }}>
              {kit.map((item, i) => (
                <div key={item.id} className={`flex items-center justify-between px-5 py-4 ${i < kit.length - 1 ? 'border-b border-[#E0DDD0]' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${item.confirmed ? 'bg-[#1C2620] border-[#1C2620]' : 'border-[#D4CFBF]'}`}>
                      {item.confirmed && (
                        <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <span style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '0.9375rem', fontWeight: item.confirmed ? 600 : 400, color: item.confirmed ? '#0E1512' : '#9AAD9E' }}>
                      {item.name}{' '}
                      <em style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontWeight: 400 }}>{item.nameItalic}</em>
                    </span>
                  </div>
                  <span style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '0.9375rem', fontWeight: 600, color: item.confirmed ? '#0E1512' : '#9AAD9E' }}>
                    {item.price ? `${item.price} €` : '—'}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between px-5 py-4 bg-[#F5F3EE] border-t border-[#E0DDD0]">
                <span style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4A6355' }}>
                  SOUS-TOTAL
                </span>
                <span style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '1.125rem', fontWeight: 700, color: '#0E1512' }}>
                  {totalPrice} €
                </span>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F5F3EE' }}>
      <Header />

      {/* Page header */}
      <div className="pt-14 md:pt-14 bg-white border-b border-[#E0DDD0]">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/boutique" className="text-sm text-[#4A6355] hover:text-[#0E1512] transition-colors flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            Boutique
          </Link>
          <button
            onClick={() => router.push('/boutique')}
            className="text-sm text-[#4A6355] hover:text-[#0E1512] transition-colors"
          >
            Quitter le configurateur
          </button>
        </div>

        {/* Step progress */}
        <div className="max-w-6xl mx-auto px-6 lg:px-8 pb-5">
          <div className="flex items-center gap-0">
            {STEP_LABELS.map((label, i) => {
              const stepNum = (i + 1) as Step;
              const isCompleted = stepNum < step;
              const isActive = stepNum === step;
              return (
                <React.Fragment key={label}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: isCompleted ? '#33463C' : isActive ? '#1C2620' : 'transparent',
                        border: isCompleted || isActive ? 'none' : '1.5px solid #D4CFBF',
                      }}
                    >
                      {isCompleted ? (
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : (
                        <span style={{ fontSize: '0.625rem', fontWeight: 700, color: isActive ? '#FFFFFF' : '#9AAD9E' }}>{stepNum}</span>
                      )}
                    </div>
                    <span
                      style={{
                        fontFamily: '"General Sans", "DM Sans", sans-serif',
                        fontSize: '0.8125rem',
                        fontWeight: isActive ? 700 : 400,
                        color: isActive ? '#0E1512' : isCompleted ? '#4A6355' : '#9AAD9E',
                      }}
                    >
                      {label}
                    </span>
                  </div>
                  {i < STEP_LABELS.length - 1 && (
                    <div className="w-8 h-px bg-[#E0DDD0] mx-2 flex-shrink-0" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Step content */}
          <div className="lg:col-span-2">
            {renderStepContent()}

            {/* Navigation buttons */}
            <div className="flex items-center gap-4 mt-10">
              {step > 1 && (
                <button
                  onClick={handlePrev}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-[#1C2620] border border-[#1C2620] hover:bg-[#1C2620] hover:text-white transition-all duration-150"
                  style={{ borderRadius: '2px', minHeight: '44px' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5M12 5l-7 7 7 7"/>
                  </svg>
                  Précédent
                </button>
              )}
              {step < 5 ? (
                <button
                  onClick={handleNext}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-[#1C2620] hover:bg-[#0E1512] transition-all duration-150 ml-auto"
                  style={{ borderRadius: '2px', minHeight: '44px' }}
                >
                  Continuer vers {STEP_LABELS[step]}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </button>
              ) : (
                <button
                  onClick={handleFinish}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-[#1C2620] hover:bg-[#0E1512] transition-all duration-150 ml-auto"
                  style={{ borderRadius: '2px', minHeight: '44px' }}
                >
                  Ajouter au panier
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Sidebar — kit summary */}
          <div className="lg:col-span-1">
            <div className="bg-[#0E1512] text-white p-6 sticky top-20" style={{ borderRadius: '2px' }}>
              <p
                className="mb-1 text-[#6B8A7A]"
                style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}
              >
                VOTRE SAC EN CONSTRUCTION
              </p>
              <h3 className="mb-1" style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '1rem', fontWeight: 600, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
                Un kit{' '}
                <em style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontWeight: 400 }}>en cours</em>{' '}
                de composition.
              </h3>
              <p className="text-xs text-[#6B8A7A] mb-6 leading-relaxed">
                On assemble en temps réel. Vous pourrez tout modifier à l&apos;étape finale — ou tout jeter et recommencer.
              </p>

              {/* Item list */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-3">
                  <span style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6B8A7A' }}>
                    CONTENU · {confirmedItems.length} PIÈCES
                  </span>
                  <span style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6B8A7A' }}>
                    {(totalWeight / 1000).toFixed(1)} KG
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {kit.map((item) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${item.confirmed ? 'bg-[#6B8A7A]' : 'border border-[#33463C]'}`} />
                        <span style={{ fontSize: '0.8125rem', color: item.confirmed ? '#FFFFFF' : '#4A6355', fontWeight: item.confirmed ? 500 : 400 }}>
                          {item.name} <em style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic' }}>{item.nameItalic}</em>
                        </span>
                      </div>
                      <span style={{ fontSize: '0.8125rem', color: item.confirmed ? '#FFFFFF' : '#4A6355', fontWeight: 600 }}>
                        {item.price ? `${item.price} €` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#1C2620]">
                  <span style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6B8A7A' }}>
                    SOUS-TOTAL
                  </span>
                  <span style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '1rem', fontWeight: 700, color: '#FFFFFF' }}>
                    {totalPrice} €
                  </span>
                </div>
              </div>

              {/* Summary grid */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                {[
                  { label: 'ADAPTÉ POUR', value: duree === '3-5' ? '3 jours' : duree === '1-2' ? '2 jours' : duree === '1-2-sem' ? '10 jours' : '21 jours' },
                  { label: 'MÉTÉO', value: meteoLabel || 'Frais, brumeux' },
                  { label: 'POIDS TOTAL', value: `${(totalWeight / 1000).toFixed(1)} kg` },
                  { label: 'LIVRAISON', value: 'Sous 48 h' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-[#161E1A] p-3" style={{ borderRadius: '2px' }}>
                    <p style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4A6355', marginBottom: '0.25rem' }}>
                      {label}
                    </p>
                    <p style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '0.875rem', fontWeight: 600, color: '#FFFFFF' }}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <p className="text-xs text-[#4A6355] leading-relaxed">
                Le sac se met à jour à chaque étape.<br />
                Vous pourrez tout retirer avant paiement.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
