'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CONFIGURATOR_STEPS, getRecommendedItems } from '@/lib/configuratorData';
import { addToCart } from '@/lib/cart';

// SVG Icon renderer matching the mockup icons
function StepIcon({ icon, active }: { icon: string; active: boolean }) {
  const iconColor = active ? 'text-white' : 'text-[#3A4A3D]';
  const badgeBg = active ? 'bg-[#1C3829]' : 'bg-[#F2EFE8]';

  return (
    <div className={`w-9 h-9 rounded-full ${badgeBg} flex items-center justify-center flex-shrink-0 transition-colors`}>
      {icon === 'sun' && (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      )}
      {icon === 'cloud-fog' && (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" /><line x1="4" y1="22" x2="20" y2="22" />
        </svg>
      )}
      {icon === 'rain' && (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <path d="M16 13v8M8 13v8M12 15v8M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" />
        </svg>
      )}
      {icon === 'snowflake' && (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <line x1="12" y1="2" x2="12" y2="22" /><line x1="20" y1="12" x2="4" y2="12" /><line x1="17.66" y1="17.66" x2="6.34" y2="6.34" /><line x1="6.34" y1="17.66" x2="17.66" y2="6.34" />
        </svg>
      )}
      {icon === 'mountain' && (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
        </svg>
      )}
      {icon === 'bike' && (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <circle cx="5.5" cy="17.5" r="3.5" /><circle cx="18.5" cy="17.5" r="3.5" /><path d="M15 6h-5l-3 7h11.5" strokeLinecap="round" />
        </svg>
      )}
      {icon === 'compass' && (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
      )}
      {icon === 'bag' && (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <path d="M6 20h12a2 2 0 0 0 2-2V8H4v10a2 2 0 0 0 2 2z" /><path d="M8 8V6a4 4 0 0 1 8 0v2" />
        </svg>
      )}
      {icon === 'calendar' && (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      )}
      {icon === 'map' && (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" />
        </svg>
      )}
      {icon === 'globe' && (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      )}
      {icon === 'zap' && (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      )}
      {icon === 'scale' && (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3z" />
        </svg>
      )}
      {icon === 'shield' && (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      )}
    </div>
  );
}

export default function KitConfiguratorWizard() {
  const router = useRouter();

  const [currentStepIndex, setCurrentStepIndex] = useState(2); // Start on Step 3 (Météo) matching mockup
  const [answers, setAnswers] = useState<Record<number, string>>({
    1: 'trek',
    2: '3-5d',
    3: 'frais_brumeux',
    4: 'equilibre',
  });

  const step = CONFIGURATOR_STEPS[currentStepIndex];
  const { items, totalPrice, totalWeightKg, durationLabel, weatherLabel } = getRecommendedItems(answers);

  const handleSelectOption = (optionId: string) => {
    setAnswers((prev) => ({ ...prev, [step.id]: optionId }));
  };

  const handleNext = () => {
    if (currentStepIndex < CONFIGURATOR_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      // Step 5: Add items to cart and navigate to panier
      items.forEach((item) => {
        if (item.checked) {
          addToCart({
            id: item.id,
            slug: item.id,
            name: item.name,
            brand: 'Le Kit du Voyageur',
            priceEur: item.price,
            weightG: item.weightKg * 1000,
            image: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=400',
            imageAlt: item.name,
            category: item.category,
          });
        }
      });
      router.push('/panier');
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const nextStepLabel =
    currentStepIndex === 0
      ? 'Continuer vers Durée'
      : currentStepIndex === 1
      ? 'Continuer vers Météo'
      : currentStepIndex === 2
      ? 'Continuer vers Confort'
      : currentStepIndex === 3
      ? 'Voir le récapitulatif'
      : 'Ajouter au panier & commander';

  return (
    <div className="w-full max-w-[1360px] mx-auto px-2 sm:px-6 py-4 font-sans text-[#1C2620]">
      {/* ── TOP META BREADCRUMB BAR ── */}
      <div className="flex items-center justify-between text-xs text-[#7A8A7D] mb-4 px-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[#1C2620]">Configurateur · Composer un sac</span>
          <span>Étape {step.id}/5 - Assistant multi-étapes</span>
        </div>
        <div className="hidden md:flex items-center gap-4 text-xs">
          <Link href="/" className="hover:text-[#1C2620] transition-colors">← Hub</Link>
          <Link href="/shop" className="hover:text-[#1C2620] transition-colors">Boutique</Link>
          <span className="text-[#A3B0A5]">— Fiche</span>
          <Link href="/panier" className="hover:text-[#1C2620] transition-colors">Panier →</Link>
          <span className="text-[#A3B0A5]">Paiement</span>
        </div>
      </div>

      {/* ── MAIN CARD CONTAINER (White Card + Dark Green Live Panel) ── */}
      <div className="bg-white rounded-[28px] border border-[#E2DDD0] shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[640px]">
        
        {/* ── LEFT PANEL (Steps & Question Cards) ── */}
        <div className="lg:col-span-7 flex flex-col p-6 sm:p-10 border-b lg:border-b-0 lg:border-r border-[#EBE7DE]">
          
          {/* Top Brand Navigation inside card */}
          <div className="flex items-center justify-between pb-8 mb-6 border-b border-[#F0ECE1]">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[#1C3829] rounded-lg flex items-center justify-center text-white">
                <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 17l4-8 4 4 3-6 4 10H3z" />
                </svg>
              </div>
              <span className="font-semibold text-sm tracking-tight text-[#1C3829]">Le Kit du Voyageur</span>
            </Link>

            <nav className="hidden sm:flex items-center gap-6 text-xs text-[#526356] font-medium">
              <Link href="/explorer" className="hover:text-[#1C3829] transition-colors">Aventures</Link>
              <Link href="/communaute" className="hover:text-[#1C3829] transition-colors">Refuges</Link>
              <Link href="/shop" className="hover:text-[#1C3829] transition-colors">Boutique</Link>
              <Link href="/guides" className="hover:text-[#1C3829] transition-colors">Journal</Link>
            </nav>

            <Link href="/" className="text-xs text-[#7A8A7D] hover:text-[#1C3829] transition-colors font-medium">
              Quitter le configurateur
            </Link>
          </div>

          {/* Stepper Progress Bar */}
          <div className="flex items-center gap-2 mb-10 overflow-x-auto pb-2 scrollbar-none">
            {CONFIGURATOR_STEPS.map((s, idx) => {
              const isDone = idx < currentStepIndex;
              const isActive = idx === currentStepIndex;

              return (
                <button
                  key={s.id}
                  onClick={() => setCurrentStepIndex(idx)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-[#1C3829] text-white shadow-sm'
                      : isDone
                      ? 'bg-[#EAF0EC] text-[#1C3829] hover:bg-[#DDE7E0]'
                      : 'bg-[#F4F1EA] text-[#8C9C8F] hover:bg-[#EAE6DD]'
                  }`}
                >
                  {isDone ? (
                    <span className="w-4 h-4 rounded-full bg-[#1C3829] text-white flex items-center justify-center text-[10px]">✓</span>
                  ) : (
                    <span className={`w-4 h-4 rounded-full ${isActive ? 'bg-white text-[#1C3829]' : 'bg-[#D6D0C2] text-white'} flex items-center justify-center text-[10px] font-bold`}>
                      {s.id}
                    </span>
                  )}
                  <span>{s.badge.split('·')[0].replace(/^\d+\s*/, '')}</span>
                </button>
              );
            })}
          </div>

          {/* Step Content */}
          <div className="flex-1 flex flex-col justify-between">
            <div>
              {/* Badge */}
              <p className="text-[11px] font-mono uppercase tracking-widest text-[#7A8A7D] font-medium mb-3">
                {step.badge}
              </p>

              {/* Hero Question Title */}
              <h1 className="text-3xl sm:text-4xl font-bold text-[#1C2620] tracking-tight mb-3">
                {step.titlePrefix}
                <span className="font-serif italic font-normal text-[#1C3829]">{step.titleItalic}</span>
                {step.titleSuffix || ''}
              </h1>

              {/* Subtitle */}
              <p className="text-xs sm:text-sm text-[#5C6E60] leading-relaxed max-w-xl mb-8">
                {step.subtitle}
              </p>

              {/* 2x2 Choice Cards Grid (or Step 5 summary) */}
              {step.options.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                  {step.options.map((opt) => {
                    const isSelected = answers[step.id] === opt.id;

                    return (
                      <div
                        key={opt.id}
                        onClick={() => handleSelectOption(opt.id)}
                        className={`group relative p-5 rounded-2xl border cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                          isSelected
                            ? 'border-2 border-[#1C3829] bg-white shadow-md shadow-[#1C3829]/5'
                            : 'border-[#E2DDD0] bg-[#FAF8F3] hover:border-[#1C3829]/40 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <StepIcon icon={opt.icon} active={isSelected} />
                          {isSelected && (
                            <span className="w-5 h-5 rounded-full bg-[#1C3829] text-white flex items-center justify-center text-xs">
                              ✓
                            </span>
                          )}
                        </div>

                        <div>
                          <h3 className="font-bold text-sm text-[#1C2620] mb-1">
                            {opt.titlePrefix}
                            <span className="font-serif italic font-normal text-[#1C3829]">{opt.titleItalic}</span>
                          </h3>
                          <p className="text-xs text-[#6B7A6E] leading-snug">{opt.subtext}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Step 5: Full Equipment List Breakdown */
                <div className="space-y-3 mb-8 bg-[#FAF8F3] p-5 rounded-2xl border border-[#E2DDD0]">
                  <h3 className="text-sm font-semibold text-[#1C3829] mb-2">Composants inclus dans votre sac :</h3>
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-xs py-2 border-b border-[#EBE7DE] last:border-none">
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-[#1C3829] text-white flex items-center justify-center text-[10px]">✓</span>
                        <span className="font-medium text-[#1C2620]">{item.name}</span>
                        <span className="text-[10px] text-[#7A8A7D] bg-[#EBE7DE] px-2 py-0.5 rounded-full">{item.category}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[#7A8A7D]">{item.weightKg} kg</span>
                        <span className="font-semibold text-[#1C3829]">{item.price} €</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-6 border-t border-[#F0ECE1]">
              {currentStepIndex > 0 ? (
                <button
                  onClick={handlePrev}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[#5C6E60] hover:text-[#1C3829] transition-colors"
                >
                  ‹ Précédent
                </button>
              ) : (
                <div />
              )}

              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-7 py-3 rounded-full bg-[#1C3829] hover:bg-[#152B1F] text-white font-semibold text-xs transition-all shadow-md shadow-[#1C3829]/20 hover:-translate-y-px"
              >
                <span>{nextStepLabel}</span>
                <span>→</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL (Dark Glassmorphic Live Kit Summary) ── */}
        <div className="lg:col-span-5 relative bg-[#122419] text-white p-6 sm:p-10 flex flex-col justify-between overflow-hidden">
          {/* Atmospheric background overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#1E3B2A] via-[#122419] to-[#0A140E] opacity-90" />
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1517649763962-0c623266010b?w=800')] bg-cover bg-center opacity-10 mix-blend-overlay pointer-events-none" />

          {/* Content relative wrapper */}
          <div className="relative z-10 space-y-6">
            
            {/* Live Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/20 bg-white/5 backdrop-blur-md text-[11px] font-mono tracking-widest text-[#B5D4BF]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse" />
              <span>VOTRE SAC EN CONSTRUCTION</span>
            </div>

            {/* Title */}
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
                Un kit <span className="font-serif italic font-normal text-[#B5D4BF]">en cours</span> de composition.
              </h2>
              <p className="text-xs text-white/70 leading-relaxed">
                On assemble en temps réel. Vous pourrez tout modifier à l’étape finale — ou tout jeter et recommencer.
              </p>
            </div>

            {/* Glassmorphic Item List Box */}
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between text-xs border-b border-white/10 pb-3">
                <span className="font-mono uppercase tracking-wider text-white/70">
                  CONTENU · {items.filter((i) => i.checked).length} PIÈCES
                </span>
                <span className="font-bold text-[#B5D4BF] bg-white/10 px-2.5 py-1 rounded-md">
                  {totalWeightKg} KG
                </span>
              </div>

              {/* Item rows */}
              <div className="space-y-2.5 text-xs">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 truncate">
                      {item.checked ? (
                        <span className="w-4 h-4 rounded-full bg-[#34D399] text-[#122419] flex items-center justify-center text-[10px] font-bold flex-shrink-0">✓</span>
                      ) : (
                        <span className="w-4 h-4 rounded-full border border-white/30 flex-shrink-0" />
                      )}
                      <span className={`truncate ${item.checked ? 'text-white font-medium' : 'text-white/40 font-normal line-through'}`}>
                        {item.name}
                      </span>
                    </div>
                    <span className="font-mono text-white/80 flex-shrink-0">
                      {item.checked ? `${item.price} €` : '—'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Sous-total */}
              <div className="pt-3 border-t border-white/15 flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-wider text-white/70">SOUS-TOTAL</span>
                <span className="text-2xl font-bold font-mono text-white">{totalPrice} €</span>
              </div>
            </div>

            {/* 2x2 Key-Value Metadata Pills */}
            <div className="grid grid-cols-2 gap-3 text-xs pt-2">
              <div className="bg-white/5 border border-white/10 p-3 rounded-xl">
                <p className="text-[10px] font-mono text-white/50 uppercase tracking-wider mb-1">ADAPTÉ POUR</p>
                <p className="font-semibold text-white">{durationLabel}</p>
              </div>
              <div className="bg-white/5 border border-white/10 p-3 rounded-xl">
                <p className="text-[10px] font-mono text-white/50 uppercase tracking-wider mb-1">MÉTÉO</p>
                <p className="font-semibold text-white">{weatherLabel}</p>
              </div>
              <div className="bg-white/5 border border-white/10 p-3 rounded-xl">
                <p className="text-[10px] font-mono text-white/50 uppercase tracking-wider mb-1">POIDS TOTAL</p>
                <p className="font-semibold text-white">{totalWeightKg} kg</p>
              </div>
              <div className="bg-white/5 border border-white/10 p-3 rounded-xl">
                <p className="text-[10px] font-mono text-white/50 uppercase tracking-wider mb-1">LIVRAISON</p>
                <p className="font-semibold text-white">Sous 48 h</p>
              </div>
            </div>

          </div>

          {/* Footer note */}
          <div className="relative z-10 pt-6 border-t border-white/10 text-[11px] text-white/50">
            Le sac se met à jour à chaque étape. Vous pourrez tout retirer avant paiement.
          </div>
        </div>

      </div>

      {/* ── MOBILE STICKY BOTTOM BAR ── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#122419] text-white border-t border-white/15 px-4 py-3 shadow-2xl flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono text-white/60 uppercase">
            VOTRE SAC · {items.filter((i) => i.checked).length} PIÈCES
          </p>
          <p className="text-sm font-bold font-mono text-[#B5D4BF]">
            {totalWeightKg} KG — {totalPrice} €
          </p>
        </div>

        <button
          onClick={handleNext}
          className="px-5 py-2.5 rounded-full bg-[#34D399] text-[#122419] text-xs font-bold hover:bg-[#22C55E] transition-colors"
        >
          {currentStepIndex === CONFIGURATOR_STEPS.length - 1 ? 'Commander →' : 'Continuer →'}
        </button>
      </div>
    </div>
  );
}
