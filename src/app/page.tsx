import Link from 'next/link';


export const metadata = {
  title: 'Le Kit du Voyageur — Équipement outdoor & aventure',
  description: 'Découvrez les meilleurs kits de voyage, équipements outdoor et conseils d\'aventure.',
};

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-700 text-white py-24 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            Votre Kit de Voyage<br />
            <span className="text-emerald-300">Parfaitement Équipé</span>
          </h1>
          <p className="text-lg md:text-xl text-emerald-100 mb-10 max-w-2xl mx-auto">
            Configurez, comparez et commandez les meilleurs équipements outdoor pour vos aventures.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/ai-configurator"
              className="bg-emerald-400 hover:bg-emerald-300 text-emerald-900 font-semibold px-8 py-4 rounded-xl transition-colors text-lg"
            >
              Configurer mon kit
            </Link>
            <Link
              href="/kits"
              className="border-2 border-white hover:bg-white hover:text-emerald-900 text-white font-semibold px-8 py-4 rounded-xl transition-colors text-lg"
            >
              Explorer les kits
            </Link>
          </div>
        </div>
      </section>
      {/* Categories */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            Explorez par catégorie
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: 'Randonnée', icon: '🥾', href: '/catalogue/randonnee' },
              { label: 'Camping', icon: '⛺', href: '/catalogue/camping' },
              { label: 'Escalade', icon: '🧗', href: '/catalogue/escalade' },
              { label: 'Voyage', icon: '✈️', href: '/catalogue/voyage' },
            ]?.map((cat) => (
              <Link
                key={cat?.label}
                href={cat?.href}
                className="flex flex-col items-center gap-3 bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow border border-gray-100"
              >
                <span className="text-4xl">{cat?.icon}</span>
                <span className="font-semibold text-gray-800">{cat?.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      {/* Features */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            Pourquoi Le Kit du Voyageur ?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: '🤖',
                title: 'Configurateur IA',
                desc: 'Notre IA analyse votre destination et votre profil pour vous recommander l\'équipement idéal.',
              },
              {
                icon: '⭐',
                title: 'Avis vérifiés',
                desc: 'Tous les avis sont vérifiés par des voyageurs ayant réellement utilisé le matériel.',
              },
              {
                icon: '🌍',
                title: 'Communauté active',
                desc: 'Rejoignez des milliers de voyageurs passionnés et partagez vos expéditions.',
              },
            ]?.map((f) => (
              <div key={f?.title} className="text-center p-6">
                <div className="text-5xl mb-4">{f?.icon}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{f?.title}</h3>
                <p className="text-gray-600 leading-relaxed">{f?.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* CTA */}
      <section className="py-16 px-6 bg-emerald-900 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-4">Prêt pour l&apos;aventure ?</h2>
          <p className="text-emerald-200 mb-8 text-lg">
            Créez votre compte et accédez à tous nos outils gratuitement.
          </p>
          <Link
            href="/inscription"
            className="bg-emerald-400 hover:bg-emerald-300 text-emerald-900 font-semibold px-10 py-4 rounded-xl transition-colors text-lg inline-block"
          >
            Créer mon compte
          </Link>
        </div>
      </section>
    </main>
  );
}
