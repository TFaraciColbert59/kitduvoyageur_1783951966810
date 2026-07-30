'use client';

import { useState, useId } from 'react';
import { useRouter } from 'next/navigation';

interface QuizStep {
  id: string;
  question: string;
  options: { label: string; value: string; emoji: string }[];
}

const STEPS: QuizStep[] = [
  {
    id: 'type',
    question: 'Quel type d\'aventure vous attire ?',
    options: [
      { label: 'Randonnée', value: 'randonnee', emoji: '🥾' },
      { label: 'Trek multi-jours', value: 'trek', emoji: '⛺' },
      { label: 'Vélo / Bikepacking', value: 'velo', emoji: '🚴' },
      { label: 'Road trip', value: 'roadtrip', emoji: '🚗' },
    ],
  },
  {
    id: 'duration',
    question: 'Quelle durée envisagez-vous ?',
    options: [
      { label: 'Une journée', value: '1j', emoji: '☀️' },
      { label: 'Un week-end', value: '2-3j', emoji: '🌤️' },
      { label: 'Une semaine', value: '7j', emoji: '📅' },
      { label: 'Plus d\'une semaine', value: '7j+', emoji: '🗓️' },
    ],
  },
  {
    id: 'level',
    question: 'Quel est votre niveau ?',
    options: [
      { label: 'Débutant', value: 'debutant', emoji: '🌱' },
      { label: 'Intermédiaire', value: 'intermediaire', emoji: '💪' },
      { label: 'Confirmé', value: 'confirme', emoji: '🏆' },
      { label: 'Expert', value: 'expert', emoji: '⚡' },
    ],
  },
];

interface QuizState {
  type?: string;
  duration?: string;
  level?: string;
}

export default function QuickStartQuiz() {
  const [isOpen, setIsOpen] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [answers, setAnswers] = useState<QuizState>({});
  const router = useRouter();
  const titleId = useId();

  const currentStep = STEPS[stepIdx];

  const handleAnswer = (value: string) => {
    const newAnswers = { ...answers, [currentStep.id]: value };
    setAnswers(newAnswers);

    if (stepIdx < STEPS.length - 1) {
      setStepIdx((prev) => prev + 1);
    } else {
      // Build query and redirect
      const params = new URLSearchParams();
      if (newAnswers.type) params.set('type', newAnswers.type);
      if (newAnswers.duration) params.set('duration', newAnswers.duration);
      if (newAnswers.level) params.set('level', newAnswers.level);
      router.push(`/ai-configurator?${params.toString()}`);
    }
  };

  const handleReset = () => {
    setStepIdx(0);
    setAnswers({});
    setIsOpen(false);
  };

  const progress = ((stepIdx) / STEPS.length) * 100;

  return (
    <>
      {/* ── DESKTOP: inline widget ── */}
      <section
        className="hidden md:block py-12"
        style={{ background: 'var(--card)' }}
        aria-labelledby={`${titleId}-desktop`}
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
          <div
            className="rounded-2xl p-8 md:p-10"
            style={{ background: 'var(--dark-bg)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            {!isOpen ? (
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <p
                    className="text-xs font-mono uppercase tracking-widest mb-2"
                    style={{ color: 'rgba(231,227,214,0.4)', fontFamily: 'var(--font-mono)' }}
                  >
                    — Vous ne savez pas par où commencer ?
                  </p>
                  <h2
                    id={`${titleId}-desktop`}
                    className="font-display font-bold text-white text-2xl"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    3 questions pour trouver votre aventure idéale.
                  </h2>
                </div>
                <button
                  onClick={() => setIsOpen(true)}
                  className="flex-shrink-0 inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm text-white transition-all duration-200 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17402C] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1C2620] min-h-[44px]"
                  style={{ background: '#17402C' }}
                >
                  ✨ Démarrer le quiz
                </button>
              </div>
            ) : (
              <div>
                {/* Progress bar */}
                <div className="flex items-center gap-4 mb-8">
                  <div
                    className="flex-1 h-1 rounded-full overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.1)' }}
                    role="progressbar"
                    aria-valuenow={stepIdx + 1}
                    aria-valuemin={1}
                    aria-valuemax={STEPS.length}
                    aria-label={`Question ${stepIdx + 1} sur ${STEPS.length}`}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${progress + 33}%`, background: '#17402C' }}
                    />
                  </div>
                  <span
                    className="text-xs font-mono text-white/40 flex-shrink-0"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {stepIdx + 1}/{STEPS.length}
                  </span>
                  <button
                    onClick={handleReset}
                    className="text-xs text-white/40 hover:text-white/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17402C] rounded px-1 min-h-[36px]"
                    aria-label="Recommencer le quiz"
                  >
                    ✕
                  </button>
                </div>

                <h3
                  className="font-display font-bold text-white text-xl mb-6"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {currentStep.question}
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {currentStep.options.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleAnswer(opt.value)}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17402C] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1C2620] min-h-[80px]"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <span className="text-2xl" aria-hidden="true">{opt.emoji}</span>
                      <span className="text-sm font-medium text-white/80">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── MOBILE: floating button + bottom sheet ── */}
      <div className="md:hidden">
        {/* Floating trigger button */}
        {!isOpen && (
          <div
            className="fixed bottom-20 right-4 z-40"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <button
              onClick={() => setIsOpen(true)}
              className="flex items-center gap-2 px-4 py-3 rounded-full font-semibold text-sm text-white shadow-lg transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17402C] focus-visible:ring-offset-2 min-h-[44px]"
              style={{
                background: '#17402C',
                boxShadow: '0 4px 20px rgba(228,80,28,0.4)',
              }}
              aria-label="Ouvrir le quiz pour trouver votre aventure"
            >
              ✨ Quiz aventure
            </button>
          </div>
        )}

        {/* Bottom sheet overlay */}
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40 bg-black/50"
              onClick={handleReset}
              aria-hidden="true"
            />

            {/* Sheet */}
            <div
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl"
              style={{
                background: 'var(--dark-bg)',
                border: '1px solid rgba(255,255,255,0.08)',
                paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)',
              }}
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${titleId}-mobile`}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1" aria-hidden="true">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>

              <div className="px-5 pt-4 pb-2">
                {/* Progress */}
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className="flex-1 h-1 rounded-full overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.1)' }}
                    role="progressbar"
                    aria-valuenow={stepIdx + 1}
                    aria-valuemin={1}
                    aria-valuemax={STEPS.length}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${progress + 33}%`, background: '#17402C' }}
                    />
                  </div>
                  <span
                    className="text-xs font-mono text-white/40"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {stepIdx + 1}/{STEPS.length}
                  </span>
                  <button
                    onClick={handleReset}
                    className="text-white/40 hover:text-white/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17402C] rounded p-1 min-h-[36px] min-w-[36px] flex items-center justify-center"
                    aria-label="Fermer le quiz"
                  >
                    ✕
                  </button>
                </div>

                <h3
                  id={`${titleId}-mobile`}
                  className="font-display font-bold text-white text-lg mb-5"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {currentStep.question}
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  {currentStep.options.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleAnswer(opt.value)}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all duration-100 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17402C] min-h-[80px]"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <span className="text-2xl" aria-hidden="true">{opt.emoji}</span>
                      <span className="text-sm font-medium text-white/80">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
