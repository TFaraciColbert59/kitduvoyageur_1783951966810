'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';


interface Thread {
  id: string;
  category: string;
  title: string;
  author: string;
  authorBadge: string;
  replies: number;
  views: number;
  lastActivity: string;
  pinned?: boolean;
  hot?: boolean;
}

interface ExpeditionSheet {
  id: string;
  destination: string;
  country: string;
  author: string;
  authorLevel: string;
  date: string;
  duration: string;
  difficulty: string;
  rating: number;
  gearScore: number;
  budgetReal: number;
  budgetEstimated: number;
  tags: string[];
  image: string;
  alt: string;
}

interface QAItem {
  id: string;
  question: string;
  asker: string;
  answers: number;
  votes: number;
  tags: string[];
  answered: boolean;
  expert?: string;
}

const CATEGORIES = ['Tout', 'Équipement', 'Destinations', 'Sécurité', 'Budget', 'Logistique', 'Nutrition'];

const THREADS: Thread[] = [
{
  id: 't1', category: 'Équipement', pinned: true,
  title: 'Guide complet : choisir sa tente 4 saisons en 2026',
  author: 'Marc_Alpiniste', authorBadge: 'Légende',
  replies: 47, views: 1240, lastActivity: 'Il y a 2h'
},
{
  id: 't2', category: 'Destinations', hot: true,
  title: 'Retour Patagonie Jan 2026 — conditions réelles Torres del Paine',
  author: 'Sophie_Trekker', authorBadge: 'Expert',
  replies: 31, views: 890, lastActivity: 'Il y a 5h'
},
{
  id: 't3', category: 'Sécurité',
  title: 'Protocole altitude > 5000m : acclimatation et signaux d\'alarme',
  author: 'DrMontagne', authorBadge: 'Médecin terrain',
  replies: 22, views: 654, lastActivity: 'Il y a 1j'
},
{
  id: 't4', category: 'Budget',
  title: 'Optimiser son budget Népal : comparatif agences vs autonome',
  author: 'NomadeEco', authorBadge: 'Aventurier',
  replies: 18, views: 432, lastActivity: 'Il y a 2j'
},
{
  id: 't5', category: 'Logistique',
  title: 'Transporter son matériel en avion : règles IATA 2026 mises à jour',
  author: 'LogiTravel', authorBadge: 'Expert',
  replies: 14, views: 310, lastActivity: 'Il y a 3j'
}];


const EXPEDITION_SHEETS: ExpeditionSheet[] = [
{
  id: 'e1',
  destination: 'Circuit des Annapurnas',
  country: 'Népal',
  author: 'Marc_Alpiniste',
  authorLevel: 'Légende',
  date: 'Mars 2026',
  duration: '18 jours',
  difficulty: 'Difficile',
  rating: 4.8,
  gearScore: 92,
  budgetReal: 2340,
  budgetEstimated: 2100,
  tags: ['Haute altitude', 'Trekking', 'Autonomie'],
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1c0a6cfce-1772250378548.png",
  alt: 'Vue panoramique du circuit des Annapurnas avec sommets enneigés et sentier de randonnée'
},
{
  id: 'e2',
  destination: 'Torres del Paine W',
  country: 'Chili',
  author: 'Sophie_Trekker',
  authorLevel: 'Expert',
  date: 'Janvier 2026',
  duration: '5 jours',
  difficulty: 'Modéré',
  rating: 4.6,
  gearScore: 88,
  budgetReal: 1180,
  budgetEstimated: 1000,
  tags: ['Patagonie', 'Vent', 'Refuges'],
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1a804f76d-1783678938924.png",
  alt: 'Torres del Paine avec les trois tours de granit et lac turquoise en Patagonie chilienne'
},
{
  id: 'e3',
  destination: 'Sahara Marocain',
  country: 'Maroc',
  author: 'DesertRider',
  authorLevel: 'Aventurier',
  date: 'Novembre 2025',
  duration: '10 jours',
  difficulty: 'Modéré',
  rating: 4.4,
  gearScore: 79,
  budgetReal: 890,
  budgetEstimated: 950,
  tags: ['Désert', 'Chameau', 'Bivouac'],
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1c7296dbd-1772886484643.png",
  alt: 'Dunes de sable dorées du Sahara marocain au coucher du soleil avec bivouac nomade'
}];


const QA_ITEMS: QAItem[] = [
{
  id: 'q1',
  question: 'Quelle lampe frontale pour -20°C en autonomie 5 jours ?',
  asker: 'PolarExplorer',
  answers: 8, votes: 34,
  tags: ['Éclairage', 'Froid extrême'],
  answered: true,
  expert: 'Marc_Alpiniste'
},
{
  id: 'q2',
  question: 'Purification eau en altitude : UV vs chimique vs filtre ?',
  asker: 'TrekkeurNovice',
  answers: 12, votes: 56,
  tags: ['Eau', 'Altitude', 'Santé'],
  answered: true,
  expert: 'DrMontagne'
},
{
  id: 'q3',
  question: 'Sac à dos 60L vs 80L pour expédition 3 semaines Himalaya ?',
  asker: 'FirstTimer',
  answers: 5, votes: 21,
  tags: ['Sac à dos', 'Himalaya'],
  answered: false
},
{
  id: 'q4',
  question: 'Assurance rapatriement : quelle couverture pour altitude > 6000m ?',
  asker: 'SafetyFirst',
  answers: 3, votes: 18,
  tags: ['Assurance', 'Sécurité'],
  answered: false
}];


const BADGE_COLORS: Record<string, string> = {
  'Légende': 'bg-amber-400/20 text-amber-300 border-amber-400/30',
  'Expert': 'bg-primary/20 text-primary border-primary/30',
  'Médecin terrain': 'bg-green-500/20 text-green-400 border-green-500/30',
  'Aventurier': 'bg-white/10 text-white/60 border-white/20'
};

export default function CommunauteProPage() {
  const [activeTab, setActiveTab] = useState<'forum' | 'qa' | 'fiches'>('forum');
  const [activeCategory, setActiveCategory] = useState('Tout');
  const [newQuestion, setNewQuestion] = useState('');

  const filteredThreads = activeCategory === 'Tout' ?
  THREADS :
  THREADS.filter((t) => t.category === activeCategory);

  return (
    <div className="min-h-screen bg-dark-bg text-white">
      <Header />

      <main className="pt-20">
        {/* Hero */}
        <section className="relative overflow-hidden py-14 px-4">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/8 via-dark-bg to-primary/5 pointer-events-none" />
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-mono mb-6" style={{ fontFamily: 'var(--font-mono)' }}>
              <Icon name="UsersIcon" size={12} variant="outline" />
              PHASE 5 — COMMUNAUTÉ EXPERTE
            </div>
            <h1 className="font-display font-800 text-4xl sm:text-5xl text-white mb-4 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              Le savoir terrain,<br />
              <span className="text-indigo-400">partagé entre experts</span>
            </h1>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">
              Forum, Q&amp;A et fiches de retours d&apos;expédition rédigées par des voyageurs expérimentés. Chaque destination, documentée par ceux qui l&apos;ont vécue.
            </p>
          </div>
        </section>

        {/* Stats Bar */}
        <section className="px-4 pb-8">
          <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
            { label: 'Membres actifs', value: '4 820', icon: 'UsersIcon' },
            { label: 'Discussions', value: '1 340', icon: 'ChatBubbleLeftRightIcon' },
            { label: 'Fiches expédition', value: '287', icon: 'DocumentTextIcon' },
            { label: 'Questions résolues', value: '94%', icon: 'CheckCircleIcon' }].
            map((stat) =>
            <div key={stat.label} className="bg-card border border-border rounded-xl p-4 text-center">
                <Icon name={stat.icon as string} size={18} variant="outline" className="text-indigo-400 mx-auto mb-2" />
                <div className="font-display font-700 text-xl text-white" style={{ fontFamily: 'var(--font-display)' }}>{stat.value}</div>
                <div className="text-xs text-white/40">{stat.label}</div>
              </div>
            )}
          </div>
        </section>

        {/* Tabs */}
        <section className="px-4 pb-4">
          <div className="max-w-5xl mx-auto">
            <div className="flex gap-1 bg-card border border-border rounded-xl p-1 w-fit">
              {(['forum', 'qa', 'fiches'] as const).map((tab) =>
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize ${activeTab === tab ? 'bg-indigo-500 text-white' : 'text-white/50 hover:text-white'}`}>
                
                  {tab === 'forum' ? 'Forum' : tab === 'qa' ? 'Q&A' : 'Fiches Expédition'}
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Forum Tab */}
        {activeTab === 'forum' &&
        <section className="px-4 py-6">
            <div className="max-w-5xl mx-auto">
              {/* Category Filter */}
              <div className="flex gap-2 flex-wrap mb-6">
                {CATEGORIES.map((cat) =>
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${activeCategory === cat ? 'bg-indigo-500 text-white' : 'bg-card border border-border text-white/50 hover:text-white'}`}>
                
                    {cat}
                  </button>
              )}
              </div>

              <div className="space-y-3">
                {filteredThreads.map((thread) =>
              <div key={thread.id} className="bg-card border border-border rounded-xl p-5 hover:border-indigo-500/30 transition-all cursor-pointer group">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {thread.pinned &&
                      <span className="px-2 py-0.5 bg-amber-400/10 text-amber-400 text-xs rounded-full border border-amber-400/20">📌 Épinglé</span>
                      }
                          {thread.hot &&
                      <span className="px-2 py-0.5 bg-red-500/10 text-red-400 text-xs rounded-full border border-red-500/20">🔥 Populaire</span>
                      }
                          <span className="px-2 py-0.5 bg-white/5 text-white/40 text-xs rounded-full">{thread.category}</span>
                        </div>
                        <h3 className="font-medium text-white group-hover:text-indigo-300 transition-colors text-sm sm:text-base leading-snug">
                          {thread.title}
                        </h3>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-white/40">par <span className="text-white/60">{thread.author}</span></span>
                          <span className={`px-2 py-0.5 rounded-full text-xs border ${BADGE_COLORS[thread.authorBadge] || 'bg-white/5 text-white/40 border-white/10'}`}>
                            {thread.authorBadge}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0 text-xs text-white/30">
                        <span className="flex items-center gap-1"><Icon name="ChatBubbleLeftIcon" size={12} variant="outline" />{thread.replies}</span>
                        <span className="flex items-center gap-1"><Icon name="EyeIcon" size={12} variant="outline" />{thread.views}</span>
                        <span>{thread.lastActivity}</span>
                      </div>
                    </div>
                  </div>
              )}
              </div>

              <button className="mt-6 w-full py-3 border border-dashed border-indigo-500/30 rounded-xl text-indigo-400 text-sm hover:bg-indigo-500/5 transition-all flex items-center justify-center gap-2">
                <Icon name="PlusIcon" size={16} variant="outline" />
                Nouvelle discussion
              </button>
            </div>
          </section>
        }

        {/* Q&A Tab */}
        {activeTab === 'qa' &&
        <section className="px-4 py-6">
            <div className="max-w-5xl mx-auto">
              {/* Ask a question */}
              <div className="bg-card border border-indigo-500/20 rounded-xl p-5 mb-6">
                <h3 className="font-medium text-white mb-3 flex items-center gap-2">
                  <Icon name="QuestionMarkCircleIcon" size={16} variant="outline" className="text-indigo-400" />
                  Poser une question
                </h3>
                <div className="flex gap-3">
                  <input
                  type="text"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="Ex: Quelle tente pour le Kilimandjaro en saison des pluies ?"
                  className="flex-1 bg-dark-bg border border-border rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50" />
                
                  <button className="px-5 py-2.5 bg-indigo-500 rounded-xl text-white text-sm font-medium hover:bg-indigo-400 transition-all">
                    Envoyer
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {QA_ITEMS.map((qa) =>
              <div key={qa.id} className="bg-card border border-border rounded-xl p-5 hover:border-indigo-500/20 transition-all">
                    <div className="flex items-start gap-4">
                      <div className="flex flex-col items-center gap-1 flex-shrink-0">
                        <button className="p-1 hover:text-indigo-400 transition-colors text-white/30">
                          <Icon name="ChevronUpIcon" size={16} variant="outline" />
                        </button>
                        <span className="font-mono text-sm font-bold text-white/60" style={{ fontFamily: 'var(--font-mono)' }}>{qa.votes}</span>
                        <button className="p-1 hover:text-white/60 transition-colors text-white/20">
                          <Icon name="ChevronDownIcon" size={16} variant="outline" />
                        </button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-white text-sm sm:text-base mb-2">{qa.question}</h3>
                        <div className="flex flex-wrap items-center gap-2">
                          {qa.tags.map((tag) =>
                      <span key={tag} className="px-2 py-0.5 bg-white/5 text-white/40 text-xs rounded-full">{tag}</span>
                      )}
                          <span className="text-xs text-white/30">par {qa.asker}</span>
                        </div>
                        {qa.answered && qa.expert &&
                    <div className="mt-3 flex items-center gap-2 text-xs text-green-400">
                            <Icon name="CheckCircleIcon" size={12} variant="outline" />
                            Répondu par <span className="font-medium">{qa.expert}</span>
                          </div>
                    }
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${qa.answered ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-white/40'}`}>
                          {qa.answers} rép.
                        </span>
                      </div>
                    </div>
                  </div>
              )}
              </div>
            </div>
          </section>
        }

        {/* Fiches Expédition Tab */}
        {activeTab === 'fiches' &&
        <section className="px-4 py-6">
            <div className="max-w-5xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {EXPEDITION_SHEETS.map((sheet) =>
              <div key={sheet.id} className="bg-card border border-border rounded-2xl overflow-hidden hover:border-indigo-500/30 transition-all group cursor-pointer">
                    <div className="relative h-44">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={sheet.image} alt={sheet.alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-white/60">{sheet.country}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${sheet.difficulty === 'Difficile' ? 'bg-red-500/20 text-red-400' : 'bg-amber-400/20 text-amber-300'}`}>
                            {sheet.difficulty}
                          </span>
                        </div>
                        <h3 className="font-display font-700 text-white text-base mt-1" style={{ fontFamily: 'var(--font-display)' }}>
                          {sheet.destination}
                        </h3>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white/40">{sheet.author}</span>
                          <span className={`px-1.5 py-0.5 rounded text-xs border ${BADGE_COLORS[sheet.authorLevel] || 'bg-white/5 text-white/40 border-white/10'}`}>
                            {sheet.authorLevel}
                          </span>
                        </div>
                        <span className="text-xs text-white/30">{sheet.date}</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="text-center">
                          <div className="text-xs text-white/30 mb-0.5">Durée</div>
                          <div className="text-sm font-medium text-white">{sheet.duration}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-white/30 mb-0.5">Note</div>
                          <div className="text-sm font-medium text-amber-400">★ {sheet.rating}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-white/30 mb-0.5">Équip.</div>
                          <div className="text-sm font-medium text-primary">{sheet.gearScore}/100</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/40">Budget réel</span>
                        <div className="flex items-center gap-2">
                          <span className="text-white/60 line-through">{sheet.budgetEstimated}€</span>
                          <span className={`font-medium ${sheet.budgetReal > sheet.budgetEstimated ? 'text-red-400' : 'text-green-400'}`}>
                            {sheet.budgetReal}€
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1 mt-3">
                        {sheet.tags.map((tag) =>
                    <span key={tag} className="px-2 py-0.5 bg-white/5 text-white/40 text-xs rounded-full">{tag}</span>
                    )}
                      </div>
                    </div>
                  </div>
              )}
              </div>

              <button className="mt-6 w-full py-3 border border-dashed border-indigo-500/30 rounded-xl text-indigo-400 text-sm hover:bg-indigo-500/5 transition-all flex items-center justify-center gap-2">
                <Icon name="PlusIcon" size={16} variant="outline" />
                Publier ma fiche d&apos;expédition
              </button>
            </div>
          </section>
        }
      </main>

      <Footer />
    </div>);

}