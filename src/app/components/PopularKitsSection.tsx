'use client';

import React, { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import WeightGauge from '@/components/WeightGauge';

/* BENTO GRID AUDIT
 * Array has 5 cards: [Iceland, GR20, Vanlife, Desert, Photo]
 * Row 1: [col-1..2: Iceland cs-2 rs-1] [col-3: GR20 cs-1 rs-2]
 * Row 2: [col-1: Vanlife cs-1 rs-1] [col-2: Desert cs-1 rs-1] [col-3: FILLED by GR20 row-span]
 * Row 3: [col-1..3: Photo cs-3 rs-1]
 * Placed 5/5 cards ✓
 */

interface Kit {
  id: string;
  name: string;
  destination: string;
  activity: string;
  weightG: number;
  maxWeightG: number;
  priceEur: number;
  itemCount: number;
  image: string;
  imageAlt: string;
  colSpan: string;
  rowSpan: string;
  aspectClass: string;
}

const kits: Kit[] = [
{
  id: 'islande',
  name: 'Kit Islande',
  destination: 'Islande',
  activity: 'Trekking',
  weightG: 8400,
  maxWeightG: 12000,
  priceEur: 389,
  itemCount: 24,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_18499f734-1772261868569.png",
  imageAlt: 'Paysage volcanique islandais avec champs de lave noire et ciel nuageux dramatique, lumière basse rasante',
  colSpan: 'col-span-2',
  rowSpan: 'row-span-1',
  aspectClass: 'aspect-[2/1]'
},
{
  id: 'gr20',
  name: 'Kit GR20',
  destination: 'Corse',
  activity: 'Randonnée',
  weightG: 6200,
  maxWeightG: 10000,
  priceEur: 275,
  itemCount: 18,
  image: "https://images.unsplash.com/photo-1629583574997-4fcf0b647205",
  imageAlt: 'Sentier de montagne corse avec crêtes rocheuses et maquis méditerranéen, ciel bleu profond',
  colSpan: 'col-span-1',
  rowSpan: 'row-span-2',
  aspectClass: ''
},
{
  id: 'vanlife',
  name: 'Kit Vanlife',
  destination: 'Europe',
  activity: 'Camping',
  weightG: 14500,
  maxWeightG: 20000,
  priceEur: 520,
  itemCount: 31,
  image: "https://images.unsplash.com/photo-1675912739409-84ab21c16004",
  imageAlt: 'Van aménagé garé au coucher du soleil face à une plaine herbeuse, porte arrière ouverte, lumière chaude orangée',
  colSpan: 'col-span-1',
  rowSpan: 'row-span-1',
  aspectClass: 'aspect-square'
},
{
  id: 'desert',
  name: 'Kit Désert',
  destination: 'Maroc / Sahara',
  activity: 'Expédition',
  weightG: 9800,
  maxWeightG: 15000,
  priceEur: 445,
  itemCount: 27,
  image: "https://images.unsplash.com/photo-1598884283210-af66b5c8a196",
  imageAlt: 'Dunes de sable rouge du Sahara au lever du soleil, ombres longues et ciel dégradé orange vers bleu profond',
  colSpan: 'col-span-1',
  rowSpan: 'row-span-1',
  aspectClass: 'aspect-square'
},
{
  id: 'photo',
  name: 'Kit Photo Nature',
  destination: 'Tous terrains',
  activity: 'Photographie',
  weightG: 11200,
  maxWeightG: 15000,
  priceEur: 680,
  itemCount: 22,
  image: "https://images.unsplash.com/photo-1583138605411-f85466f61638",
  imageAlt: 'Photographe avec trépied face à un panorama montagneux brumeux à l\'aube, silhouette sombre sur fond de ciel nacré',
  colSpan: 'col-span-3',
  rowSpan: 'row-span-1',
  aspectClass: 'aspect-[3/1]'
}];


function KitCard({ kit }: {kit: Kit;}) {
  return (
    <Link
      href={`/kits/${kit.id}`}
      className={`group relative overflow-hidden rounded-2xl block ${kit.rowSpan === 'row-span-2' ? 'h-full' : ''}`}
      aria-label={`Voir le ${kit.name} — ${kit.itemCount} articles, ${(kit.weightG / 1000).toFixed(1)} kg, à partir de ${kit.priceEur} €`}>
      
      <div className={`relative w-full ${kit.rowSpan === 'row-span-2' ? 'h-full min-h-[400px]' : kit.aspectClass}`}>
        <AppImage
          src={kit.image}
          alt={kit.imageAlt}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105" />
        
        {/* Gradient scrim — dark overlay from bottom for white text */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to top, rgba(28,38,32,0.90) 0%, rgba(28,38,32,0.45) 50%, rgba(28,38,32,0.10) 100%)'
          }} />
        

        {/* Activity tag */}
        <div className="absolute top-4 left-4">
          <span className="tag-badge" style={{ background: 'rgba(228,80,28,0.85)', color: 'white', backdropFilter: 'blur(4px)' }}>
            {kit.activity}
          </span>
        </div>

        {/* Price badge */}
        <div className="absolute top-4 right-4">
          <span
            className="font-mono-data text-sm font-600 px-2.5 py-1 rounded-lg"
            style={{
              fontFamily: 'var(--font-mono)',
              background: 'rgba(28,38,32,0.8)',
              color: 'white',
              backdropFilter: 'blur(4px)',
              border: '1px solid rgba(255,255,255,0.15)'
            }}>
            
            {kit.priceEur} €
          </span>
        </div>

        {/* Bottom content */}
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <h3 className="font-display font-700 text-white text-base sm:text-lg leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
                {kit.name}
              </h3>
              <p className="text-white/60 text-xs mt-0.5 flex items-center gap-1">
                <Icon name="MapPinIcon" size={11} variant="outline" />
                {kit.destination}
              </p>
            </div>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0"
              style={{ background: 'var(--primary)' }}>
              
              <Icon name="ArrowRightIcon" size={14} variant="outline" className="text-white" />
            </div>
          </div>

          {/* Weight gauge */}
          <WeightGauge weightG={kit.weightG} maxG={kit.maxWeightG} size="sm" />

          {/* Item count */}
          <p className="font-mono-data text-[10px] text-white/40 mt-1.5" style={{ fontFamily: 'var(--font-mono)' }}>
            {kit.itemCount} articles · {kit.destination}
          </p>
        </div>
      </div>
    </Link>);

}

export default function PopularKitsSection() {
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
      aria-labelledby="kits-title">
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(20px)',
              transition: 'opacity 0.7s ease, transform 0.7s cubic-bezier(0.16,1,0.3,1)'
            }}>
            
            <span className="mono-data uppercase tracking-widest block mb-2">Kits intelligents</span>
            <h2 id="kits-title" className="text-section-title text-foreground">
              Prêt à partir.
              <br />
              <span style={{ color: 'var(--primary)' }}>Rien à oublier.</span>
            </h2>
          </div>
          <Link href="/kits" className="btn-secondary text-sm py-2.5 px-5 flex-shrink-0">
            Tous les kits
            <Icon name="ArrowRightIcon" size={16} variant="outline" />
          </Link>
        </div>

        {/* Bento Grid */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-auto"
          style={{
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.5s ease 0.2s'
          }}>
          
          {/* [col-1..2: Iceland cs-2 rs-1] */}
          <div className="sm:col-span-2 lg:col-span-2">
            <KitCard kit={kits[0]} />
          </div>

          {/* [col-3: GR20 cs-1 rs-2] */}
          <div className="sm:col-span-2 lg:col-span-1 lg:row-span-2 flex flex-col">
            <div className="flex-1 relative" style={{ minHeight: '400px' }}>
              <Link
                href={`/kits/${kits[1].id}`}
                className="group absolute inset-0 overflow-hidden rounded-2xl block"
                aria-label={`Voir le ${kits[1].name}`}>
                
                <AppImage
                  src={kits[1].image}
                  alt={kits[1].imageAlt}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105" />
                
                <div
                  className="absolute inset-0"
                  style={{ background: 'linear-gradient(to top, rgba(28,38,32,0.90) 0%, rgba(28,38,32,0.45) 55%, rgba(28,38,32,0.10) 100%)' }} />
                
                <div className="absolute top-4 left-4">
                  <span className="tag-badge" style={{ background: 'rgba(228,80,28,0.85)', color: 'white', backdropFilter: 'blur(4px)' }}>
                    {kits[1].activity}
                  </span>
                </div>
                <div className="absolute top-4 right-4">
                  <span className="font-mono-data text-sm font-600 px-2.5 py-1 rounded-lg" style={{ fontFamily: 'var(--font-mono)', background: 'rgba(28,38,32,0.8)', color: 'white', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.15)' }}>
                    {kits[1].priceEur} €
                  </span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <h3 className="font-display font-700 text-white text-lg" style={{ fontFamily: 'var(--font-display)' }}>
                    {kits[1].name}
                  </h3>
                  <p className="text-white/60 text-xs mt-0.5 flex items-center gap-1 mb-2">
                    <Icon name="MapPinIcon" size={11} variant="outline" />
                    {kits[1].destination}
                  </p>
                  <WeightGauge weightG={kits[1].weightG} maxG={kits[1].maxWeightG} size="sm" />
                </div>
              </Link>
            </div>
          </div>

          {/* [col-1: Vanlife cs-1 rs-1] */}
          <div className="sm:col-span-1 lg:col-span-1">
            <KitCard kit={kits[2]} />
          </div>

          {/* [col-2: Desert cs-1 rs-1] */}
          <div className="sm:col-span-1 lg:col-span-1">
            <KitCard kit={kits[3]} />
          </div>

          {/* [col-1..3: Photo cs-3 rs-1] */}
          <div className="sm:col-span-2 lg:col-span-3">
            <KitCard kit={kits[4]} />
          </div>
        </div>
      </div>
    </section>);

}