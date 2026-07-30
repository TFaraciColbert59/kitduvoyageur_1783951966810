'use client';

import React, { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';

interface Category {
  id: string;
  slug: string;
  name: string;
  productCount: number;
  minWeightG: number;
  image: string;
  imageAlt: string;
  color: string;
}

const categories: Category[] = [
{
  id: '1', slug: 'rando', name: 'Randonnée', productCount: 148, minWeightG: 85,
  image: "https://images.unsplash.com/photo-1694432587403-5d028f01aa10",
  imageAlt: 'Randonneur sur un sentier de montagne avec sac à dos, vue panoramique sur vallée verte',
  color: '#33463C'
},
{
  id: '2', slug: 'camping', name: 'Camping', productCount: 203, minWeightG: 320,
  image: "https://images.unsplash.com/photo-1562206513-6a81cfc73936",
  imageAlt: 'Tente de camping orange installée en forêt au crépuscule, lumière chaude filtrant à travers les arbres',
  color: '#B5652D'
},
{
  id: '3', slug: 'alpinisme', name: 'Alpinisme', productCount: 87, minWeightG: 120,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_11ce01b23-1775110725726.png",
  imageAlt: 'Alpiniste en équipement technique sur une paroi rocheuse enneigée, ciel bleu vif en altitude',
  color: '#3E6B7A'
},
{
  id: '4', slug: 'vanlife', name: 'Vanlife', productCount: 134, minWeightG: 200,
  image: "https://images.unsplash.com/photo-1627386173348-4b19a6feefda",
  imageAlt: 'Intérieur aménagé d\'un van avec lit, cuisine compacte et grandes fenêtres sur paysage forestier',
  color: '#17402C'
},
{
  id: '5', slug: 'photo', name: 'Photo Nature', productCount: 62, minWeightG: 450,
  image: "https://images.unsplash.com/photo-1572800752883-6bc67633d01f",
  imageAlt: 'Appareil photo avec objectif téléobjectif posé sur rocher, fond de montagne floue en bokeh',
  color: '#1C2620'
},
{
  id: '6', slug: 'eau', name: 'Sports Eau', productCount: 91, minWeightG: 180,
  image: "https://images.unsplash.com/photo-1718955389661-1478b39ac2b4",
  imageAlt: 'Kayak orange sur rivière turquoise en forêt, pagayeur en équipement de sécurité',
  color: '#3E6B7A'
}];


export default function CategoriesSection() {
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
      className="py-16 sm:py-20"
      style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}
      aria-labelledby="categories-title">
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <span className="text-xs font-mono-data uppercase tracking-widest text-white/40 block mb-2" style={{ fontFamily: 'var(--font-mono)' }}>
              Par activité
            </span>
            <h2 id="categories-title" className="text-section-title text-white"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(20px)',
              transition: 'opacity 0.7s ease, transform 0.7s cubic-bezier(0.16,1,0.3,1)'
            }}>
              
              Équipement par
              <br />
              <span style={{ color: 'var(--primary)' }}>discipline.</span>
            </h2>
          </div>
          <Link href="/catalogue" className="flex items-center gap-1.5 text-sm font-medium text-white/60 hover:text-white transition-colors flex-shrink-0 min-h-[44px]">
            Voir tout le catalogue
            <Icon name="ArrowRightIcon" size={16} variant="outline" />
          </Link>
        </div>

        {/* Category grid — 2 cols mobile, 3 cols desktop */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {categories.map((cat, idx) =>
          <Link
            key={cat.id}
            href={`/catalogue?cat=${cat.slug}`}
            className="group relative overflow-hidden rounded-xl block"
            aria-label={`Catégorie ${cat.name} — ${cat.productCount} produits`}
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(20px)',
              transition: `opacity 0.5s ease ${idx * 0.07}s, transform 0.5s cubic-bezier(0.16,1,0.3,1) ${idx * 0.07}s`
            }}>
            
              <div className="aspect-[3/4] relative">
                <AppImage
                src={cat.image}
                alt={cat.imageAlt}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                className="object-cover transition-transform duration-700 group-hover:scale-110" />
              
                {/* Scrim */}
                <div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(to top, rgba(28,38,32,0.92) 0%, rgba(28,38,32,0.4) 60%, rgba(28,38,32,0.1) 100%)' }} />
              
                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="font-display font-700 text-white text-sm leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
                    {cat.name}
                  </p>
                  <p className="font-mono-data text-[10px] text-white/50 mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
                    {cat.productCount} produits
                  </p>
                  <p className="font-mono-data text-[10px] mt-0.5" style={{ fontFamily: 'var(--font-mono)', color: 'var(--info)' }}>
                    dès {cat.minWeightG}g
                  </p>
                </div>
                {/* Hover arrow */}
                <div className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300"
              style={{ background: 'var(--primary)' }}>
                
                  <Icon name="ArrowRightIcon" size={12} variant="outline" className="text-white" />
                </div>
              </div>
            </Link>
          )}
        </div>
      </div>
    </section>);

}