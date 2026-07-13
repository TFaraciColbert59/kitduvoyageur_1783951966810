'use client';

import React, { useRef, useEffect, useState } from 'react';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';

interface Testimonial {
  id: string;
  name: string;
  role: string;
  trip: string;
  quote: string;
  weightSaved: string;
  rating: number;
  avatar: string;
  avatarAlt: string;
}

const testimonials: Testimonial[] = [
{
  id: '1',
  name: 'Camille Rousseau',
  role: 'Randonneuse, GR20',
  trip: 'GR20 Corse — 15 jours',
  quote: 'Le configurateur m\'a économisé 3,2 kg par rapport à mon sac habituel. J\'ai terminé le GR20 sans blessure aux genoux pour la première fois.',
  weightSaved: '-3 200 g',
  rating: 5,
  avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_1246d41fb-1764802362452.png",
  avatarAlt: 'Femme blonde souriante en tenue de randonnée, fond de montagne'
},
{
  id: '2',
  name: 'Théo Marchand',
  role: 'Vanlifer',
  trip: 'Tour d\'Europe — 4 mois',
  quote: 'Le kit Vanlife est exactement ce dont j\'avais besoin. Rien de trop, rien d\'oublié. La fiche Islande m\'a sauvé la mise pour les prises électriques.',
  weightSaved: '-1 850 g',
  rating: 5,
  avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_195df3f46-1767622236015.png",
  avatarAlt: 'Homme brun barbu souriant, air décontracté, fond clair'
},
{
  id: '3',
  name: 'Amara Diallo',
  role: 'Alpiniste débutante',
  trip: 'Mont Blanc — Été 2025',
  quote: 'J\'avais peur d\'oublier l\'essentiel pour mon premier 4000m. La liste IA était parfaite, et le service client a répondu à toutes mes questions.',
  weightSaved: '-2 600 g',
  rating: 5,
  avatar: "https://images.unsplash.com/photo-1718693942549-a462ba40a378",
  avatarAlt: 'Femme à la peau foncée avec sourire confiant, fond extérieur lumineux'
}];


export default function SocialProofSection() {
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
      className="py-16 sm:py-20 bg-card"
      aria-labelledby="testimonials-title">
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="mono-data uppercase tracking-widest block mb-2">Témoignages</span>
          <h2
            id="testimonials-title"
            className="text-section-title text-foreground"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(20px)',
              transition: 'opacity 0.7s ease, transform 0.7s cubic-bezier(0.16,1,0.3,1)'
            }}>
            
            Ils ont préparé leur aventure
            <br />
            <span style={{ color: 'var(--primary)' }}>avec Kit du Voyageur.</span>
          </h2>
        </div>

        {/* Testimonial cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, idx) =>
          <article
            key={t.id}
            className="topo-card p-6 flex flex-col"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(24px)',
              transition: `opacity 0.6s ease ${idx * 0.12}s, transform 0.6s cubic-bezier(0.16,1,0.3,1) ${idx * 0.12}s`
            }}>
            
              {/* Stars */}
              <div className="flex gap-1 mb-4" aria-label={`Note: ${t.rating}/5`}>
                {Array.from({ length: t.rating }).map((_, i) =>
              <Icon key={i} name="StarIcon" size={14} variant="solid" className="text-accent" />
              )}
              </div>

              {/* Trip tag */}
              <span className="tag-badge tag-activity text-[10px] mb-3 self-start">
                {t.trip}
              </span>

              {/* Quote */}
              <blockquote className="text-foreground text-sm leading-relaxed flex-1 italic mb-5">
                &ldquo;{t.quote}&rdquo;
              </blockquote>

              {/* Weight saved */}
              <div
              className="flex items-center gap-2 mb-4 p-3 rounded-lg"
              style={{ background: 'rgba(228,80,28,0.08)', border: '1px solid rgba(228,80,28,0.15)' }}>
              
                <Icon name="ScaleIcon" size={14} variant="outline" className="text-primary flex-shrink-0" />
                <span className="font-mono-data text-xs text-primary font-600" style={{ fontFamily: 'var(--font-mono)' }}>
                  {t.weightSaved} économisés
                </span>
              </div>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border-2 border-border">
                  <AppImage
                  src={t.avatar}
                  alt={t.avatarAlt}
                  width={40}
                  height={40}
                  className="object-cover w-full h-full" />
                
                </div>
                <div>
                  <p className="font-display font-600 text-foreground text-sm" style={{ fontFamily: 'var(--font-display)' }}>
                    {t.name}
                  </p>
                  <p className="text-muted-foreground text-xs">{t.role}</p>
                </div>
              </div>
            </article>
          )}
        </div>

        {/* Stats bar */}
        <div
          className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-6 pt-10 border-t border-border"
          style={{
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.5s ease 0.4s'
          }}>
          
          {[
          { val: '12 847', label: 'voyages configurés', mono: true },
          { val: '4.8/5', label: 'note moyenne', mono: true },
          { val: '500+', label: 'produits en stock', mono: false },
          { val: '190', label: 'pays documentés', mono: true }].
          map(({ val, label, mono }) =>
          <div key={label} className="text-center">
              <p
              className={`text-2xl sm:text-3xl font-700 text-foreground ${mono ? 'font-mono-data' : 'font-display'}`}
              style={{ fontFamily: mono ? 'var(--font-mono)' : 'var(--font-display)' }}>
              
                {val}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </div>
          )}
        </div>
      </div>
    </section>);

}