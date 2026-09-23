'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import Button from '@/components/ui/Button';

export default function CommunauteProPage() {
  const [activeTab, setActiveTab] = useState<'forum' | 'qa' | 'fiches'>('forum');
  const [notified, setNotified] = useState(false);

  return (
    <>
      {/* DESKTOP */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-transparent text-[var(--glass-label)]">
          <Header />
          <main className="pt-24 pb-20 max-w-4xl mx-auto px-4 text-center">
            <div className="g1 p-8 sm:p-12 rounded-[var(--lkv-radius-hero)] border border-[var(--glass-rim)]">
              <span className="inline-flex items-center px-3.5 py-1 text-[11px] font-semibold tracking-wider uppercase mb-4 rounded-full bg-[var(--g2-bg)] text-[var(--glass-secondary)] border border-[var(--glass-rim)]">
                Espace Professionnel & Guides
              </span>
              <h1 className="font-display font-extrabold text-4xl sm:text-5xl text-[var(--glass-label)] mb-4 tracking-tight">
                Le savoir terrain certifié.
              </h1>
              <p className="text-[var(--glass-secondary)] text-base max-w-xl mx-auto mb-8 font-normal">
                Forum dédié aux encadrants et Q&A sur les conditions d&apos;expédition en temps réel.
              </p>

              {/* État Bientôt Disponible canonique iOS 27 */}
              <div className="g2 p-8 rounded-[var(--lkv-radius-card)] max-w-lg mx-auto text-center border border-[var(--glass-rim)]">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center bg-[var(--g3-bg)] text-[var(--g3-text)] font-bold text-lg shadow-sm">
                  Pro
                </div>
                <h2 className="text-xl font-bold text-[var(--glass-label)] mb-2">Ouverture prochaine des accès</h2>
                <p className="text-sm text-[var(--glass-secondary)] mb-6">
                  L&apos;espace d&apos;entraide et de certification des accompagnateurs moyenne et haute montagne est en cours de déploiement progressif.
                </p>
                {notified ? (
                  <div className="py-2.5 px-4 rounded-full bg-[var(--g2-bg)] text-sm font-semibold text-[var(--glass-label)] border border-[var(--glass-rim)]">
                    Notification enregistrée
                  </div>
                ) : (
                  <Button
                    variant="primary"
                    size="md"
                    className="w-full"
                    onClick={() => setNotified(true)}
                  >
                    Être informé de l&apos;ouverture
                  </Button>
                )}
              </div>
            </div>
          </main>
          <Footer />
        </div>
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div className="px-4 py-6 space-y-6">
            <div>
              <span className="inline-block px-3 py-1 text-[11px] font-semibold tracking-wide uppercase rounded-full bg-[var(--g2-bg)] text-[var(--glass-secondary)] border border-[var(--glass-rim)] mb-2">
                Espace Pro
              </span>
              <h1 className="text-2xl font-extrabold text-[var(--glass-label)] tracking-tight">
                Communauté Certifiée
              </h1>
              <p className="text-sm text-[var(--glass-secondary)] mt-1">
                Plateforme d&apos;échange technique et de retours d&apos;expérience terrain.
              </p>
            </div>

            {/* État Bientôt Disponible mobile */}
            <div className="g1 p-6 rounded-[var(--lkv-radius-card)] border border-[var(--glass-rim)] text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center bg-[var(--g3-bg)] text-[var(--g3-text)] font-bold text-base shadow-sm">
                Pro
              </div>
              <h2 className="text-lg font-bold text-[var(--glass-label)]">Accès en avant-première</h2>
              <p className="text-xs text-[var(--glass-secondary)] leading-relaxed">
                Les fiches d&apos;expédition validées et le forum des guides seront accessibles dès la phase d&apos;ouverture communautaire.
              </p>
              {notified ? (
                <div className="py-2.5 px-4 rounded-full bg-[var(--g2-bg)] text-xs font-semibold text-[var(--glass-label)] border border-[var(--glass-rim)]">
                  Notification enregistrée
                </div>
              ) : (
                <Button
                  variant="primary"
                  size="md"
                  className="w-full"
                  onClick={() => setNotified(true)}
                >
                  Être prévenu de l&apos;ouverture
                </Button>
              )}
            </div>
          </div>
        </MobilePageShell>
      </div>
    </>
  );
}
