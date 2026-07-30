'use client';

import React, { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';

interface CountryCard {
  code: string;
  name: string;
  continent: string;
  bestSeason: string;
  dangerLevel: 'low' | 'medium' | 'high';
  dangerLabel: string;
  image: string;
  imageAlt: string;
  coordinates: string;
  currency: string;
  topKit: string;
}

const featuredCountries: CountryCard[] = [
{
  code: 'IS', name: 'Islande', continent: 'Europe', bestSeason: 'Juin – Août',
  dangerLevel: 'low', dangerLabel: 'Faible', image: "https://images.unsplash.com/photo-1525612136139-31add76ed366",
  imageAlt: 'Aurores boréales vertes et violettes au-dessus d\'une plaine enneigée islandaise, ciel nocturne étoilé',
  coordinates: '64°N 18°W', currency: 'ISK', topKit: 'Kit Islande'
},
{
  code: 'MA', name: 'Maroc', continent: 'Afrique', bestSeason: 'Mars – Mai',
  dangerLevel: 'low', dangerLabel: 'Faible', image: "https://img.rocket.new/generatedImages/rocket_gen_img_1af1e469a-1772901180850.png",
  imageAlt: 'Ruelles colorées de la médina de Marrakech avec murs ocre et portes bleues, lumière chaude de l\'après-midi',
  coordinates: '31°N 8°W', currency: 'MAD', topKit: 'Kit Désert'
},
{
  code: 'JP', name: 'Japon', continent: 'Asie', bestSeason: 'Avr. / Oct.',
  dangerLevel: 'low', dangerLabel: 'Faible', image: "https://images.unsplash.com/photo-1698907164401-eb72bb9b2604",
  imageAlt: 'Mont Fuji enneigé au lever du soleil avec cerisiers en fleurs roses au premier plan, reflet dans lac calme',
  coordinates: '35°N 136°E', currency: 'JPY', topKit: 'Kit Rando'
},
{
  code: 'PE', name: 'Pérou', continent: 'Amérique du Sud', bestSeason: 'Mai – Sept.',
  dangerLevel: 'medium', dangerLabel: 'Moyen', image: "https://images.unsplash.com/photo-1665106947325-3b809b81eea0",
  imageAlt: 'Ruines de Machu Picchu dans la brume matinale avec montagnes andines verdoyantes en arrière-plan',
  coordinates: '9°S 75°W', currency: 'PEN', topKit: 'Kit Trekking'
}];


const dangerColors = {
  low: { bg: 'rgba(62,107,122,0.15)', text: '#3E6B7A', dot: '#3E6B7A' },
  medium: { bg: 'rgba(228,80,28,0.15)', text: '#17402C', dot: '#17402C' },
  high: { bg: 'rgba(200,30,30,0.15)', text: '#c81e1e', dot: '#c81e1e' }
};

export default function CountryTeaserSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {if (entry.isIntersecting) setVisible(true);},
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="py-16 sm:py-20 bg-background"
      aria-labelledby="countries-title">
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(20px)',
              transition: 'opacity 0.7s ease, transform 0.7s cubic-bezier(0.16,1,0.3,1)'
            }}>
            
            <span className="mono-data uppercase tracking-widest block mb-2">Fiches pays</span>
            <h2 id="countries-title" className="text-section-title text-foreground">
              Votre destination.
              <br />
              <span style={{ color: 'var(--info)' }}>Tout ce qu&apos;il faut savoir.</span>
            </h2>
          </div>
          <Link href="/pays" className="btn-secondary text-sm py-2.5 px-5 flex-shrink-0">
            190 pays disponibles
            <Icon name="ArrowRightIcon" size={16} variant="outline" />
          </Link>
        </div>

        {/* Country cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {featuredCountries.map((country, idx) => {
            const dc = dangerColors[country.dangerLevel];
            return (
              <Link
                key={country.code}
                href={`/pays/${country.code.toLowerCase()}`}
                className="group relative overflow-hidden rounded-2xl block"
                aria-label={`Fiche pays ${country.name}`}
                style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'translateY(0)' : 'translateY(20px)',
                  transition: `opacity 0.5s ease ${idx * 0.1}s, transform 0.5s cubic-bezier(0.16,1,0.3,1) ${idx * 0.1}s`
                }}>
                
                <div className="aspect-[3/4] relative">
                  <AppImage
                    src={country.image}
                    alt={country.imageAlt}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105" />
                  
                  {/* Scrim */}
                  <div
                    className="absolute inset-0"
                    style={{ background: 'linear-gradient(to top, rgba(28,38,32,0.92) 0%, rgba(28,38,32,0.5) 55%, rgba(28,38,32,0.15) 100%)' }} />
                  

                  {/* Top badges */}
                  <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2">
                    {/* Danger level */}
                    <span
                      className="flex items-center gap-1 text-[10px] font-600 px-2 py-1 rounded-full"
                      style={{ background: dc.bg, color: dc.text, backdropFilter: 'blur(4px)' }}>
                      
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dc.dot }} />
                      {country.dangerLabel}
                    </span>
                    {/* Continent */}
                    <span
                      className="text-[10px] font-500 px-2 py-1 rounded-full"
                      style={{ background: 'rgba(28,38,32,0.7)', color: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(4px)' }}>
                      
                      {country.continent}
                    </span>
                  </div>

                  {/* Bottom content */}
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="font-display font-700 text-white text-xl mb-1" style={{ fontFamily: 'var(--font-display)' }}>
                      {country.name}
                    </h3>
                    {/* Coordinates */}
                    <p className="font-mono-data text-[10px] text-white/40 mb-2" style={{ fontFamily: 'var(--font-mono)' }}>
                      {country.coordinates} · {country.currency}
                    </p>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-white/40 uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)' }}>
                          Meilleure période
                        </p>
                        <p className="text-white text-xs font-500 mt-0.5">{country.bestSeason}</p>
                      </div>
                      <div
                        className="opacity-0 group-hover:opacity-100 transition-all duration-300 w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ background: 'var(--info)' }}>
                        
                        <Icon name="ArrowRightIcon" size={14} variant="outline" className="text-white" />
                      </div>
                    </div>

                    {/* Kit suggestion */}
                    <div
                      className="mt-3 pt-3 border-t flex items-center gap-1.5"
                      style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                      
                      <Icon name="ShoppingBagIcon" size={11} variant="outline" className="text-primary" />
                      <span className="text-[10px] text-white/50">{country.topKit}</span>
                    </div>
                  </div>
                </div>
              </Link>);

          })}
        </div>
      </div>
    </section>);

}