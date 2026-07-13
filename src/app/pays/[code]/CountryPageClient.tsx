'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import WeightGauge from '@/components/WeightGauge';
import TopoSeparator from '@/components/TopoSeparator';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';
import type { CountryAIData } from '@/app/api/pays/[code]/route';

const statusColors = { good: 'bg-green-500', medium: 'bg-amber-400', bad: 'bg-red-500' };
const statusBg = { good: 'bg-green-500/10 border-green-500/20', medium: 'bg-amber-400/10 border-amber-400/20', bad: 'bg-red-500/10 border-red-500/20' };
const statusLabels = { good: 'Idéal', medium: 'Moyen', bad: 'Déconseillé' };
const statusText = { good: 'text-green-400', medium: 'text-amber-400', bad: 'text-red-400' };
const dangerLevelColors = { low: 'text-green-400', medium: 'text-amber-400', high: 'text-red-400' };
const dangerLevelBg = { low: 'bg-green-500/10 border-green-500/20', medium: 'bg-amber-400/10 border-amber-400/20', high: 'bg-red-500/10 border-red-500/20' };
const dangerLevelLabels = { low: 'Faible', medium: 'Modéré', high: 'Élevé' };

function getFlagEmoji(code: string): string {
  const codePoints = code.toUpperCase().split('').map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function DangerBar({ level }: { level: number }) {
  return (
    <div className="flex gap-1" aria-label={`Niveau de danger : ${level}/10`} role="meter" aria-valuenow={level} aria-valuemin={0} aria-valuemax={10}>
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className={`h-2 flex-1 rounded-full transition-colors ${
            i < level
              ? level <= 3 ? 'bg-green-500' : level <= 6 ? 'bg-amber-400' : 'bg-red-500' :'bg-white/10'
          }`}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

function SkeletonCountry() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex gap-6">
        <div className="w-20 h-20 bg-white/5 rounded-2xl" />
        <div className="flex-1 space-y-3">
          <div className="h-4 bg-white/5 rounded w-24" />
          <div className="h-8 bg-white/5 rounded w-48" />
          <div className="h-4 bg-white/5 rounded w-64" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 bg-white/5 rounded-xl" />)}
      </div>
      <div className="h-12 bg-white/5 rounded-xl" />
    </div>
  );
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

// Destination ideas per country code
const DESTINATION_IDEAS: Record<string, { name: string; type: string; duration: string; difficulty: 'Facile' | 'Intermédiaire' | 'Expert'; description: string; bestSeason: string; emoji: string }[]> = {
  // ── EUROPE ──
  no: [
    { name: 'Trolltunga', type: 'Randonnée', duration: '1–2 jours', difficulty: 'Intermédiaire', description: 'La langue de troll, rocher suspendu à 700m au-dessus du lac Ringedalsvatnet. L\'une des randonnées les plus spectaculaires de Norvège.', bestSeason: 'Jun–Sep', emoji: '🪨' },
    { name: 'Preikestolen', type: 'Randonnée', duration: '1 jour', difficulty: 'Facile', description: 'La chaire de prédicateur, falaise à 604m au-dessus du Lysefjord. Vue panoramique exceptionnelle sur les fjords.', bestSeason: 'Avr–Oct', emoji: '⛰️' },
    { name: 'Lofoten — Traversée', type: 'Trekking', duration: '5–7 jours', difficulty: 'Intermédiaire', description: 'Archipel arctique avec pics dramatiques, villages de pêcheurs et plages de sable blanc. Randonnées et kayak.', bestSeason: 'Jun–Sep', emoji: '🏔️' },
    { name: 'Jotunheimen — Besseggen', type: 'Randonnée', duration: '1 jour', difficulty: 'Intermédiaire', description: 'La crête de Besseggen entre deux lacs de couleurs différentes. Considérée comme la plus belle randonnée de Norvège.', bestSeason: 'Jul–Sep', emoji: '🌊' },
    { name: 'Aurores boréales — Tromsø', type: 'Observation', duration: '3–5 jours', difficulty: 'Facile', description: 'Capitale mondiale des aurores boréales. Chasse aux aurores en traîneau à chiens ou en bateau.', bestSeason: 'Oct–Mar', emoji: '✨' },
  ],
  se: [
    { name: 'Kungsleden — Abisko à Kebnekaise', type: 'Trekking', duration: '5–7 jours', difficulty: 'Intermédiaire', description: 'Le sentier royal de Laponie suédoise. Paysages arctiques, lacs et montagnes au-dessus du cercle polaire.', bestSeason: 'Jul–Sep', emoji: '🏔️' },
    { name: 'Sarek National Park', type: 'Trekking', duration: '7–14 jours', difficulty: 'Expert', description: 'L\'un des derniers espaces sauvages d\'Europe. Aucun sentier balisé, glaciers et rivières à traverser.', bestSeason: 'Jul–Août', emoji: '🌿' },
    { name: 'Gotland — Côte et Falaises', type: 'Randonnée', duration: '3–5 jours', difficulty: 'Facile', description: 'Île baltique avec falaises calcaires, plages et villages médiévaux. Parfait pour le vélo et la randonnée côtière.', bestSeason: 'Mai–Sep', emoji: '🏖️' },
    { name: 'Stockholm Archipelago — Kayak', type: 'Aventure', duration: '3–5 jours', difficulty: 'Facile', description: '30 000 îles et îlots autour de Stockholm. Kayak entre les îles, baignade et nuits en plein air.', bestSeason: 'Jun–Août', emoji: '🚣' },
  ],
  ch: [
    { name: 'Tour du Mont Rose', type: 'Trekking', duration: '7–10 jours', difficulty: 'Expert', description: 'Tour du massif du Mont Rose entre Suisse et Italie. Glaciers, refuges d\'altitude et vues panoramiques.', bestSeason: 'Jul–Sep', emoji: '🏔️' },
    { name: 'Via Alpina — Section Suisse', type: 'Randonnée', duration: '10–14 jours', difficulty: 'Intermédiaire', description: 'Traversée de la Suisse de Vaduz à Montreux. Paysages alpins variés, lacs et villages pittoresques.', bestSeason: 'Jun–Sep', emoji: '🌄' },
    { name: 'Eiger Trail', type: 'Randonnée', duration: '1 jour', difficulty: 'Intermédiaire', description: 'Sentier au pied de la face nord de l\'Eiger. Vue imprenable sur la paroi mythique et la Jungfrau.', bestSeason: 'Jun–Oct', emoji: '⛰️' },
    { name: 'Haute Route Chamonix-Zermatt', type: 'Trekking', duration: '10–12 jours', difficulty: 'Expert', description: 'Traversée des Alpes entre les deux capitales de l\'alpinisme. Glaciers, cols et panoramas exceptionnels.', bestSeason: 'Jul–Sep', emoji: '🗻' },
  ],
  at: [
    { name: 'Grossglockner — Ascension', type: 'Alpinisme', duration: '2–3 jours', difficulty: 'Expert', description: 'Plus haut sommet d\'Autriche à 3798m. Ascension depuis le refuge Erzherzog-Johann, vues sur les Alpes.', bestSeason: 'Jul–Sep', emoji: '🏔️' },
    { name: 'Wilder Kaiser — Tour', type: 'Randonnée', duration: '3–4 jours', difficulty: 'Intermédiaire', description: 'Tour du massif du Wilder Kaiser dans le Tyrol. Falaises calcaires spectaculaires et alpages fleuris.', bestSeason: 'Jun–Oct', emoji: '⛰️' },
    { name: 'Salzkammergut — Lacs', type: 'Randonnée', duration: '3–5 jours', difficulty: 'Facile', description: 'Région des lacs autrichiens avec Hallstatt. Randonnées entre lacs turquoise et montagnes calcaires.', bestSeason: 'Mai–Oct', emoji: '🏞️' },
  ],
  de: [
    { name: 'Zugspitze — Ascension', type: 'Alpinisme', duration: '1–2 jours', difficulty: 'Expert', description: 'Plus haut sommet d\'Allemagne à 2962m. Ascension depuis Garmisch-Partenkirchen, vue sur 400 sommets.', bestSeason: 'Jun–Oct', emoji: '🏔️' },
    { name: 'Berchtesgaden — Königssee', type: 'Randonnée', duration: '2–3 jours', difficulty: 'Facile', description: 'Parc national bavarois avec le lac Königssee aux eaux émeraude. Randonnées et cascades spectaculaires.', bestSeason: 'Mai–Oct', emoji: '🏞️' },
    { name: 'Schwarzwald — Westweg', type: 'Randonnée', duration: '5–7 jours', difficulty: 'Intermédiaire', description: 'Traversée de la Forêt Noire du nord au sud. 285km de sentiers entre forêts de sapins et villages typiques.', bestSeason: 'Avr–Oct', emoji: '🌲' },
  ],
  it: [
    { name: 'Dolomites — Alta Via 1', type: 'Trekking', duration: '7–10 jours', difficulty: 'Intermédiaire', description: 'Traversée des Dolomites de Braies à Belluno. Paysages de calcaire rose, refuges et via ferrata.', bestSeason: 'Jul–Sep', emoji: '🏔️' },
    { name: 'Cinque Terre — Sentiero Azzurro', type: 'Randonnée', duration: '1–2 jours', difficulty: 'Facile', description: 'Sentier côtier entre les cinq villages colorés des Cinque Terre. Vues sur la Méditerranée.', bestSeason: 'Avr–Oct', emoji: '🌊' },
    { name: 'Gran Paradiso — Ascension', type: 'Alpinisme', duration: '2–3 jours', difficulty: 'Expert', description: 'Seul 4000m entièrement en Italie. Ascension depuis Cogne, glacier et vue sur le Mont Blanc.', bestSeason: 'Jun–Sep', emoji: '⛰️' },
    { name: 'Sicile — Etna', type: 'Randonnée', duration: '1–2 jours', difficulty: 'Intermédiaire', description: 'Ascension du plus grand volcan actif d\'Europe à 3357m. Paysages lunaires et vues sur la Méditerranée.', bestSeason: 'Avr–Nov', emoji: '🌋' },
  ],
  es: [
    { name: 'Camino de Santiago — Voie Française', type: 'Pèlerinage', duration: '30–35 jours', difficulty: 'Intermédiaire', description: 'Le pèlerinage le plus célèbre du monde. 780km de Saint-Jean-Pied-de-Port à Santiago de Compostela.', bestSeason: 'Avr–Oct', emoji: '⛪' },
    { name: 'Picos de Europa', type: 'Randonnée', duration: '4–6 jours', difficulty: 'Intermédiaire', description: 'Massif calcaire spectaculaire des Asturies. Gorges du Cares, refuges et faune sauvage abondante.', bestSeason: 'Jun–Sep', emoji: '🏔️' },
    { name: 'Teide — Ascension', type: 'Randonnée', duration: '1–2 jours', difficulty: 'Intermédiaire', description: 'Plus haut sommet d\'Espagne à 3718m sur Tenerife. Paysages volcaniques et vue sur les îles Canaries.', bestSeason: 'Toute l\'année', emoji: '🌋' },
    { name: 'Pyrénées — GR11', type: 'Trekking', duration: '40–45 jours', difficulty: 'Expert', description: 'Traversée intégrale des Pyrénées côté espagnol. Variante du GR10 avec moins de fréquentation.', bestSeason: 'Jul–Sep', emoji: '🌄' },
  ],
  pt: [
    { name: 'Rota Vicentina — Fishermen\'s Trail', type: 'Randonnée', duration: '7–10 jours', difficulty: 'Facile', description: 'Sentier côtier sauvage de l\'Alentejo à l\'Algarve. Falaises, plages isolées et villages de pêcheurs.', bestSeason: 'Mar–Jun, Sep–Nov', emoji: '🌊' },
    { name: 'Serra da Estrela', type: 'Randonnée', duration: '2–3 jours', difficulty: 'Intermédiaire', description: 'Plus haut massif du Portugal continental. Randonnées entre lacs glaciaires et villages de montagne.', bestSeason: 'Mai–Oct', emoji: '🏔️' },
    { name: 'Açores — São Miguel', type: 'Aventure', duration: '4–6 jours', difficulty: 'Facile', description: 'Île volcanique avec lacs de cratère, sources chaudes et forêts tropicales. Randonnées et whale watching.', bestSeason: 'Avr–Oct', emoji: '🌋' },
  ],
  gr: [
    { name: 'Mont Olympe — Ascension', type: 'Randonnée', duration: '2–3 jours', difficulty: 'Intermédiaire', description: 'Demeure des dieux grecs, plus haut sommet de Grèce à 2917m. Ascension depuis Litochoro.', bestSeason: 'Jun–Oct', emoji: '⛰️' },
    { name: 'Samaria Gorge — Crète', type: 'Randonnée', duration: '1 jour', difficulty: 'Intermédiaire', description: 'Plus longue gorge d\'Europe (18km). Descente spectaculaire entre falaises de 300m jusqu\'à la mer.', bestSeason: 'Mai–Oct', emoji: '🏞️' },
    { name: 'Météores — Sentiers monastiques', type: 'Randonnée', duration: '1–2 jours', difficulty: 'Facile', description: 'Monastères perchés sur des pitons rocheux. Randonnées entre les formations géologiques uniques.', bestSeason: 'Avr–Oct', emoji: '🏛️' },
  ],
  // ── ASIE ──
  th: [
    { name: 'Doi Inthanon — Sommet', type: 'Randonnée', duration: '1–2 jours', difficulty: 'Facile', description: 'Plus haut sommet de Thaïlande à 2565m. Forêts de nuages, cascades et villages des tribus des collines.', bestSeason: 'Nov–Fév', emoji: '🌿' },
    { name: 'Chiang Rai — Treks ethniques', type: 'Trekking', duration: '3–5 jours', difficulty: 'Intermédiaire', description: 'Randonnées dans les montagnes du Triangle d\'Or. Rencontre avec les tribus Karen, Akha et Hmong.', bestSeason: 'Nov–Mar', emoji: '🏔️' },
    { name: 'Kanchanaburi — Rivière Kwai', type: 'Aventure', duration: '2–3 jours', difficulty: 'Facile', description: 'Jungle dense, cascades et histoire de la Seconde Guerre mondiale. Rafting et randonnées.', bestSeason: 'Nov–Avr', emoji: '🌊' },
  ],
  vn: [
    { name: 'Fansipan — Toit de l\'Indochine', type: 'Trekking', duration: '2–3 jours', difficulty: 'Intermédiaire', description: 'Plus haut sommet d\'Indochine à 3143m. Trek depuis Sapa à travers forêts de bambous et rizières en terrasses.', bestSeason: 'Mar–Mai, Sep–Nov', emoji: '🏔️' },
    { name: 'Sapa — Rizières en terrasses', type: 'Randonnée', duration: '2–4 jours', difficulty: 'Facile', description: 'Randonnées dans les rizières en terrasses de la vallée de Muong Hoa. Villages des minorités ethniques.', bestSeason: 'Sep–Nov, Mar–Mai', emoji: '🌾' },
    { name: 'Phong Nha — Grottes', type: 'Aventure', duration: '2–3 jours', difficulty: 'Intermédiaire', description: 'Plus grande grotte du monde (Hang Son Doong). Jungle, rivières souterraines et formations calcaires.', bestSeason: 'Fév–Août', emoji: '🦇' },
  ],
  id: [
    { name: 'Rinjani — Ascension', type: 'Trekking', duration: '3–4 jours', difficulty: 'Expert', description: 'Volcan sacré de Lombok à 3726m. Ascension jusqu\'au cratère avec lac de caldeira turquoise.', bestSeason: 'Avr–Nov', emoji: '🌋' },
    { name: 'Bromo — Lever de soleil', type: 'Randonnée', duration: '1–2 jours', difficulty: 'Facile', description: 'Lever de soleil sur le volcan Bromo depuis le Penanjakan. Mer de sable et paysages lunaires.', bestSeason: 'Avr–Oct', emoji: '🌅' },
    { name: 'Komodo — Randonnée', type: 'Aventure', duration: '2–3 jours', difficulty: 'Facile', description: 'Île des dragons de Komodo. Randonnées pour observer les varans géants et plongée dans les eaux cristallines.', bestSeason: 'Avr–Déc', emoji: '🦎' },
  ],
  cn: [
    { name: 'Grande Muraille — Section Jiankou', type: 'Randonnée', duration: '1–2 jours', difficulty: 'Expert', description: 'Section sauvage et non restaurée de la Grande Muraille. Randonnée sportive avec vues spectaculaires.', bestSeason: 'Avr–Jun, Sep–Nov', emoji: '🏯' },
    { name: 'Huangshan — Monts Jaunes', type: 'Randonnée', duration: '2–3 jours', difficulty: 'Intermédiaire', description: 'Montagnes mythiques avec pins tordus, mers de nuages et rochers granitiques. Inspiration de la peinture chinoise.', bestSeason: 'Avr–Nov', emoji: '🌄' },
    { name: 'Tiger Leaping Gorge', type: 'Trekking', duration: '2 jours', difficulty: 'Intermédiaire', description: 'L\'une des gorges les plus profondes du monde dans le Yunnan. Trek entre le Yangtsé et les montagnes enneigées.', bestSeason: 'Avr–Jun, Sep–Nov', emoji: '🏞️' },
  ],
  // ── AFRIQUE ──
  ke: [
    { name: 'Mont Kenya — Ascension', type: 'Alpinisme', duration: '5–7 jours', difficulty: 'Expert', description: 'Deuxième plus haut sommet d\'Afrique à 5199m. Ascension par la route Sirimon ou Chogoria.', bestSeason: 'Jan–Mar, Jul–Oct', emoji: '🏔️' },
    { name: 'Masai Mara — Safari', type: 'Safari', duration: '3–5 jours', difficulty: 'Facile', description: 'Grande migration des gnous de juillet à octobre. Lions, guépards et éléphants dans la savane.', bestSeason: 'Jul–Oct', emoji: '🦁' },
    { name: 'Lewa Conservancy — Randonnée', type: 'Randonnée', duration: '2–3 jours', difficulty: 'Intermédiaire', description: 'Randonnée à pied dans la réserve avec rhinocéros et éléphants. Expérience unique en Afrique.', bestSeason: 'Jun–Oct', emoji: '🦏' },
  ],
  et: [
    { name: 'Simien Mountains — Trek', type: 'Trekking', duration: '5–7 jours', difficulty: 'Intermédiaire', description: 'Trekking dans les montagnes du Simien, patrimoine UNESCO. Géladas, loups d\'Éthiopie et paysages époustouflants.', bestSeason: 'Oct–Mar', emoji: '🏔️' },
    { name: 'Danakil Depression', type: 'Aventure', duration: '3–4 jours', difficulty: 'Expert', description: 'L\'un des endroits les plus chauds et inhospitaliers de la Terre. Volcans actifs, lacs de sel et sources acides.', bestSeason: 'Nov–Mar', emoji: '🌋' },
    { name: 'Lalibela — Randonnée', type: 'Culturel', duration: '2–3 jours', difficulty: 'Facile', description: 'Randonnées entre les églises rupestres médiévales de Lalibela. Pèlerinage et paysages des hauts plateaux.', bestSeason: 'Oct–Mar', emoji: '⛪' },
  ],
  za: [
    { name: 'Drakensberg — Amphitheatre', type: 'Randonnée', duration: '2–3 jours', difficulty: 'Intermédiaire', description: 'L\'Amphithéâtre, falaise de 5km de long et 1200m de haut. Randonnée jusqu\'aux Tugela Falls, 2ème plus haute chute du monde.', bestSeason: 'Avr–Sep', emoji: '🏔️' },
    { name: 'Table Mountain — Ascension', type: 'Randonnée', duration: '1 jour', difficulty: 'Intermédiaire', description: 'Ascension de la montagne emblématique du Cap. Vue à 360° sur l\'océan et la péninsule du Cap.', bestSeason: 'Oct–Avr', emoji: '⛰️' },
    { name: 'Kruger National Park', type: 'Safari', duration: '4–7 jours', difficulty: 'Facile', description: 'L\'un des plus grands parcs d\'Afrique. Big Five, oiseaux et paysages de savane africaine.', bestSeason: 'Mai–Sep', emoji: '🦒' },
  ],
  // ── AMÉRIQUES ──
  br: [
    { name: 'Chapada Diamantina — Trek', type: 'Trekking', duration: '5–7 jours', difficulty: 'Intermédiaire', description: 'Plateau du Brésil avec cascades, grottes et formations rocheuses spectaculaires. Randonnées sauvages.', bestSeason: 'Jun–Sep', emoji: '🌊' },
    { name: 'Amazonie — Manaus', type: 'Aventure', duration: '4–7 jours', difficulty: 'Facile', description: 'Immersion dans la forêt amazonienne. Pirogue, observation de la faune et nuits en lodge.', bestSeason: 'Jun–Nov', emoji: '🌿' },
    { name: 'Pantanal — Safari', type: 'Safari', duration: '4–6 jours', difficulty: 'Facile', description: 'Plus grande zone humide du monde. Jaguars, caïmans, capybaras et oiseaux tropicaux en abondance.', bestSeason: 'Jul–Oct', emoji: '🐆' },
    { name: 'Lençóis Maranhenses', type: 'Aventure', duration: '2–3 jours', difficulty: 'Facile', description: 'Désert de dunes blanches avec lagunes d\'eau douce turquoise. Randonnée unique entre les dunes.', bestSeason: 'Jun–Sep', emoji: '🏜️' },
  ],
  ar: [
    { name: 'Aconcagua — Ascension', type: 'Alpinisme', duration: '18–21 jours', difficulty: 'Expert', description: 'Plus haut sommet des Amériques à 6961m. Ascension par la voie normale depuis Mendoza.', bestSeason: 'Déc–Mar', emoji: '🏔️' },
    { name: 'Patagonie Argentine — Fitz Roy', type: 'Trekking', duration: '5–7 jours', difficulty: 'Intermédiaire', description: 'Trek autour du Fitz Roy et Cerro Torre dans le parc Los Glaciares. Paysages de Patagonie sauvage.', bestSeason: 'Nov–Mar', emoji: '⛰️' },
    { name: 'Quebrada de Humahuaca', type: 'Randonnée', duration: '3–5 jours', difficulty: 'Facile', description: 'Vallée andine aux couleurs arc-en-ciel dans le Jujuy. Randonnées entre villages coloniaux et paysages lunaires.', bestSeason: 'Avr–Nov', emoji: '🌈' },
  ],
  mx: [
    { name: 'Pico de Orizaba — Ascension', type: 'Alpinisme', duration: '3–4 jours', difficulty: 'Expert', description: 'Plus haut sommet du Mexique à 5636m. Ascension glaciaire depuis Tlachichuca.', bestSeason: 'Nov–Mar', emoji: '🌋' },
    { name: 'Copper Canyon — Trek', type: 'Trekking', duration: '4–6 jours', difficulty: 'Intermédiaire', description: 'Réseau de canyons plus grand que le Grand Canyon. Trek avec les Tarahumaras et train El Chepe.', bestSeason: 'Oct–Avr', emoji: '🏜️' },
    { name: 'Oaxaca — Sierra Norte', type: 'Randonnée', duration: '3–5 jours', difficulty: 'Facile', description: 'Randonnées dans les montagnes zapotèques. Villages indigènes, forêts de nuages et biodiversité exceptionnelle.', bestSeason: 'Oct–Mai', emoji: '🌿' },
  ],
  co: [
    { name: 'Ciudad Perdida — Trek', type: 'Trekking', duration: '4–6 jours', difficulty: 'Intermédiaire', description: 'Cité perdue de la Sierra Nevada de Santa Marta. Trek dans la jungle jusqu\'aux ruines tayrona.', bestSeason: 'Déc–Mar, Jul–Sep', emoji: '🏛️' },
    { name: 'Cocora Valley — Palmiers de cire', type: 'Randonnée', duration: '1–2 jours', difficulty: 'Facile', description: 'Vallée des palmiers de cire, arbre national de Colombie. Randonnée dans les nuages et forêts tropicales.', bestSeason: 'Déc–Mar, Jun–Sep', emoji: '🌴' },
    { name: 'PNN Los Nevados', type: 'Alpinisme', duration: '3–5 jours', difficulty: 'Expert', description: 'Parc des volcans enneigés. Ascension du Nevado del Ruiz à 5321m et randonnées en altitude.', bestSeason: 'Déc–Mar', emoji: '🏔️' },
  ],
  // ── OCÉANIE ──
  au: [
    { name: 'Overland Track — Tasmanie', type: 'Trekking', duration: '6–8 jours', difficulty: 'Intermédiaire', description: 'Trek emblématique de Tasmanie entre Cradle Mountain et Lake St Clair. Paysages sauvages et faune unique.', bestSeason: 'Nov–Avr', emoji: '🌿' },
    { name: 'Larapinta Trail', type: 'Trekking', duration: '12–16 jours', difficulty: 'Expert', description: 'Traversée du désert australien dans le Territoire du Nord. Gorges rouges, montagnes et ciel étoilé.', bestSeason: 'Avr–Sep', emoji: '🏜️' },
    { name: 'Great Ocean Walk', type: 'Randonnée', duration: '6–8 jours', difficulty: 'Intermédiaire', description: 'Randonnée côtière de 104km le long de la Great Ocean Road. Falaises, plages et forêts de Victoria.', bestSeason: 'Sep–Mai', emoji: '🌊' },
    { name: 'Blue Mountains — Randonnée', type: 'Randonnée', duration: '2–3 jours', difficulty: 'Facile', description: 'Canyons et forêts d\'eucalyptus près de Sydney. Les Trois Sœurs et sentiers panoramiques.', bestSeason: 'Sep–Nov, Mar–Mai', emoji: '🏞️' },
  ],
  // ── MOYEN-ORIENT ──
  jo: [
    { name: 'Petra — Randonnée', type: 'Randonnée', duration: '2–3 jours', difficulty: 'Facile', description: 'Cité rose des Nabatéens, patrimoine UNESCO. Randonnées dans les canyons et jusqu\'au Monastère.', bestSeason: 'Mar–Mai, Sep–Nov', emoji: '🏛️' },
    { name: 'Wadi Rum — Trek', type: 'Trekking', duration: '2–3 jours', difficulty: 'Facile', description: 'Désert de grès rouge avec formations rocheuses spectaculaires. Bivouac sous les étoiles avec les Bédouins.', bestSeason: 'Mar–Mai, Sep–Nov', emoji: '🏜️' },
    { name: 'Jordan Trail — Section Dana', type: 'Trekking', duration: '3–5 jours', difficulty: 'Intermédiaire', description: 'Traversée de la réserve de Dana jusqu\'à Petra. Paysages variés entre forêts, canyons et désert.', bestSeason: 'Mar–Mai, Sep–Nov', emoji: '🌄' },
  ],
  // ── ASIE CENTRALE ──
  kg: [
    { name: 'Song Kul — Randonnée à cheval', type: 'Aventure', duration: '3–5 jours', difficulty: 'Facile', description: 'Lac d\'altitude à 3016m entouré de steppes. Randonnée à cheval avec les nomades kirghizes et nuits en yourte.', bestSeason: 'Jun–Sep', emoji: '🐎' },
    { name: 'Tian Shan — Pic Lénine', type: 'Alpinisme', duration: '14–21 jours', difficulty: 'Expert', description: 'Ascension du Pic Lénine à 7134m. L\'un des 7000m les plus accessibles au monde.', bestSeason: 'Jul–Août', emoji: '🏔️' },
    { name: 'Ala Archa — Randonnée', type: 'Randonnée', duration: '2–3 jours', difficulty: 'Intermédiaire', description: 'Parc national près de Bichkek. Glaciers, cascades et sommets de 4000m accessibles depuis la capitale.', bestSeason: 'Jun–Sep', emoji: '⛰️' },
  ],

  np: [
    { name: 'Circuit des Annapurnas', type: 'Trekking', duration: '15–21 jours', difficulty: 'Intermédiaire', description: 'Le tour complet des Annapurnas, l\'un des plus beaux circuits de trekking au monde. Passe le col de Thorong La à 5416m.', bestSeason: 'Oct–Nov, Mar–Avr', emoji: '🏔️' },
    { name: 'Everest Base Camp', type: 'Trekking', duration: '12–16 jours', difficulty: 'Intermédiaire', description: 'Trek mythique jusqu\'au camp de base de l\'Everest à 5364m. Vues spectaculaires sur les plus hauts sommets du monde.', bestSeason: 'Oct–Nov, Mar–Mai', emoji: '⛰️' },
    { name: 'Langtang Valley', type: 'Trekking', duration: '7–10 jours', difficulty: 'Facile', description: 'Vallée sauvage proche de Katmandou, moins fréquentée. Paysages de forêts de rhododendrons et glaciers.', bestSeason: 'Oct–Nov, Mar–Mai', emoji: '🌿' },
    { name: 'Manaslu Circuit', type: 'Trekking', duration: '14–18 jours', difficulty: 'Expert', description: 'Circuit autour du 8ème plus haut sommet du monde. Zone restreinte, ambiance sauvage et authentique.', bestSeason: 'Sep–Nov', emoji: '🗻' },
    { name: 'Pokhara & Phewa Lake', type: 'Détente', duration: '3–5 jours', difficulty: 'Facile', description: 'Ville de départ des grands treks, lac de Phewa avec vue sur les Annapurnas. Parfait pour récupérer.', bestSeason: 'Toute l\'année', emoji: '🏞️' },
  ],
  fr: [
    { name: 'Tour du Mont Blanc', type: 'Randonnée', duration: '10–12 jours', difficulty: 'Intermédiaire', description: 'Tour complet du massif du Mont Blanc à travers France, Italie et Suisse. 170km et 10 000m de dénivelé.', bestSeason: 'Jul–Sep', emoji: '🏔️' },
    { name: 'GR20 — Corse', type: 'Randonnée', duration: '14–16 jours', difficulty: 'Expert', description: 'Considéré comme le plus beau et difficile sentier d\'Europe. 180km de crêtes sauvages en Corse.', bestSeason: 'Jun–Sep', emoji: '⛰️' },
    { name: 'Gorges du Verdon', type: 'Randonnée', duration: '2–4 jours', difficulty: 'Facile', description: 'Le Grand Canyon européen. Randonnée au bord des gorges avec eaux turquoise et falaises vertigineuses.', bestSeason: 'Avr–Oct', emoji: '🏞️' },
    { name: 'Chamonix & Aiguilles Rouges', type: 'Alpinisme', duration: '5–7 jours', difficulty: 'Expert', description: 'Capitale mondiale de l\'alpinisme. Accès aux plus belles voies des Alpes françaises.', bestSeason: 'Jul–Sep', emoji: '🧗' },
    { name: 'Pyrénées — GR10', type: 'Randonnée', duration: '45–50 jours', difficulty: 'Expert', description: 'Traversée intégrale des Pyrénées de l\'Atlantique à la Méditerranée. 866km de sentiers sauvages.', bestSeason: 'Jul–Sep', emoji: '🌄' },
  ],
  is: [
    { name: 'Laugavegur Trail', type: 'Trekking', duration: '4–5 jours', difficulty: 'Intermédiaire', description: 'Le trek le plus célèbre d\'Islande. Paysages lunaires entre volcans, sources chaudes et glaciers.', bestSeason: 'Jul–Août', emoji: '🌋' },
    { name: 'Fimmvörðuháls', type: 'Randonnée', duration: '1–2 jours', difficulty: 'Intermédiaire', description: 'Traversée entre deux glaciers avec vue sur les champs de lave du volcan Eyjafjallajökull.', bestSeason: 'Jun–Sep', emoji: '🔥' },
    { name: 'Snæfellsnes Peninsula', type: 'Road trip', duration: '3–4 jours', difficulty: 'Facile', description: 'Péninsule magique avec glacier, plages noires, falaises et villages de pêcheurs. Décor de Jules Verne.', bestSeason: 'Mai–Sep', emoji: '🌊' },
    { name: 'Highlands — Landmannalaugar', type: 'Trekking', duration: '2–3 jours', difficulty: 'Intermédiaire', description: 'Montagnes aux couleurs arc-en-ciel, sources géothermiques naturelles et paysages martiens.', bestSeason: 'Jul–Août', emoji: '🌈' },
    { name: 'Aurores boréales — Nord', type: 'Observation', duration: '3–5 jours', difficulty: 'Facile', description: 'Chasse aux aurores boréales dans les fjords du nord. Expérience magique entre décembre et mars.', bestSeason: 'Déc–Mar', emoji: '✨' },
  ],
  jp: [
    { name: 'Ascension du Mont Fuji', type: 'Randonnée', duration: '2 jours', difficulty: 'Intermédiaire', description: 'Ascension du symbole du Japon à 3776m. Lever de soleil depuis le sommet, expérience inoubliable.', bestSeason: 'Jul–Août', emoji: '🗻' },
    { name: 'Kumano Kodo', type: 'Pèlerinage', duration: '5–7 jours', difficulty: 'Facile', description: 'Chemin de pèlerinage millénaire dans les forêts de la péninsule de Kii. Patrimoine UNESCO.', bestSeason: 'Avr–Jun, Sep–Nov', emoji: '⛩️' },
    { name: 'Alpes japonaises — Kamikochi', type: 'Randonnée', duration: '3–5 jours', difficulty: 'Intermédiaire', description: 'Vallée alpine spectaculaire avec rivières cristallines et sommets enneigés. Randonnées variées.', bestSeason: 'Mai–Nov', emoji: '🏔️' },
    { name: 'Hokkaido — Daisetsuzan', type: 'Randonnée', duration: '4–6 jours', difficulty: 'Expert', description: 'Plus grand parc national du Japon. Volcans actifs, sources thermales et faune sauvage abondante.', bestSeason: 'Jun–Sep', emoji: '🦊' },
    { name: 'Chemin de Nakasendo', type: 'Randonnée', duration: '3–4 jours', difficulty: 'Facile', description: 'Ancienne route des samouraïs entre Kyoto et Tokyo. Villages préservés de l\'ère Edo.', bestSeason: 'Avr–Mai, Oct–Nov', emoji: '🌸' },
  ],
  ma: [
    { name: 'Toubkal — Sommet', type: 'Alpinisme', duration: '2–3 jours', difficulty: 'Intermédiaire', description: 'Plus haut sommet d\'Afrique du Nord à 4167m. Ascension depuis Imlil, vues sur l\'Atlas et le Sahara.', bestSeason: 'Avr–Jun, Sep–Oct', emoji: '🏔️' },
    { name: 'Trek M\'Goun', type: 'Trekking', duration: '5–7 jours', difficulty: 'Intermédiaire', description: 'Traversée du Haut Atlas central avec gorges spectaculaires, villages berbères et bivouacs en altitude.', bestSeason: 'Avr–Jun, Sep–Oct', emoji: '⛺' },
    { name: 'Désert du Sahara — Merzouga', type: 'Aventure', duration: '2–3 jours', difficulty: 'Facile', description: 'Nuit sous les étoiles dans les dunes de l\'Erg Chebbi. Balade à dos de dromadaire au lever du soleil.', bestSeason: 'Oct–Avr', emoji: '🐪' },
    { name: 'Gorges du Dadès', type: 'Randonnée', duration: '2–3 jours', difficulty: 'Facile', description: 'Randonnée dans les gorges rouges du Dadès avec kasbahs troglodytes et palmiers.', bestSeason: 'Mar–Mai, Sep–Nov', emoji: '🏜️' },
    { name: 'Côte Atlantique — Essaouira', type: 'Surf', duration: '3–5 jours', difficulty: 'Facile', description: 'Ville des vents et du surf. Médina classée UNESCO, plages sauvages et ambiance bohème.', bestSeason: 'Avr–Sep', emoji: '🏄' },
  ],
  nz: [
    { name: 'Milford Track', type: 'Trekking', duration: '4 jours', difficulty: 'Facile', description: 'Considéré comme la plus belle randonnée du monde. Fjords, cascades et forêts primaires de Fiordland.', bestSeason: 'Nov–Avr', emoji: '🌿' },
    { name: 'Tongariro Alpine Crossing', type: 'Randonnée', duration: '1 jour', difficulty: 'Intermédiaire', description: 'Traversée volcanique spectaculaire avec lacs émeraude, cratères et vues sur les trois volcans.', bestSeason: 'Nov–Avr', emoji: '🌋' },
    { name: 'Routeburn Track', type: 'Trekking', duration: '3–4 jours', difficulty: 'Intermédiaire', description: 'Trek entre deux parcs nationaux avec vues panoramiques sur les Alpes du Sud et les fjords.', bestSeason: 'Nov–Avr', emoji: '🏔️' },
    { name: 'Abel Tasman Coast Track', type: 'Randonnée', duration: '3–5 jours', difficulty: 'Facile', description: 'Côte dorée avec plages turquoise, forêts et kayak. Le trek côtier le plus populaire de NZ.', bestSeason: 'Oct–Avr', emoji: '🏖️' },
    { name: 'Queenstown — Aventure', type: 'Aventure', duration: '3–5 jours', difficulty: 'Facile', description: 'Capitale mondiale de l\'aventure. Saut à l\'élastique, parapente, rafting et ski en hiver.', bestSeason: 'Toute l\'année', emoji: '🪂' },
  ],
  ca: [
    { name: 'Banff & Jasper — Icefields Parkway', type: 'Randonnée', duration: '7–10 jours', difficulty: 'Intermédiaire', description: 'Route des glaciers entre deux parcs nationaux. Lacs turquoise, glaciers et faune sauvage abondante.', bestSeason: 'Jun–Sep', emoji: '🏔️' },
    { name: 'West Coast Trail', type: 'Trekking', duration: '6–8 jours', difficulty: 'Expert', description: 'Trek sauvage sur l\'île de Vancouver. Forêts tempérées, plages isolées et passages techniques.', bestSeason: 'Mai–Sep', emoji: '🌊' },
    { name: 'Haida Gwaii', type: 'Aventure', duration: '7–10 jours', difficulty: 'Intermédiaire', description: 'Archipel sauvage au large de la Colombie-Britannique. Culture haïda, kayak et faune marine exceptionnelle.', bestSeason: 'Jun–Sep', emoji: '🦅' },
    { name: 'Yukon — Kluane', type: 'Trekking', duration: '5–7 jours', difficulty: 'Expert', description: 'Parc national avec le plus grand champ de glace non polaire. Randonnée sauvage et observation des ours.', bestSeason: 'Jun–Août', emoji: '🐻' },
    { name: 'Québec — Charlevoix', type: 'Randonnée', duration: '3–5 jours', difficulty: 'Facile', description: 'Région des Laurentides avec sentiers panoramiques, villages pittoresques et gastronomie québécoise.', bestSeason: 'Jun–Oct', emoji: '🍁' },
  ],
  pe: [
    { name: 'Chemin de l\'Inca — Machu Picchu', type: 'Trekking', duration: '4 jours', difficulty: 'Intermédiaire', description: 'Trek mythique de 43km jusqu\'à la cité inca de Machu Picchu. Patrimoine UNESCO, expérience unique.', bestSeason: 'Mai–Sep', emoji: '🏛️' },
    { name: 'Cordillère Blanche — Huaraz', type: 'Alpinisme', duration: '7–14 jours', difficulty: 'Expert', description: 'Plus haute chaîne tropicale du monde. Sommets de 6000m+, glaciers et lacs d\'altitude spectaculaires.', bestSeason: 'Mai–Sep', emoji: '⛰️' },
    { name: 'Lac Titicaca', type: 'Culturel', duration: '2–3 jours', difficulty: 'Facile', description: 'Plus haut lac navigable du monde à 3812m. Îles flottantes des Uros et culture Aymara authentique.', bestSeason: 'Mai–Oct', emoji: '🚣' },
    { name: 'Colca Canyon', type: 'Randonnée', duration: '2–3 jours', difficulty: 'Intermédiaire', description: 'L\'un des canyons les plus profonds du monde. Observation des condors et villages andins traditionnels.', bestSeason: 'Avr–Nov', emoji: '🦅' },
    { name: 'Amazonie — Iquitos', type: 'Aventure', duration: '4–7 jours', difficulty: 'Facile', description: 'Immersion dans la forêt amazonienne péruvienne. Faune exceptionnelle, communautés indigènes et pirogue.', bestSeason: 'Jun–Nov', emoji: '🌿' },
  ],
  cl: [
    { name: 'Torres del Paine — Circuit W', type: 'Trekking', duration: '5–7 jours', difficulty: 'Intermédiaire', description: 'Les trois tours de granit de Patagonie. Glaciers, lacs turquoise et paysages à couper le souffle.', bestSeason: 'Nov–Mar', emoji: '🏔️' },
    { name: 'Atacama — San Pedro', type: 'Aventure', duration: '4–6 jours', difficulty: 'Facile', description: 'Désert le plus aride du monde. Geysers, lacs salés, vallée de la Lune et ciel étoilé exceptionnel.', bestSeason: 'Avr–Nov', emoji: '🌵' },
    { name: 'Carretera Austral', type: 'Road trip', duration: '10–14 jours', difficulty: 'Intermédiaire', description: 'Route mythique de 1240km en Patagonie chilienne. Fjords, glaciers et forêts tempérées sauvages.', bestSeason: 'Nov–Mar', emoji: '🚗' },
    { name: 'Île de Pâques', type: 'Culturel', duration: '4–5 jours', difficulty: 'Facile', description: 'Mystérieuse île du Pacifique avec ses 900 statues Moaï. Randonnées entre volcans et côtes sauvages.', bestSeason: 'Sep–Mar', emoji: '🗿' },
    { name: 'Villarrica — Ascension', type: 'Alpinisme', duration: '1 jour', difficulty: 'Intermédiaire', description: 'Ascension du volcan actif Villarrica à 2847m. Vue sur le cratère fumant et les lacs de la région des lacs.', bestSeason: 'Nov–Mar', emoji: '🌋' },
  ],
  tz: [
    { name: 'Kilimandjaro — Machame Route', type: 'Alpinisme', duration: '7 jours', difficulty: 'Intermédiaire', description: 'Ascension du toit de l\'Afrique à 5895m par la route la plus panoramique. Taux de succès élevé.', bestSeason: 'Jan–Mar, Jun–Oct', emoji: '🏔️' },
    { name: 'Safari Serengeti', type: 'Safari', duration: '4–7 jours', difficulty: 'Facile', description: 'Grande migration des gnous, lions, éléphants et léopards. L\'un des meilleurs safaris d\'Afrique.', bestSeason: 'Jun–Oct', emoji: '🦁' },
    { name: 'Zanzibar — Plages', type: 'Détente', duration: '5–7 jours', difficulty: 'Facile', description: 'Île aux épices avec plages de sable blanc, eaux cristallines et Stone Town classée UNESCO.', bestSeason: 'Jun–Oct', emoji: '🏖️' },
    { name: 'Ngorongoro Crater', type: 'Safari', duration: '2–3 jours', difficulty: 'Facile', description: 'Plus grand cratère volcanique intact du monde. Concentration exceptionnelle de faune africaine.', bestSeason: 'Jun–Sep', emoji: '🦏' },
    { name: 'Parc Gombe — Chimpanzés', type: 'Aventure', duration: '2–3 jours', difficulty: 'Intermédiaire', description: 'Parc de Jane Goodall sur les rives du lac Tanganyika. Observation des chimpanzés en liberté.', bestSeason: 'Jun–Oct', emoji: '🐒' },
  ],
};

// Generate generic destinations based on country tags
function getGenericDestinations(country: CountryAIData) {
  const ideas = [];
  const tags = country.lieux || [];

  for (let i = 0; i < Math.min(tags.length, 5); i++) {
    const lieu = tags[i];
    ideas.push({
      name: lieu.nom,
      type: 'Exploration',
      duration: '2–4 jours',
      difficulty: 'Intermédiaire' as const,
      description: lieu.description,
      bestSeason: country.calendrier.filter((m) => m.status === 'good').slice(0, 2).map((m) => m.short).join('–') || 'Variable',
      emoji: '📍',
    });
  }
  return ideas;
}

const difficultyConfig = {
  Facile: { color: 'text-green-400 bg-green-400/10 border-green-400/20', dot: 'bg-green-400' },
  Intermédiaire: { color: 'text-amber-400 bg-amber-400/10 border-amber-400/20', dot: 'bg-amber-400' },
  Expert: { color: 'text-red-400 bg-red-400/10 border-red-400/20', dot: 'bg-red-400' },
};

type TabId = 'apercu' | 'destinations' | 'calendrier' | 'infos' | 'lieux' | 'kits';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'apercu', label: 'Aperçu', icon: 'HomeIcon' },
  { id: 'destinations', label: 'Destinations', icon: 'MapPinIcon' },
  { id: 'calendrier', label: 'Calendrier', icon: 'CalendarIcon' },
  { id: 'infos', label: 'Infos pratiques', icon: 'InformationCircleIcon' },
  { id: 'lieux', label: 'Lieux', icon: 'MapIcon' },
  { id: 'kits', label: 'Kits', icon: 'ShoppingBagIcon' },
];

export default function CountryPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = React.use(params);
  const [country, setCountry] = useState<CountryAIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('apercu');
  const [destFilter, setDestFilter] = useState<string>('Tous');

  const code = rawCode.toLowerCase();

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/pays/${code}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setCountry(json.data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [code]);

  const bestMonths = country?.calendrier.filter((m) => m.status === 'good') || [];
  const dangerColor = country
    ? country.danger_global <= 3 ? 'text-green-400' : country.danger_global <= 6 ? 'text-amber-400' : 'text-red-400' :'text-white';

  const destinations = DESTINATION_IDEAS[code] || (country ? getGenericDestinations(country) : []);
  const destTypes = ['Tous', ...Array.from(new Set(destinations.map((d) => d.type)))];
  const filteredDests = destFilter === 'Tous' ? destinations : destinations.filter((d) => d.type === destFilter);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main id="main-content" className="pt-20">
        {/* Breadcrumb */}
        <nav aria-label="Fil d'Ariane" className="bg-dark-bg border-b border-white/5">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <ol className="flex items-center gap-2 text-xs text-white/40">
              <li><Link href="/" className="hover:text-white/70 transition-colors">Accueil</Link></li>
              <li aria-hidden="true"><Icon name="ChevronRightIcon" size={12} variant="outline" /></li>
              <li><Link href="/pays" className="hover:text-white/70 transition-colors">Pays</Link></li>
              <li aria-hidden="true"><Icon name="ChevronRightIcon" size={12} variant="outline" /></li>
              <li className="text-white/70">{country?.nom || code.toUpperCase()}</li>
            </ol>
          </div>
        </nav>

        {/* Hero */}
        <section className="bg-dark-bg border-b border-white/5">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            {loading ? (
              <SkeletonCountry />
            ) : error ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                  <Icon name="ExclamationTriangleIcon" size={28} variant="outline" className="text-red-400" />
                </div>
                <p className="text-red-400 mb-2 font-semibold">Données indisponibles</p>
                <p className="text-white/40 text-sm mb-6">{error}</p>
                <button onClick={() => window.location.reload()} className="btn-primary">
                  Réessayer
                </button>
              </div>
            ) : country ? (
              <>
                {/* Country header */}
                <div className="flex flex-col sm:flex-row items-start gap-6 mb-8">
                  <div className="flex items-center gap-5">
                    <span className="text-7xl" role="img" aria-label={`Drapeau ${country.nom}`}>
                      {getFlagEmoji(code)}
                    </span>
                    <div>
                      <p className="text-xs font-mono text-primary tracking-widest uppercase mb-1" style={{ fontFamily: 'var(--font-mono)' }}>
                        {country.continent}
                      </p>
                      <h1 className="font-bold text-4xl sm:text-5xl text-white tracking-tight mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                        {country.nom}
                      </h1>
                      <div className="flex flex-wrap gap-3 text-sm text-white/50">
                        <span className="flex items-center gap-1">
                          <Icon name="BuildingLibraryIcon" size={12} variant="outline" />
                          {country.capital}
                        </span>
                        <span className="flex items-center gap-1">
                          <Icon name="CurrencyEuroIcon" size={12} variant="outline" />
                          {country.monnaie}
                        </span>
                        <span className="flex items-center gap-1">
                          <Icon name="UsersIcon" size={12} variant="outline" />
                          {country.population}
                        </span>
                        <span className="flex items-center gap-1">
                          <Icon name="MapIcon" size={12} variant="outline" />
                          {country.superficie}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="sm:ml-auto text-right">
                    <p className="text-xs text-white/30 mb-1 font-mono" style={{ fontFamily: 'var(--font-mono)' }}>Indice de danger</p>
                    <p className={`font-bold text-4xl ${dangerColor}`} style={{ fontFamily: 'var(--font-display)' }}>
                      {country.danger_global}<span className="text-white/30 text-xl">/10</span>
                    </p>
                    <div className="mt-2 w-40">
                      <DangerBar level={country.danger_global} />
                    </div>
                  </div>
                </div>

                {/* Quick stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                  <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <p className="text-xs text-white/40 mb-1">Fuseau horaire</p>
                    <p className="text-sm font-semibold text-white">{country.fuseau}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <p className="text-xs text-white/40 mb-1">Langues</p>
                    <p className="text-sm font-semibold text-white">{country.langues?.slice(0, 2).join(', ')}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <p className="text-xs text-white/40 mb-1">Coordonnées</p>
                    <p className="text-sm font-semibold text-white font-mono" style={{ fontFamily: 'var(--font-mono)' }}>{country.coordonnees}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <p className="text-xs text-white/40 mb-1">Meilleure période</p>
                    <p className="text-sm font-semibold text-green-400">
                      {bestMonths.length > 0 ? `${bestMonths[0].short}–${bestMonths[bestMonths.length - 1].short}` : 'Variable'}
                    </p>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 border-b border-white/10 overflow-x-auto" role="tablist" aria-label="Sections du pays">
                  {TABS.map((tab) => (
                    <button
                      key={tab.id}
                      role="tab"
                      aria-selected={activeTab === tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-all border-b-2 -mb-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        activeTab === tab.id
                          ? 'border-primary text-white' :'border-transparent text-white/40 hover:text-white/70'
                      }`}
                    >
                      <Icon name={tab.icon as never} size={14} variant="outline" />
                      {tab.label}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </section>

        {/* Tab content */}
        {country && !loading && (
          <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

            {/* ── APERÇU ── */}
            {activeTab === 'apercu' && (
              <div className="space-y-8">
                {/* Danger overview */}
                <div>
                  <h2 className="font-bold text-xl text-foreground mb-4" style={{ fontFamily: 'var(--font-display)' }}>
                    Évaluation des risques
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {country.danger_details.map((d) => (
                      <div key={d.label} className={`topo-card p-4 border ${dangerLevelBg[d.level]}`}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold text-foreground">{d.label}</p>
                          <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full border ${dangerLevelColors[d.level]} ${dangerLevelBg[d.level]}`} style={{ fontFamily: 'var(--font-mono)' }}>
                            {dangerLevelLabels[d.level]}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{d.note}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Events */}
                {country.events.length > 0 && (
                  <div>
                    <h2 className="font-bold text-xl text-foreground mb-4" style={{ fontFamily: 'var(--font-display)' }}>
                      Événements & saisons clés
                    </h2>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {country.events.map((ev) => (
                        <div key={ev.titre} className="topo-card p-4 flex gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg ${
                            ev.type === 'festival' ? 'bg-purple-500/10' : ev.type === 'saison' ? 'bg-green-500/10' : 'bg-red-500/10'
                          }`}>
                            {ev.type === 'festival' ? '🎉' : ev.type === 'saison' ? '🌤' : '⚠️'}
                          </div>
                          <div>
                            <p className="text-xs font-mono text-muted-foreground mb-0.5" style={{ fontFamily: 'var(--font-mono)' }}>{ev.mois}</p>
                            <p className="text-sm font-semibold text-foreground">{ev.titre}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top destinations preview */}
                {destinations.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-bold text-xl text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
                        Idées de destinations
                      </h2>
                      <button onClick={() => setActiveTab('destinations')} className="text-xs text-primary hover:underline">
                        Voir toutes →
                      </button>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-3">
                      {destinations.slice(0, 3).map((dest) => {
                        const diff = difficultyConfig[dest.difficulty];
                        return (
                          <div key={dest.name} className="topo-card p-4 hover:border-primary/20 transition-colors">
                            <div className="flex items-start justify-between mb-2">
                              <span className="text-2xl">{dest.emoji}</span>
                              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${diff.color}`} style={{ fontFamily: 'var(--font-mono)' }}>
                                {dest.difficulty}
                              </span>
                            </div>
                            <h3 className="font-semibold text-sm text-foreground mb-1" style={{ fontFamily: 'var(--font-display)' }}>{dest.name}</h3>
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{dest.description}</p>
                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Icon name="ClockIcon" size={10} variant="outline" />
                                {dest.duration}
                              </span>
                              <span className="flex items-center gap-1">
                                <Icon name="TagIcon" size={10} variant="outline" />
                                {dest.type}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Top lieux preview */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-xl text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
                      Incontournables
                    </h2>
                    <button onClick={() => setActiveTab('lieux')} className="text-xs text-primary hover:underline">
                      Voir tous →
                    </button>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {country.lieux.slice(0, 3).map((lieu, i) => (
                      <div key={lieu.nom} className="topo-card p-4 flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 font-mono text-primary font-bold text-sm" style={{ fontFamily: 'var(--font-mono)' }}>
                          {i + 1}
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm text-foreground mb-1" style={{ fontFamily: 'var(--font-display)' }}>{lieu.nom}</h3>
                          <p className="text-xs text-muted-foreground line-clamp-2">{lieu.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CTA */}
                <div className="topo-card p-6 bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-foreground mb-1" style={{ fontFamily: 'var(--font-display)' }}>
                        Préparez votre voyage en {country.nom}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Notre IA configure votre kit idéal selon la saison, les activités et votre budget.
                      </p>
                    </div>
                    <Link href="/ai-configurator" className="btn-primary flex items-center gap-2 whitespace-nowrap">
                      <Icon name="SparklesIcon" size={16} variant="outline" />
                      Configurer mon kit
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* ── DESTINATIONS ── */}
            {activeTab === 'destinations' && (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="font-bold text-xl text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
                      Idées de destinations en {country.nom}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {destinations.length} destination{destinations.length > 1 ? 's' : ''} sélectionnée{destinations.length > 1 ? 's' : ''} par nos experts
                    </p>
                  </div>
                  {/* Type filter */}
                  {destTypes.length > 2 && (
                    <div className="flex flex-wrap gap-2">
                      {destTypes.map((type) => (
                        <button
                          key={type}
                          onClick={() => setDestFilter(type)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                            destFilter === type
                              ? 'bg-primary border-primary text-white' :'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {filteredDests.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Icon name="MapPinIcon" size={32} variant="outline" className="mx-auto mb-3 opacity-30" />
                    <p>Aucune destination pour ce filtre</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredDests.map((dest, i) => {
                      const diff = difficultyConfig[dest.difficulty];
                      return (
                        <div key={dest.name} className="topo-card p-5 hover:border-primary/20 transition-all group">
                          <div className="flex gap-4">
                            {/* Number + emoji */}
                            <div className="flex flex-col items-center gap-2 flex-shrink-0">
                              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center font-mono text-primary font-bold text-sm" style={{ fontFamily: 'var(--font-mono)' }}>
                                {String(i + 1).padStart(2, '0')}
                              </div>
                              <span className="text-2xl">{dest.emoji}</span>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-start gap-2 mb-2">
                                <h3 className="font-bold text-foreground text-base group-hover:text-primary transition-colors" style={{ fontFamily: 'var(--font-display)' }}>
                                  {dest.name}
                                </h3>
                                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border flex-shrink-0 ${diff.color}`} style={{ fontFamily: 'var(--font-mono)' }}>
                                  {dest.difficulty}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground leading-relaxed mb-3">{dest.description}</p>
                              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                  <Icon name="ClockIcon" size={12} variant="outline" />
                                  <span className="font-medium text-foreground">{dest.duration}</span>
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <Icon name="TagIcon" size={12} variant="outline" />
                                  <span className="font-medium text-foreground">{dest.type}</span>
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <Icon name="SunIcon" size={12} variant="outline" />
                                  <span>Meilleure saison : <span className="font-medium text-green-400">{dest.bestSeason}</span></span>
                                </span>
                              </div>
                            </div>

                            {/* CTA */}
                            <div className="flex-shrink-0 hidden sm:flex items-center">
                              <Link
                                href="/ai-configurator"
                                className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 text-primary rounded-xl text-xs font-medium hover:bg-primary/20 transition-all whitespace-nowrap"
                              >
                                <Icon name="SparklesIcon" size={12} variant="outline" />
                                Préparer ce trek
                              </Link>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* CTA Banner */}
                <div className="mt-8 topo-card p-6 bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-foreground mb-1" style={{ fontFamily: 'var(--font-display)' }}>
                        Votre kit pour {country.nom}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Configurez votre équipement idéal selon la destination choisie, la saison et votre niveau.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <Link href="/kits" className="btn-secondary flex items-center gap-2 whitespace-nowrap">
                        <Icon name="ShoppingBagIcon" size={16} variant="outline" />
                        Voir les kits
                      </Link>
                      <Link href="/ai-configurator" className="btn-primary flex items-center gap-2 whitespace-nowrap">
                        <Icon name="SparklesIcon" size={16} variant="outline" />
                        Kit IA
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── CALENDRIER ── */}
            {activeTab === 'calendrier' && (
              <div>
                <h2 className="font-bold text-xl text-foreground mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                  Calendrier météo
                </h2>
                <p className="text-sm text-muted-foreground mb-6">Températures et précipitations mensuelles pour {country.nom}.</p>

                {/* Month cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
                  {country.calendrier.map((m) => (
                    <div
                      key={m.month}
                      className={`topo-card p-3 text-center border ${statusBg[m.status]}`}
                      aria-label={`${m.month} : ${statusLabels[m.status]}, ${m.temp_min}°C à ${m.temp_max}°C`}
                    >
                      <p className="text-xs font-mono text-muted-foreground mb-2" style={{ fontFamily: 'var(--font-mono)' }}>{m.short}</p>
                      <div className={`w-3 h-3 rounded-full mx-auto mb-2 ${statusColors[m.status]}`} aria-hidden="true" />
                      <p className={`text-xs font-bold ${statusText[m.status]}`}>{statusLabels[m.status]}</p>
                      <p className="text-[11px] text-foreground font-semibold mt-1">{m.temp_min}° – {m.temp_max}°</p>
                      <p className="text-[10px] text-muted-foreground">{m.rain_mm}mm</p>
                      {m.description && (
                        <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{m.description}</p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Temperature bar chart */}
                <div className="topo-card p-5 mb-6">
                  <h3 className="font-semibold text-sm text-foreground mb-4">Températures (°C)</h3>
                  <div className="flex items-end gap-2 h-24">
                    {country.calendrier.map((m) => {
                      const maxTemp = Math.max(...country.calendrier.map((x) => x.temp_max));
                      const heightPct = maxTemp > 0 ? Math.max(10, (m.temp_max / maxTemp) * 100) : 20;
                      return (
                        <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                          <div
                            className={`w-full rounded-t-sm ${statusColors[m.status]} opacity-80`}
                            style={{ height: `${heightPct}%` }}
                            title={`${m.month}: ${m.temp_min}°–${m.temp_max}°C`}
                          />
                          <span className="text-[9px] text-muted-foreground font-mono" style={{ fontFamily: 'var(--font-mono)' }}>{m.short}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Precipitation bar chart */}
                <div className="topo-card p-5">
                  <h3 className="font-semibold text-sm text-foreground mb-4">Précipitations (mm)</h3>
                  <div className="flex items-end gap-2 h-20">
                    {country.calendrier.map((m) => {
                      const maxRain = Math.max(...country.calendrier.map((x) => x.rain_mm));
                      const heightPct = maxRain > 0 ? Math.max(5, (m.rain_mm / maxRain) * 100) : 10;
                      return (
                        <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                          <div
                            className="w-full rounded-t-sm bg-info/60"
                            style={{ height: `${heightPct}%` }}
                            title={`${m.month}: ${m.rain_mm}mm`}
                          />
                          <span className="text-[9px] text-muted-foreground font-mono" style={{ fontFamily: 'var(--font-mono)' }}>{m.short}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Legend */}
                <div className="flex gap-4 mt-4">
                  {Object.entries(statusLabels).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <div className={`w-2.5 h-2.5 rounded-full ${statusColors[key as keyof typeof statusColors]}`} aria-hidden="true" />
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── INFOS PRATIQUES ── */}
            {activeTab === 'infos' && (
              <div>
                <h2 className="font-bold text-xl text-foreground mb-6" style={{ fontFamily: 'var(--font-display)' }}>
                  Informations pratiques
                </h2>
                <div className="grid sm:grid-cols-2 gap-4 mb-8">
                  {country.infos_pratiques.map((info) => (
                    <div key={info.label} className="topo-card p-4 flex gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                        <Icon name={info.icon as never} size={18} variant="outline" className="text-primary" />
                      </div>
                      <div>
                        <p className="text-xs font-mono text-muted-foreground mb-0.5" style={{ fontFamily: 'var(--font-mono)' }}>{info.label}</p>
                        <p className="text-sm text-foreground">{info.value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Danger details */}
                <h3 className="font-bold text-lg text-foreground mb-4" style={{ fontFamily: 'var(--font-display)' }}>
                  Évaluation des risques
                </h3>
                <div className="space-y-3">
                  {country.danger_details.map((d) => (
                    <div key={d.label} className={`topo-card p-4 border ${dangerLevelBg[d.level]}`}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold text-foreground">{d.label}</p>
                        <span className={`text-xs font-mono font-bold ${dangerLevelColors[d.level]}`} style={{ fontFamily: 'var(--font-mono)' }}>
                          {dangerLevelLabels[d.level]}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{d.note}</p>
                    </div>
                  ))}
                </div>

                {/* Languages */}
                {country.langues && country.langues.length > 0 && (
                  <div className="mt-8">
                    <h3 className="font-bold text-lg text-foreground mb-4" style={{ fontFamily: 'var(--font-display)' }}>
                      Langues parlées
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {country.langues.map((lang) => (
                        <span key={lang} className="px-3 py-1.5 rounded-full bg-secondary/10 text-secondary text-sm border border-secondary/20 font-medium">
                          {lang}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── LIEUX ── */}
            {activeTab === 'lieux' && (
              <div>
                <h2 className="font-bold text-xl text-foreground mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                  Lieux incontournables
                </h2>
                <p className="text-sm text-muted-foreground mb-6">Les sites et expériences à ne pas manquer en {country.nom}.</p>
                <div className="space-y-4">
                  {country.lieux.map((lieu, i) => (
                    <div key={lieu.nom} className="topo-card p-5 flex gap-4 hover:border-primary/20 transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 font-mono text-primary font-bold" style={{ fontFamily: 'var(--font-mono)' }}>
                        {String(i + 1).padStart(2, '0')}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-foreground mb-1" style={{ fontFamily: 'var(--font-display)' }}>{lieu.nom}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">{lieu.description}</p>
                      </div>
                      <Icon name="MapPinIcon" size={16} variant="outline" className="text-muted-foreground flex-shrink-0 mt-1" />
                    </div>
                  ))}
                </div>

                {/* Events */}
                {country.events.length > 0 && (
                  <>
                    <h3 className="font-bold text-lg text-foreground mt-10 mb-4" style={{ fontFamily: 'var(--font-display)' }}>
                      Événements & saisons
                    </h3>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {country.events.map((ev) => (
                        <div key={ev.titre} className="topo-card p-4 flex gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg ${
                            ev.type === 'festival' ? 'bg-purple-500/10' : ev.type === 'saison' ? 'bg-green-500/10' : 'bg-red-500/10'
                          }`}>
                            {ev.type === 'festival' ? '🎉' : ev.type === 'saison' ? '🌤' : '⚠️'}
                          </div>
                          <div>
                            <p className="text-xs font-mono text-muted-foreground mb-0.5" style={{ fontFamily: 'var(--font-mono)' }}>{ev.mois}</p>
                            <p className="text-sm font-semibold text-foreground">{ev.titre}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── KITS ── */}
            {activeTab === 'kits' && (
              <div>
                <h2 className="font-bold text-xl text-foreground mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                  Kits recommandés pour {country.nom}
                </h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Équipements sélectionnés par nos experts pour ce pays et ses conditions.
                </p>
                <div className="grid sm:grid-cols-3 gap-4 mb-8">
                  {country.kits_recommandes.map((kit, i) => (
                    <Link
                      key={kit.slug}
                      href={`/kits/${kit.slug}`}
                      className="topo-card p-5 group hover:border-primary/30 transition-all"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-mono text-muted-foreground px-2 py-0.5 rounded-full bg-muted" style={{ fontFamily: 'var(--font-mono)' }}>
                          Kit #{i + 1}
                        </span>
                        <span className="text-xs font-mono text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>
                          {kit.poids_g.toLocaleString('fr-FR')} g
                        </span>
                      </div>
                      <h3 className="font-bold text-foreground mb-1 group-hover:text-primary transition-colors" style={{ fontFamily: 'var(--font-display)' }}>
                        {kit.nom}
                      </h3>
                      {kit.description && (
                        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{kit.description}</p>
                      )}
                      <WeightGauge weightG={kit.poids_g} maxG={15000} />
                      <div className="flex items-center justify-between mt-3">
                        <span className="font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
                          {formatPrice(kit.prix_cents)}
                        </span>
                        <span className="text-xs text-primary font-medium group-hover:underline flex items-center gap-1">
                          Voir le kit
                          <Icon name="ArrowRightIcon" size={12} variant="outline" />
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>

                <div className="topo-card p-6 bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-foreground mb-1" style={{ fontFamily: 'var(--font-display)' }}>
                        Kit personnalisé pour {country.nom}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Notre IA analyse la météo, les activités et votre budget pour créer votre kit sur mesure.
                      </p>
                    </div>
                    <Link href="/ai-configurator" className="btn-primary flex items-center gap-2 whitespace-nowrap">
                      <Icon name="SparklesIcon" size={16} variant="outline" />
                      Configurer mon kit IA
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        <TopoSeparator />
      </main>
      <Footer />
    </div>
  );
}
