'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CopilotEngine, HikeContextSummary } from '../copilot/CopilotEngine';

interface CopilotPanelProps {
  isOpen: boolean;
  onClose: () => void;
  context: HikeContextSummary;
}

const QUICK_QUESTIONS = [
  'Combien il me reste ?',
  'Où est le prochain point d\'eau ?',
  'Est-ce que je suis dans les temps ?',
  'Où faire une pause ?',
  'Quand arrive la montée ?',
];

export default function CopilotPanel({ isOpen, onClose, context }: CopilotPanelProps) {
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAsk = (question: string) => {
    setSelectedQuestion(question);
    const ans = CopilotEngine.generateAnswer(question, context);
    setAnswer(ans);
  };

  const proactiveSuggestion = CopilotEngine.getProactiveSuggestion(context);

  return (
    <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="w-full max-w-sm bg-[#0d1a12] border-t sm:border border-[#2D5A27]/50 rounded-t-3xl sm:rounded-3xl p-5 text-white shadow-2xl relative space-y-4"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/60 hover:text-white bg-white/10 w-8 h-8 rounded-full flex items-center justify-center text-sm"
        >
          ✕
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[#2D5A27]/40 pb-3">
          <span className="text-2xl p-2 rounded-2xl bg-[#17402C] text-[#4E9F3D] border border-[#4E9F3D]/40">
            🤖
          </span>
          <div>
            <h3 className="font-bold text-base text-white">Copilote IA Terrain</h3>
            <p className="text-[11px] text-[#A3C4A3]">Analyse & Conseils en direct</p>
          </div>
        </div>

        {/* Proactive Banner if available */}
        {proactiveSuggestion && (
          <div className="p-3 bg-[#17402C]/60 border border-[#4E9F3D]/40 rounded-2xl text-xs text-[#A3C4A3]">
            {proactiveSuggestion}
          </div>
        )}

        {/* Quick Questions Chips */}
        <div>
          <span className="text-[10px] text-[#A3C4A3] font-mono uppercase tracking-widest block mb-2">
            Questions rapides
          </span>
          <div className="flex flex-wrap gap-2">
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => handleAsk(q)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                  selectedQuestion === q
                    ? 'bg-[#2D6A4F] text-white border-[#4E9F3D]/60'
                    : 'bg-[#17402C]/40 text-[#A3C4A3] border-[#2D5A27]/30 hover:bg-[#17402C]/80 hover:text-white'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Answer Display Card */}
        {answer && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-[#17402C]/80 border border-[#4E9F3D]/50 rounded-2xl text-xs leading-relaxed text-white space-y-1"
          >
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#4E9F3D]">
              <span>✦ Copilote</span>
            </div>
            <p>{answer}</p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
