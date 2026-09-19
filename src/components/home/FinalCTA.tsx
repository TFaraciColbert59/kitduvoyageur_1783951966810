import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

export default function FinalCTA() {
  return (
    <section
      className="relative py-20 md:py-28 overflow-hidden"
      style={{ background: 'var(--dark-bg)' }}
      aria-labelledby="final-cta-heading"
    >
      {/* Background topo texture */}
      <div className="absolute inset-0 opacity-[0.05]" aria-hidden="true">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="cta-topo" x="0" y="0" width="160" height="160" patternUnits="userSpaceOnUse">
              <circle cx="80" cy="80" r="70" fill="none" stroke="white" strokeWidth="1"/>
              <circle cx="80" cy="80" r="50" fill="none" stroke="white" strokeWidth="0.6"/>
              <circle cx="80" cy="80" r="30" fill="none" stroke="white" strokeWidth="0.4"/>
              <circle cx="80" cy="80" r="10" fill="none" stroke="white" strokeWidth="0.3"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#cta-topo)"/>
        </svg>
      </div>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 100%, rgba(200,154,59,0.1) 0%, transparent 70%)' }}
        aria-hidden="true"
      />
      <div className="relative z-10 max-w-4xl mx-auto px-5 sm:px-8 lg:px-12 text-center">
        <p
          className="text-xs font-mono uppercase tracking-widest mb-6"
          style={{ color: 'rgba(231,227,214,0.4)', fontFamily: 'var(--font-mono)' }}
        >
          — Prêt pour l&apos;aventure ?
        </p>

        <h2
          id="final-cta-heading"
          className="text-hero text-white mb-6"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Votre prochaine<br />
          <span style={{ color: '#17402C' }}>expédition commence</span><br />
          <span className="text-white/40">maintenant.</span>
        </h2>

        <p
          className="text-base md:text-lg leading-relaxed mb-10 max-w-xl mx-auto"
          style={{ color: 'rgba(231,227,214,0.55)' }}
        >
          Configurez votre kit en 2 minutes. Gratuit, sans inscription requise.
          Rejoignez les premiers voyageurs de la bêta.
        </p>

        <div
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <Link
            href="/ai-configurator"
            className="glass-capsule-btn primary w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 text-base min-h-[52px]"
          >
            <Icon name="sparkles" size={16} />
            Configurer mon kit IA
          </Link>

          <Link
            href="/pays"
            className="glass-capsule-btn secondary w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 text-base min-h-[52px]"
          >
            Explorer les destinations
          </Link>
        </div>

        {/* Honest trust strip — no fake numbers */}
        <div className="flex flex-wrap justify-center gap-6 mt-10">
          {[
            { icon: '🔒', text: 'Paiement Stripe sécurisé' },
            { icon: '↩️', text: 'Retour gratuit 30 jours' },
            { icon: '🇪🇺', text: 'Hébergé en Europe' },
          ]?.map((item) => (
            <div key={item?.text} className="flex items-center gap-2">
              <span className="text-lg" aria-hidden="true">{item?.icon}</span>
              <span
                className="text-xs font-mono"
                style={{ color: 'rgba(231,227,214,0.4)', fontFamily: 'var(--font-mono)' }}
              >
                {item?.text}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
