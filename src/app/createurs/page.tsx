'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';

interface Creator {
  id: string;
  name: string;
  avatar: string;
  type: 'guide' | 'photographe' | 'vidéaste' | 'formateur';
  trustScore: number;
  verified: boolean;
  linkedClub?: string;
  location: string;
  bio: string;
  sales: number;
  rating: number;
  reviewCount: number;
}

interface Product {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar: string;
  creatorTrustScore: number;
  type: 'itinéraire' | 'gps' | 'preset' | 'formation' | 'pack';
  title: string;
  description: string;
  destination: string;
  price: number;
  originalPrice?: number;
  image: string;
  imageAlt: string;
  rating: number;
  reviewCount: number;
  sales: number;
  linkedClub?: string;
  includes: string[];
  format: string;
  commission: number;
}

const CREATORS: Creator[] = [
{
  id: 'cr1',
  name: 'Thomas Vernet',
  avatar: 'TV',
  type: 'guide',
  trustScore: 94,
  verified: true,
  linkedClub: 'Club Alpinisme',
  location: 'Lyon, France',
  bio: 'Guide de haute montagne certifié UIAGM. 15 ans d\'expéditions Alpes, Himalaya, Andes. Mes itinéraires sont testés et mis à jour chaque saison.',
  sales: 847,
  rating: 4.9,
  reviewCount: 312
},
{
  id: 'cr2',
  name: 'Sophie Marchand',
  avatar: 'SM',
  type: 'photographe',
  trustScore: 88,
  verified: true,
  linkedClub: 'Club Islande',
  location: 'Paris, France',
  bio: 'Photographe de voyage et nature. Spécialiste Islande, Scandinavie, Patagonie. Mes presets sont calibrés pour les conditions de lumière extrêmes.',
  sales: 1243,
  rating: 4.8,
  reviewCount: 487
},
{
  id: 'cr3',
  name: 'Guide GR20 Officiel',
  avatar: 'GG',
  type: 'guide',
  trustScore: 96,
  verified: true,
  linkedClub: 'Club GR20',
  location: 'Corse, France',
  bio: 'Guide officiel du Club GR20. Mes itinéraires incluent les conditions en temps réel, les variantes alpines et les points d\'eau vérifiés chaque semaine.',
  sales: 2156,
  rating: 4.95,
  reviewCount: 891
},
{
  id: 'cr4',
  name: 'Hugo Renard',
  avatar: 'HR',
  type: 'vidéaste',
  trustScore: 91,
  verified: true,
  linkedClub: 'Club Patagonie',
  location: 'Grenoble, France',
  bio: 'Vidéaste et explorateur. Spécialiste Patagonie, Andes et Himalaya. Mes films d\'expédition ont été vus plus de 5 millions de fois sur YouTube.',
  sales: 678,
  rating: 4.87,
  reviewCount: 234
},
{
  id: 'cr5',
  name: 'Clara Fontaine',
  avatar: 'CF',
  type: 'guide',
  trustScore: 95,
  verified: true,
  linkedClub: 'Club Alpes',
  location: 'Chamonix, France',
  bio: 'Randonneuse et auteure. A traversé les Alpes à pied (GR5 intégral) et les Pyrénées. Mes guides sont réputés pour leur précision et leur honnêteté.',
  sales: 1089,
  rating: 4.92,
  reviewCount: 456
},
{
  id: 'cr6',
  name: 'Nadia Volkov',
  avatar: 'NV',
  type: 'formateur',
  trustScore: 89,
  verified: true,
  linkedClub: 'Club Trail',
  location: 'Paris, France',
  bio: 'Coach trail et nutritionniste sportive. Finisher UTMB 3 fois. Mes formations en nutrition sportive ont aidé des centaines de coureurs à performer.',
  sales: 934,
  rating: 4.88,
  reviewCount: 378
},
{
  id: 'cr7',
  name: 'Yasmine Touareg',
  avatar: 'YT',
  type: 'guide',
  trustScore: 93,
  verified: true,
  linkedClub: 'Club Sahara',
  location: 'Marrakech, Maroc',
  bio: 'Guide et ethnologue. Spécialiste des cultures nomades du Sahara. Mes itinéraires incluent des rencontres authentiques avec les communautés locales.',
  sales: 567,
  rating: 4.94,
  reviewCount: 198
},
{
  id: 'cr8',
  name: 'Lars Svensson',
  avatar: 'LS',
  type: 'guide',
  trustScore: 97,
  verified: true,
  linkedClub: 'Club Arctique',
  location: 'Tromsø, Norvège',
  bio: 'Guide polaire. A traversé le Groenland 3 fois et guidé des expéditions en Antarctique. Expert en survie polaire et aurores boréales.',
  sales: 423,
  rating: 4.96,
  reviewCount: 167
},
{
  id: 'cr9',
  name: 'Alice Perrin',
  avatar: 'AP',
  type: 'vidéaste',
  trustScore: 84,
  verified: false,
  linkedClub: 'Club Vanlife',
  location: 'Bordeaux, France',
  bio: 'Vanlifer et vidéaste. 2 ans de vie en van à travers l\'Europe. Mes vidéos sur l\'aménagement et les spots de camping ont aidé des milliers de vanlifers.',
  sales: 789,
  rating: 4.79,
  reviewCount: 312
},
{
  id: 'cr10',
  name: 'Chloé Deschamps',
  avatar: 'CD',
  type: 'formateur',
  trustScore: 90,
  verified: true,
  linkedClub: 'Club Escalade',
  location: 'Marseille, France',
  bio: 'Grimpeuse professionnelle et formatrice. Championne de France de bloc 2019. Mes formations en escalade sont reconnues par la FFME.',
  sales: 456,
  rating: 4.91,
  reviewCount: 189
}];


const PRODUCTS: Product[] = [
{
  id: 'p1',
  creatorId: 'cr1',
  creatorName: 'Thomas Vernet',
  creatorAvatar: 'TV',
  creatorTrustScore: 94,
  type: 'itinéraire',
  title: 'Haute Route Chamonix–Zermatt — Guide Complet',
  description: 'Itinéraire détaillé de 12 jours avec variantes, refuges, points d\'eau, passages techniques. Mis à jour juillet 2026. Inclut les conditions nivologiques et météo historiques.',
  destination: 'Alpes',
  price: 24,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_17bffd6f0-1783704681606.png",
  imageAlt: 'Randonneur sur sentier alpin avec vue sur glacier et sommets enneigés de la Haute Route',
  rating: 4.9,
  reviewCount: 156,
  sales: 423,
  linkedClub: 'Club Alpinisme',
  includes: ['PDF 87 pages', 'Tracé GPX', 'Fiches refuges', 'Météo historique', 'Mises à jour 1 an'],
  format: 'PDF + GPX',
  commission: 15
},
{
  id: 'p2',
  creatorId: 'cr2',
  creatorName: 'Sophie Marchand',
  creatorAvatar: 'SM',
  creatorTrustScore: 88,
  type: 'preset',
  title: 'Pack Presets Islande — Lumière Nordique',
  description: '24 presets Lightroom calibrés pour les conditions islandaises : aurores boréales, midnight sun, paysages volcaniques, cascades. Compatibles mobile et desktop.',
  destination: 'Islande',
  price: 18,
  originalPrice: 28,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1aa11775e-1772248841023.png",
  imageAlt: 'Paysage islandais avec aurores boréales vertes sur lac glaciaire',
  rating: 4.8,
  reviewCount: 234,
  sales: 891,
  linkedClub: 'Club Islande',
  includes: ['24 presets Lightroom', 'Guide d\'utilisation', 'Vidéo tutoriel 45 min', 'Mises à jour incluses'],
  format: 'XMP + DNG',
  commission: 15
},
{
  id: 'p3',
  creatorId: 'cr3',
  creatorName: 'Guide GR20 Officiel',
  creatorAvatar: 'GG',
  creatorTrustScore: 96,
  type: 'pack',
  title: 'Pack GR20 Intégral — Guide + GPS + Conditions',
  description: 'Le pack complet pour le GR20 : itinéraire détaillé, tracés GPX des 16 étapes + variantes alpines, points d\'eau vérifiés, refuges avec disponibilités, météo en temps réel via le Club GR20.',
  destination: 'Corse',
  price: 32,
  image: "https://images.unsplash.com/photo-1697543626559-5887eda4a5d1",
  imageAlt: 'Vue panoramique du GR20 corse avec sentier rocheux et mer en arrière-plan',
  rating: 4.95,
  reviewCount: 412,
  sales: 1247,
  linkedClub: 'Club GR20',
  includes: ['Guide PDF 120 pages', '16 tracés GPX', 'Points d\'eau vérifiés', 'Accès Club GR20 1 an', 'Mises à jour hebdo'],
  format: 'PDF + GPX + Accès club',
  commission: 15
},
{
  id: 'p4',
  creatorId: 'cr1',
  creatorName: 'Thomas Vernet',
  creatorAvatar: 'TV',
  creatorTrustScore: 94,
  type: 'formation',
  title: 'Formation Alpinisme Débutant — 6 modules',
  description: 'Formation complète pour débuter l\'alpinisme en sécurité : matériel, techniques de base, lecture de terrain, météo montagne, premiers secours altitude. 6 modules vidéo + quiz.',
  destination: 'Alpes',
  price: 89,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_11e7a48e6-1783704681596.png",
  imageAlt: 'Alpiniste en formation sur glacier avec guide montrant technique de progression sur neige',
  rating: 4.85,
  reviewCount: 78,
  sales: 234,
  linkedClub: 'Club Alpinisme',
  includes: ['6 modules vidéo (4h)', 'Quiz de validation', 'PDF récapitulatifs', 'Accès à vie', 'Certificat de complétion'],
  format: 'Vidéo + PDF',
  commission: 15
},
{
  id: 'p5',
  creatorId: 'cr2',
  creatorName: 'Sophie Marchand',
  creatorAvatar: 'SM',
  creatorTrustScore: 88,
  type: 'gps',
  title: 'Pack GPS Patagonie — Torres del Paine W + O',
  description: 'Tracés GPX complets des circuits W et O avec points d\'intérêt, refuges, sources d\'eau, passages délicats. Inclut les variantes peu connues et les spots photo.',
  destination: 'Patagonie',
  price: 14,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1f4b56b0f-1783704681589.png",
  imageAlt: 'Torres del Paine avec les trois tours de granit et lac turquoise au premier plan',
  rating: 4.7,
  reviewCount: 89,
  sales: 312,
  includes: ['Tracés GPX W + O', 'Points d\'intérêt', 'Spots photo géolocalisés', 'Compatible Garmin/Komoot'],
  format: 'GPX',
  commission: 15
},
{
  id: 'p6',
  creatorId: 'cr3',
  creatorName: 'Guide GR20 Officiel',
  creatorAvatar: 'GG',
  creatorTrustScore: 96,
  type: 'itinéraire',
  title: 'GR20 Variantes Alpines — Sections Techniques',
  description: 'Guide spécialisé sur les 6 variantes alpines du GR20 : accès, difficultés techniques, équipement nécessaire, conditions optimales. Pour randonneurs expérimentés.',
  destination: 'Corse',
  price: 16,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1400319db-1783704681541.png",
  imageAlt: 'Randonneur sur variante alpine du GR20 avec vue sur mer et crêtes corses',
  rating: 4.9,
  reviewCount: 67,
  sales: 189,
  linkedClub: 'Club GR20',
  includes: ['PDF 45 pages', 'Tracés GPX variantes', 'Fiches techniques', 'Photos terrain'],
  format: 'PDF + GPX',
  commission: 15
},
{
  id: 'p7',
  creatorId: 'cr4',
  creatorName: 'Hugo Renard',
  creatorAvatar: 'HR',
  creatorTrustScore: 91,
  type: 'formation',
  title: 'Masterclass Vidéo Expédition — Filmer l\'aventure',
  description: 'Apprenez à filmer et monter vos aventures comme un professionnel. Techniques de prise de vue en conditions extrêmes, montage narratif, musique libre de droits.',
  destination: 'Universel',
  price: 69,
  image: 'https://images.unsplash.com/photo-1734902204925-4544ef4eb744',
  imageAlt: 'Vidéaste avec caméra sur trépied filmant un paysage de montagne au coucher du soleil',
  rating: 4.82,
  reviewCount: 123,
  sales: 345,
  includes: ['8 modules vidéo (6h)', 'Presets DaVinci Resolve', 'Pack musiques libres', 'Accès communauté Discord'],
  format: 'Vidéo + Ressources',
  commission: 15
},
{
  id: 'p8',
  creatorId: 'cr5',
  creatorName: 'Clara Fontaine',
  creatorAvatar: 'CF',
  creatorTrustScore: 95,
  type: 'itinéraire',
  title: 'GR5 Complet — Guide de Traversée des Alpes',
  description: 'Le guide complet pour la traversée des Alpes à pied. 45 étapes détaillées, refuges, bivouacs, variantes, conseils logistiques. Basé sur 3 traversées personnelles.',
  destination: 'Alpes',
  price: 35,
  image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4',
  imageAlt: 'Randonneuse sur sentier alpin du GR5 avec vue panoramique sur les vallées',
  rating: 4.93,
  reviewCount: 289,
  sales: 678,
  includes: ['PDF 180 pages', '45 tracés GPX', 'Fiches refuges + bivouacs', 'Profils altimètriques', 'Mises à jour 2 ans'],
  format: 'PDF + GPX',
  commission: 15
},
{
  id: 'p9',
  creatorId: 'cr6',
  creatorName: 'Nadia Volkov',
  creatorAvatar: 'NV',
  creatorTrustScore: 89,
  type: 'formation',
  title: 'Programme Nutrition Ultra-Trail — 12 semaines',
  description: 'Programme de nutrition complet pour préparer un ultra-trail. Périodisation nutritionnelle, recettes adaptées, gestion des ravitaillements, récupération. Basé sur 3 finishes UTMB.',
  destination: 'Universel',
  price: 79,
  image: 'https://images.unsplash.com/photo-1571008887538-b36bb32f4571',
  imageAlt: 'Coureur de trail avec ceinture de ravitaillement sur sentier de montagne',
  rating: 4.88,
  reviewCount: 156,
  sales: 423,
  includes: ['Programme 12 semaines', '50 recettes adaptées', 'Calculateur de besoins', 'Suivi personnalisé 1 mois', 'Accès groupe privé'],
  format: 'PDF + Application',
  commission: 15
},
{
  id: 'p10',
  creatorId: 'cr7',
  creatorName: 'Yasmine Touareg',
  creatorAvatar: 'YT',
  creatorTrustScore: 93,
  type: 'itinéraire',
  title: 'Traversée du Sahara Marocain — Guide Complet',
  description: 'L\'itinéraire complet pour traverser le Sahara marocain en autonomie. Routes, points d\'eau, contacts locaux, sécurité, culture nomade. 14 jours de désert.',
  destination: 'Maroc',
  price: 28,
  image: 'https://images.unsplash.com/photo-1509316785289-025f5b846b35',
  imageAlt: 'Randonneur solitaire marchant sur une dune de sable au coucher du soleil dans le Sahara',
  rating: 4.94,
  reviewCount: 134,
  sales: 289,
  includes: ['PDF 95 pages', 'Tracés GPX', 'Contacts locaux vérifiés', 'Guide culturel', 'Urgences et sécurité'],
  format: 'PDF + GPX',
  commission: 15
},
{
  id: 'p11',
  creatorId: 'cr8',
  creatorName: 'Lars Svensson',
  creatorAvatar: 'LS',
  creatorTrustScore: 97,
  type: 'formation',
  title: 'Survie Polaire — Formation Complète',
  description: 'Formation complète en survie polaire : construction d\'abris de neige, navigation arctique, gestion du froid extrême, secours en milieu polaire. 10 modules vidéo.',
  destination: 'Arctique',
  price: 129,
  image: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256',
  imageAlt: 'Guide polaire construisant un igloo dans paysage arctique enneigé',
  rating: 4.96,
  reviewCount: 89,
  sales: 234,
  includes: ['10 modules vidéo (8h)', 'Manuel PDF 200 pages', 'Fiches techniques', 'Accès à vie', 'Certificat de complétion'],
  format: 'Vidéo + PDF',
  commission: 15
},
{
  id: 'p12',
  creatorId: 'cr9',
  creatorName: 'Alice Perrin',
  creatorAvatar: 'AP',
  creatorTrustScore: 84,
  type: 'formation',
  title: 'Aménager son Van — Guide Complet 2026',
  description: 'Tout ce qu\'il faut savoir pour aménager son van : isolation, électricité, eau, cuisine, couchage. Plans détaillés, liste de matériel, budget réaliste. Basé sur 2 ans d\'expérience.',
  destination: 'Universel',
  price: 49,
  image: 'https://images.unsplash.com/photo-1675912739409-84ab21c16004',
  imageAlt: 'Intérieur d\'un van aménagé avec cuisine, couchage et rangements optimisés',
  rating: 4.79,
  reviewCount: 234,
  sales: 567,
  includes: ['Guide PDF 150 pages', 'Plans d\'aménagement', 'Liste de matériel', 'Calculateur électrique', 'Groupe Facebook privé'],
  format: 'PDF + Plans',
  commission: 15
},
{
  id: 'p13',
  creatorId: 'cr10',
  creatorName: 'Chloé Deschamps',
  creatorAvatar: 'CD',
  creatorTrustScore: 90,
  type: 'formation',
  title: 'Escalade Débutant → Confirmé — 8 semaines',
  description: 'Programme complet pour progresser de débutant à confirmé en escalade. Techniques de base, travail de la force, progression en tête, sécurité. 8 semaines de programme structuré.',
  destination: 'Universel',
  price: 59,
  image: 'https://images.unsplash.com/photo-1607194383665-b75c341d03d0',
  imageAlt: 'Grimpeuse sur mur d\'escalade en salle avec instructeur en bas',
  rating: 4.91,
  reviewCount: 145,
  sales: 378,
  includes: ['Programme 8 semaines', '6 modules vidéo (5h)', 'Fiches techniques', 'Suivi progression', 'Accès communauté'],
  format: 'Vidéo + PDF',
  commission: 15
},
{
  id: 'p14',
  creatorId: 'cr2',
  creatorName: 'Sophie Marchand',
  creatorAvatar: 'SM',
  creatorTrustScore: 88,
  type: 'preset',
  title: 'Pack Presets Montagne — 4 Saisons',
  description: '36 presets Lightroom pour la photographie de montagne en toutes saisons. Neige, automne, été, printemps. Calibrés pour les conditions de haute altitude.',
  destination: 'Alpes',
  price: 22,
  image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4',
  imageAlt: 'Paysage de montagne en automne avec couleurs dorées et sommets enneigés',
  rating: 4.76,
  reviewCount: 178,
  sales: 634,
  includes: ['36 presets Lightroom', 'Guide d\'utilisation', 'Tutoriel vidéo 30 min', 'Mises à jour incluses'],
  format: 'XMP + DNG',
  commission: 15
},
{
  id: 'p15',
  creatorId: 'cr4',
  creatorName: 'Hugo Renard',
  creatorAvatar: 'HR',
  creatorTrustScore: 91,
  type: 'gps',
  title: 'Pack GPS Patagonie — Circuits Secrets',
  description: 'Les circuits hors des sentiers battus en Patagonie. Des itinéraires peu connus, loin des foules, avec des paysages à couper le souffle. Tracés GPX + notes de terrain.',
  destination: 'Patagonie',
  price: 19,
  image: 'https://images.unsplash.com/photo-1501854140801-50d01698950b',
  imageAlt: 'Paysage sauvage de Patagonie avec lac turquoise et montagnes enneigées sans touristes',
  rating: 4.83,
  reviewCount: 67,
  sales: 189,
  includes: ['12 tracés GPX secrets', 'Notes de terrain', 'Spots photo exclusifs', 'Conditions d\'accès'],
  format: 'GPX + PDF',
  commission: 15
}];


const typeConfig = {
  itinéraire: { color: 'bg-emerald-100 text-emerald-700', icon: '🗺️' },
  gps: { color: 'bg-blue-100 text-blue-700', icon: '📍' },
  preset: { color: 'bg-purple-100 text-purple-700', icon: '📷' },
  formation: { color: 'bg-amber-100 text-amber-700', icon: '🎓' },
  pack: { color: 'bg-primary/10 text-primary', icon: '📦' }
};

function TrustRing({ score, size = 36 }: {score: number;size?: number;}) {
  const r = (size - 5) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - score / 100 * circ;
  const color = score >= 90 ? '#10b981' : score >= 75 ? '#3b82f6' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={2.5} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={2.5}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <span className="absolute font-mono-data text-foreground" style={{ fontSize: size * 0.26, fontWeight: 700 }}>{score}</span>
    </div>);

}

function ProductCard({ product }: {product: Product;}) {
  const [inCart, setInCart] = useState(false);
  const cfg = typeConfig[product.type];

  return (
    <div className="topo-card overflow-hidden flex flex-col">
      <div className="relative aspect-[16/9] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={product.image} alt={product.imageAlt} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className={`text-[10px] font-700 px-2 py-0.5 rounded-full ${cfg.color}`}>
            {cfg.icon} {product.type}
          </span>
          {product.linkedClub &&
          <span className="text-[10px] font-600 px-2 py-0.5 rounded-full bg-secondary/80 text-white">
              {product.linkedClub}
            </span>
          }
        </div>
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="font-display font-700 text-white text-sm leading-tight">{product.title}</h3>
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col">
        {/* Creator */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-secondary text-white flex items-center justify-center text-[10px] font-700 flex-shrink-0">
            {product.creatorAvatar}
          </div>
          <span className="text-xs font-600 text-foreground flex-1 truncate">{product.creatorName}</span>
          <TrustRing score={product.creatorTrustScore} size={30} />
        </div>

        <p className="text-xs text-muted-foreground mb-3 leading-relaxed line-clamp-2">{product.description}</p>

        {/* Includes */}
        <div className="mb-3 flex-1">
          <p className="text-[10px] font-700 text-muted-foreground uppercase tracking-wide mb-1.5">Inclus</p>
          <div className="space-y-1">
            {product.includes.slice(0, 3).map((inc) =>
            <p key={inc} className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                <span className="text-emerald-500">✓</span>
                {inc}
              </p>
            )}
            {product.includes.length > 3 &&
            <p className="text-[10px] text-muted-foreground">+{product.includes.length - 3} autres...</p>
            }
          </div>
        </div>

        {/* Rating & sales */}
        <div className="flex items-center gap-3 mb-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="text-amber-500">★</span>
            <span className="font-700 text-foreground">{product.rating}</span>
            <span>({product.reviewCount})</span>
          </span>
          <span>{product.sales} ventes</span>
          <span className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded">{product.format}</span>
        </div>

        {/* Price & CTA */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-display font-700 text-foreground text-xl">{product.price}€</span>
              {product.originalPrice &&
              <span className="text-sm text-muted-foreground line-through">{product.originalPrice}€</span>
              }
            </div>
            <p className="text-[10px] text-muted-foreground">Commission plateforme : {product.commission}%</p>
          </div>
          <button
            onClick={() => setInCart((v) => !v)}
            className={`px-4 py-2 rounded-xl text-sm font-700 transition-all ${
            inCart ? 'bg-secondary/10 text-secondary border border-secondary/30' : 'btn-primary'}`
            }>
            
            {inCart ? '✓ Ajouté' : 'Acheter'}
          </button>
        </div>
      </div>
    </div>);

}

export default function CreateursPage() {
  const [activeTab, setActiveTab] = useState<'produits' | 'créateurs' | 'devenir'>('produits');
  const [typeFilter, setTypeFilter] = useState<'all' | 'itinéraire' | 'gps' | 'preset' | 'formation' | 'pack'>('all');

  const filteredProducts = PRODUCTS.filter((p) => typeFilter === 'all' || p.type === typeFilter);

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="pt-16 lg:pt-18">
        {/* Hero */}
        <section className="bg-dark-bg text-white py-14 px-4 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-secondary blur-3xl" />
          </div>
          <div className="max-w-7xl mx-auto relative">
            <div className="flex items-center gap-2 mb-4">
              <span className="tag-badge bg-secondary/30 text-emerald-300 border border-emerald-500/30 text-[10px]">COMMUNAUTÉ</span>
              <span className="text-white/50 text-xs font-mono-data">ESPACE CRÉATEURS</span>
            </div>
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
              <div>
                <h1 className="text-section-title text-white mb-3">
                  Guides, photographes<br />
                  <span className="text-primary">et créateurs vérifiés</span>
                </h1>
                <p className="text-white/60 text-base max-w-xl">
                  Itinéraires détaillés, packs GPS, presets photo, formations — vendus par des créateurs vérifiés (Trust Score + identité). Commission plateforme uniquement, pas d&apos;abonnement séparé.
                </p>
              </div>
              <div className="flex flex-col gap-2 text-right">
                <div className="flex items-center gap-4 text-white/60 text-xs">
                  <span>Commission : <strong className="text-white">15%</strong></span>
                  <span>Créateurs vérifiés : <strong className="text-white">47</strong></span>
                  <span>Produits : <strong className="text-white">312</strong></span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Tabs */}
        <section className="sticky top-16 z-30 bg-background/95 backdrop-blur-md border-b border-border">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex gap-0">
              {[
              { id: 'produits', label: 'Catalogue', icon: 'ArchiveBoxIcon' },
              { id: 'créateurs', label: 'Créateurs', icon: 'UserGroupIcon' },
              { id: 'devenir', label: 'Devenir créateur', icon: 'SparklesIcon' }].
              map((tab) =>
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-5 py-4 text-sm font-600 border-b-2 transition-all ${
                activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`
                }>
                
                  <Icon name={tab.icon} size={15} />
                  {tab.label}
                </button>
              )}
            </div>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 py-10">
          {activeTab === 'produits' &&
          <div>
              {/* Type filters */}
              <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
                {[
              { id: 'all', label: 'Tout' },
              { id: 'itinéraire', label: '🗺️ Itinéraires' },
              { id: 'gps', label: '📍 Packs GPS' },
              { id: 'preset', label: '📷 Presets photo' },
              { id: 'formation', label: '🎓 Formations' },
              { id: 'pack', label: '📦 Packs complets' }].
              map((f) =>
              <button
                key={f.id}
                onClick={() => setTypeFilter(f.id as typeof typeFilter)}
                className={`category-pill flex-shrink-0 ${typeFilter === f.id ? 'active' : ''}`}>
                
                    {f.label}
                  </button>
              )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredProducts.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
            </div>
          }

          {activeTab === 'créateurs' &&
          <div>
              <h2 className="font-display font-700 text-foreground text-xl mb-6">Créateurs vérifiés</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {CREATORS.map((creator) =>
              <div key={creator.id} className="topo-card p-5">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-14 h-14 rounded-2xl bg-secondary text-white flex items-center justify-center text-lg font-700 flex-shrink-0">
                        {creator.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-display font-700 text-foreground text-base">{creator.name}</h3>
                          {creator.verified &&
                      <span className="flex items-center gap-0.5 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full font-700">
                              <Icon name="CheckBadgeIcon" size={10} />
                              Vérifié
                            </span>
                      }
                        </div>
                        <p className="text-xs text-muted-foreground capitalize">{creator.type} · {creator.location}</p>
                      </div>
                      <TrustRing score={creator.trustScore} size={44} />
                    </div>

                    {creator.linkedClub &&
                <div className="flex items-center gap-1.5 mb-3 text-xs text-secondary font-600">
                        <Icon name="UserGroupIcon" size={12} />
                        Guide officiel : {creator.linkedClub}
                      </div>
                }

                    <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{creator.bio}</p>

                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {[
                  { value: creator.sales, label: 'Ventes' },
                  { value: creator.rating, label: 'Note' },
                  { value: creator.reviewCount, label: 'Avis' }].
                  map((s) =>
                  <div key={s.label} className="bg-background rounded-xl p-2 text-center border border-border">
                          <p className="font-display font-700 text-foreground text-sm">{s.value}</p>
                          <p className="text-[10px] text-muted-foreground">{s.label}</p>
                        </div>
                  )}
                    </div>

                    <button className="w-full btn-secondary py-2 text-sm justify-center">
                      Voir tous ses produits
                    </button>
                  </div>
              )}
              </div>
            </div>
          }

          {activeTab === 'devenir' &&
          <div className="max-w-2xl mx-auto">
              <div className="topo-card p-8">
                <h2 className="font-display font-700 text-foreground text-2xl mb-2">Devenir créateur</h2>
                <p className="text-muted-foreground mb-8">Vendez vos itinéraires, packs GPS, presets ou formations. Commission de 15% uniquement sur les ventes — pas d&apos;abonnement.</p>

                <div className="space-y-4 mb-8">
                  {[
                { step: '1', title: 'Vérification identité', desc: 'Pièce d\'identité + vérification Trust Score (minimum 60 pts)', icon: 'IdentificationIcon' },
                { step: '2', title: 'Profil créateur', desc: 'Bio, spécialités, lien vers un club si applicable', icon: 'UserCircleIcon' },
                { step: '3', title: 'Premier produit', desc: 'Soumission pour validation par l\'équipe (48h)', icon: 'DocumentCheckIcon' },
                { step: '4', title: 'Publication & ventes', desc: '15% de commission sur chaque vente, paiement mensuel', icon: 'BanknotesIcon' }].
                map((s) =>
                <div key={s.step} className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-700 flex-shrink-0">
                        {s.step}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Icon name={s.icon} size={14} className="text-primary" />
                          <h3 className="font-700 text-foreground text-sm">{s.title}</h3>
                        </div>
                        <p className="text-xs text-muted-foreground">{s.desc}</p>
                      </div>
                    </div>
                )}
                </div>

                <div className="bg-secondary/5 border border-secondary/20 rounded-xl p-4 mb-6">
                  <h3 className="font-700 text-foreground text-sm mb-2 flex items-center gap-2">
                    <Icon name="ShieldCheckIcon" size={14} className="text-secondary" />
                    Conditions de vérification
                  </h3>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    <li className="flex items-center gap-2"><span className="text-secondary">›</span> Trust Score minimum : 60 pts</li>
                    <li className="flex items-center gap-2"><span className="text-secondary">›</span> Identité vérifiée (pièce d&apos;identité)</li>
                    <li className="flex items-center gap-2"><span className="text-secondary">›</span> Au moins 1 carnet de voyage publié</li>
                    <li className="flex items-center gap-2"><span className="text-secondary">›</span> Contenu original et vérifié terrain</li>
                  </ul>
                </div>

                <button className="btn-primary w-full justify-center py-3">
                  <Icon name="SparklesIcon" size={16} />
                  Soumettre ma candidature
                </button>
              </div>
            </div>
          }
        </div>
      </div>
      <Footer />
    </main>);

}