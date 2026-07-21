import Link from 'next/link';

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
        style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 100%, rgba(228,80,28,0.1) 0%, transparent 70%)' }}
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
          <span style={{ color: '#E4501C' }}>expédition commence</span><br />
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
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold text-base text-white transition-all duration-200 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1C2620] min-h-[52px]"
            style={{
              background: '#E4501C',
              boxShadow: '0 8px 32px rgba(228,80,28,0.3)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M9 2l1.5 4.5H15l-3.75 2.75 1.5 4.5L9 11l-3.75 2.75 1.5-4.5L3 6.5h4.5L9 2z" fill="currentColor"/>
            </svg>
            Configurer mon kit IA
          </Link>

          <Link
            href="/pays"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold text-base transition-all duration-200 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1C2620] min-h-[52px]"
            style={{
              border: '1.5px solid rgba(231,227,214,0.2)',
              color: 'rgba(231,227,214,0.8)',
            }}
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
