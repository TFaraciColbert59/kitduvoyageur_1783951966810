'use client';

import React, { useState } from 'react';

interface DesktopRightPanelProps {
  averageSpeedKmH?: number;
  durationSeconds?: number;
  currentSpeedKmH?: number;
  elevationGainM?: number;
  elevationLossM?: number;
  distanceKm?: number;
  remainingDistanceKm?: number;
  weatherCondition?: string;
  routeName?: string;
  onAskCopilot?: (question: string) => void;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`;
  return `${m}m`;
}

export default function DesktopRightPanel({
  averageSpeedKmH = 0,
  durationSeconds = 0,
  currentSpeedKmH = 0,
  elevationGainM = 0,
  elevationLossM = 0,
  distanceKm = 0,
  remainingDistanceKm = 0,
  weatherCondition = 'Chargement…',
  routeName,
}: DesktopRightPanelProps) {
  const [inputText, setInputText] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'ai' | 'user'; text: string }>>([
    {
      sender: 'ai',
      text: `Bonjour ! Je suis votre copilote LKDV pour ${routeName || 'votre randonnée'}. Posez-moi vos questions de météo, parcours ou points d'intérêt.`,
    },
  ]);

  const handleSendQuestion = async (questionText: string) => {
    if (!questionText.trim()) return;
    const text = questionText.trim();
    setInputText('');

    setChatMessages((prev) => [...prev, { sender: 'user', text }]);

    try {
      const res = await fetch('/api/trip-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: 'Chartreuse (Chamechaude)',
          difficulty: 'Modérée',
          season: 'Été',
          question: text,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.answer) {
          setChatMessages((prev) => [...prev, { sender: 'ai', text: data.answer }]);
          return;
        }
      }
    } catch {
      /* fallback below */
    }

    let reply = `D'après vos données (${distanceKm.toFixed(1)} km parcourus, D+ +${elevationGainM} m), votre itinéraire se déroule parfaitement. Météo : ${weatherCondition}.`;
    if (text.includes('eau')) {
      reply = 'La prochaine source d\'eau potable est à 450 m sur votre droite (Refuge du Habert).';
    } else if (text.includes('courte')) {
      reply = 'Une variante par le col du Coq permet de raccourcir le parcours de 2,3 km.';
    }
    setChatMessages((prev) => [...prev, { sender: 'ai', text: reply }]);
  };

  return (
    <div className="absolute top-[96px] right-5 w-[340px] max-h-[calc(100%-180px)] flex flex-col gap-3.5 z-30 select-none overflow-y-auto custom-scrollbar">
      {/* 1. Live Stats Panel */}
      <div className="bg-[#FBFAF6]/92 backdrop-blur-2xl border border-[#0B1F17]/07 rounded-2xl shadow-[0_12px_32px_rgba(11,31,23,0.10),0_2px_8px_rgba(11,31,23,0.04)] overflow-hidden p-4 space-y-3">
        <div className="flex justify-between items-baseline">
          <span className="text-[11px] uppercase tracking-widest text-[#6B7A72] font-semibold">
            Stats en direct
          </span>
          <span className="font-mono text-[10px] text-[#8B978F] tracking-wide">
            Mise à jour · 09:41
          </span>
        </div>

        {/* 2x2 Grid with Hero Cell */}
        <div className="grid grid-cols-2 gap-2">
          {/* Hero Cell: Allure moyenne */}
          <div className="col-span-2 bg-[#06120C] text-white p-3.5 rounded-2xl relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_100%_0%,rgba(168,200,160,0.2)_0%,transparent_60%)]" />
            <div className="font-mono text-[9px] uppercase tracking-widest text-[#C6DCBE] leading-none">
              Allure moyenne
            </div>
            <div className="text-2xl font-medium tracking-tight mt-1.5 leading-none">
              {averageSpeedKmH.toFixed(1)}
              <em className="font-serif italic font-normal text-base text-[#C6DCBE] ml-0.5">km/h</em>
            </div>
            <div className="font-mono text-[9px] text-[#C6DCBE]/70 tracking-wide mt-1.5">
              ▲ RYTHME RÉGULIER · +0,2 KM/H DEPUIS L&apos;HABERT
            </div>
          </div>

          {/* Cell 2: Durée */}
          <div className="p-3 bg-[#0B1F17]/04 border border-[#0B1F17]/05 rounded-2xl">
            <div className="font-mono text-[9px] uppercase tracking-widest text-[#6B7A72] leading-none">
              Durée
            </div>
            <div className="text-xl font-medium tracking-tight text-[#0B1F17] mt-1.5 leading-none">
              {formatDuration(durationSeconds)}
            </div>
            <div className="font-mono text-[9px] text-[#6B7A72] tracking-wide mt-1.5">
              PAUSES · 16 MIN
            </div>
          </div>

          {/* Cell 3: Vitesse actuelle */}
          <div className="p-3 bg-[#0B1F17]/04 border border-[#0B1F17]/05 rounded-2xl">
            <div className="font-mono text-[9px] uppercase tracking-widest text-[#6B7A72] leading-none">
              Vitesse actuelle
            </div>
            <div className="text-xl font-medium tracking-tight text-[#0B1F17] mt-1.5 leading-none">
              {currentSpeedKmH.toFixed(1)}
              <em className="font-serif italic font-normal text-xs text-[#17402C] ml-0.5">km/h</em>
            </div>
            <div className="font-mono text-[9px] text-[#6B7A72] tracking-wide mt-1.5">
              MONTÉE MODÉRÉE
            </div>
          </div>

          {/* Cell 4: D+ */}
          <div className="p-3 bg-[#0B1F17]/04 border border-[#0B1F17]/05 rounded-2xl">
            <div className="font-mono text-[9px] uppercase tracking-widest text-[#6B7A72] leading-none">
              D+ · dénivelé
            </div>
            <div className="text-xl font-medium tracking-tight text-[#0B1F17] mt-1.5 leading-none">
              +{elevationGainM}
              <em className="font-serif italic font-normal text-xs text-[#17402C] ml-0.5">m</em>
            </div>
            <div className="font-mono text-[9px] text-[#6B7A72] tracking-wide mt-1.5">
              OBJ. · +1 200 M
            </div>
          </div>

          {/* Cell 5: D- */}
          <div className="p-3 bg-[#0B1F17]/04 border border-[#0B1F17]/05 rounded-2xl">
            <div className="font-mono text-[9px] uppercase tracking-widest text-[#6B7A72] leading-none">
              D− · dénivelé
            </div>
            <div className="text-xl font-medium tracking-tight text-[#0B1F17] mt-1.5 leading-none">
              −{elevationLossM}
              <em className="font-serif italic font-normal text-xs text-[#17402C] ml-0.5">m</em>
            </div>
            <div className="font-mono text-[9px] text-[#6B7A72] tracking-wide mt-1.5">
              PEU DESCENDU
            </div>
          </div>
        </div>
      </div>

      {/* 2. Copilot Panel */}
      <div className="bg-[#FBFAF6]/92 backdrop-blur-2xl border border-[#0B1F17]/07 rounded-2xl shadow-[0_12px_32px_rgba(11,31,23,0.10),0_2px_8px_rgba(11,31,23,0.04)] overflow-hidden p-4 space-y-3">
        <div className="flex justify-between items-baseline">
          <span className="text-[11px] uppercase tracking-widest text-[#6B7A72] font-semibold">
            Copilote <em className="font-serif italic text-[#17402C] font-normal">LKDV IA</em>
          </span>
          <span className="font-mono text-[10px] text-[#17402C] tracking-wide font-semibold">
            ● EN LIGNE
          </span>
        </div>

        {/* Animated Glowing Orb Header */}
        <div className="flex items-center gap-3 py-1">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#17402C] via-[#A8C8A0] to-[#EAF1E5] shadow-[0_0_24px_rgba(168,200,160,0.5)] animate-pulse flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-[#0B1F17]">
              Prêt à <em className="font-serif italic text-[#17402C] font-normal">répondre</em>
            </div>
            <div className="font-mono text-[9px] text-[#6B7A72] tracking-wider mt-0.5 truncate">
              CONTEXTE · JOUR 2 · {distanceKm.toFixed(1)} KM · {weatherCondition.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Messages List */}
        <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
          {chatMessages.map((msg, idx) => (
            <div
              key={idx}
              className={`p-2.5 rounded-xl text-xs leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-[#17402C] text-white ml-auto max-w-[85%]'
                  : 'bg-[#0B1F17]/04 text-[#0B1F17]'
              }`}
            >
              {msg.text}
              {msg.sender === 'ai' && idx === 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="px-2 py-0.5 bg-[#FBFAF6] border border-[#0B1F17]/06 rounded-full font-mono text-[9px] text-[#17402C] inline-flex items-center gap-1">
                    <svg className="w-2.5 h-2.5 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24">
                      <path d="M4 21l16-8L4 5v6l10 2-10 2z" />
                    </svg>
                    7,4 km
                  </span>
                  <span className="px-2 py-0.5 bg-[#FBFAF6] border border-[#0B1F17]/06 rounded-full font-mono text-[9px] text-[#17402C] inline-flex items-center gap-1">
                    <svg className="w-2.5 h-2.5 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24">
                      <path d="M4 20l6-12 4 6 4-2 2 8" />
                    </svg>
                    +780 m
                  </span>
                  <span className="px-2 py-0.5 bg-[#FBFAF6] border border-[#0B1F17]/06 rounded-full font-mono text-[9px] text-[#17402C] inline-flex items-center gap-1">
                    <svg className="w-2.5 h-2.5 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v5l3 2" />
                    </svg>
                    ETA 15:42
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Suggestion Chips */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {[
            'Prochain point d\'eau ?',
            'Variante plus courte ?',
            'Dans les temps ?',
          ].map((q) => (
            <button
              key={q}
              onClick={() => handleSendQuestion(q)}
              className="px-2.5 py-1 bg-[#FBFAF6] border border-[#0B1F17]/08 rounded-full text-[11px] text-[#384A42] hover:bg-[#EAF1E5] transition-colors inline-flex items-center gap-1 active:scale-95"
            >
              <span>{q}</span>
            </button>
          ))}
        </div>

        {/* Input Box with Mic Icon */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendQuestion(inputText);
          }}
          className="mt-2 p-1.5 pl-3.5 bg-[#F4F1EA] rounded-full flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Posez votre question…"
            className="flex-1 bg-transparent text-xs text-[#0B1F17] placeholder-[#6B7A72] focus:outline-none"
          />
          <button
            type="submit"
            className="w-8 h-8 rounded-full bg-[#17402C] text-white flex items-center justify-center active:scale-95 transition-transform"
          >
            <svg className="w-3.5 h-3.5 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 10c0 4-2 6-6 6s-6-2-6-6M12 16v4" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
