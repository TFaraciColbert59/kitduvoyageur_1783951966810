import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';

interface Option {
  id: string;
  index: number;
  label: string;
  votes: number;
  percentage: number;
  details: string;
  selected: boolean;
}

interface Decision {
  id: string;
  author: string;
  tag: string;
  meta: string;
  question: string;
  options: Option[];
  footer: string;
}

interface DecisionsCardProps {
  decisions: Decision[];
  groupId?: string;
  onRefresh?: () => void;
  user?: any;
}

export default function DecisionsCard({ decisions: initialDecisions, groupId, onRefresh, user }: DecisionsCardProps) {
  const supabase = createClient();
  const [decisions, setDecisions] = useState(initialDecisions);
  const [isAdding, setIsAdding] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newOptions, setNewOptions] = useState(['', '']);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    setDecisions(initialDecisions);
  }, [initialDecisions]);

  const handleVote = async (pollId: string, optionIndex: number) => {
    if (!groupId || !user) return;
    
    // Simulate optimistic UI update
    setDecisions(decisions.map(decision => {
      if (decision.id !== pollId) return decision;
      
      const newOpts = decision.options.map(opt => {
        const previouslySelected = opt.selected;
        const nowSelected = opt.index === optionIndex;
        let diff = 0;
        if (nowSelected && !previouslySelected) diff = 1;
        if (!nowSelected && previouslySelected) diff = -1;
        
        return {
          ...opt,
          selected: nowSelected,
          votes: Math.max(0, opt.votes + diff),
        };
      });
      
      const total = newOpts.reduce((acc, o) => acc + o.votes, 0);
      newOpts.forEach(o => {
        o.percentage = total > 0 ? Math.round((o.votes / total) * 100) : 0;
      });
      
      return { ...decision, options: newOpts };
    }));

    // Insert or update the vote in group_poll_votes table
    const { error } = await supabase.from('group_poll_votes').upsert(
      { poll_id: pollId, user_id: user.id, option_index: optionIndex },
      { onConflict: 'poll_id,user_id' }
    );
    
    if (!error && onRefresh) onRefresh();
  };

  const handleAddOption = () => {
    setNewOptions([...newOptions, '']);
  };

  const handleOptionChange = (index: number, value: string) => {
    const opts = [...newOptions];
    opts[index] = value;
    setNewOptions(opts);
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    const validOptions = newOptions.filter(o => o.trim() !== '');
    if (!newQuestion.trim() || validOptions.length < 2 || !groupId || !user) return;
    
    setLoading(true);
    const formattedOptions = validOptions.map((label, i) => ({
      id: `o${i}`,
      label: label.trim(),
    }));

    const { error } = await supabase.from('group_polls').insert({
      group_id: groupId,
      created_by: user.id,
      question: newQuestion.trim(),
      options: formattedOptions,
      status: 'open'
    });

    if (error) {
      console.error(error);
      alert('Erreur: ' + error.message);
    } else {
      setNewQuestion('');
      setNewOptions(['', '']);
      setIsAdding(false);
      if (onRefresh) onRefresh();
    }
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-[2rem] p-6 border border-[#1C2620]/10 shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <h2 className="font-display text-xl text-[#1C2620]">Décisions <span className="font-serif italic font-bold">en cours</span></h2>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#1C2620]/60 bg-[#1C2620]/5 px-2 py-0.5 rounded-full">{decisions.length} actifs</span>
        </div>
      </div>
      
      <div className="flex justify-between items-center mb-6">
        <button className="text-xs font-medium text-[#E4501C] hover:underline font-sans">Historique</button>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="px-3 py-1.5 rounded-full bg-[#33463C] text-white font-sans font-medium text-xs hover:bg-[#33463C]/90 transition-colors flex items-center gap-1"
        >
          <Icon name={isAdding ? "XMarkIcon" : "PlusIcon"} size={12} /> {isAdding ? 'Annuler' : 'Lancer un vote'}
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleCreatePoll} className="mb-8 bg-[#E7E3D6]/20 p-5 rounded-2xl border border-[#1C2620]/10">
          <div className="mb-4">
            <label className="block text-xs font-semibold text-[#1C2620] mb-2">La question à trancher :</label>
            <input 
              type="text" 
              autoFocus
              value={newQuestion}
              onChange={e => setNewQuestion(e.target.value)}
              placeholder="Ex: Quel itinéraire prendre ?" 
              className="w-full bg-white border border-[#1C2620]/10 rounded-xl py-2 px-4 text-sm text-[#1C2620] placeholder-[#1C2620]/40 focus:outline-none focus:ring-2 focus:ring-[#33463C]/20"
              disabled={loading}
            />
          </div>
          
          <div className="space-y-3 mb-4">
            <label className="block text-xs font-semibold text-[#1C2620]">Les options (minimum 2) :</label>
            {newOptions.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <input 
                  type="text" 
                  value={opt}
                  onChange={e => handleOptionChange(i, e.target.value)}
                  placeholder={`Option ${i + 1}`} 
                  className="flex-1 bg-white border border-[#1C2620]/10 rounded-xl py-2 px-4 text-sm text-[#1C2620] placeholder-[#1C2620]/40 focus:outline-none focus:ring-2 focus:ring-[#33463C]/20"
                  disabled={loading}
                />
              </div>
            ))}
          </div>
          
          <div className="flex justify-between items-center mt-6">
            <button 
              type="button" 
              onClick={handleAddOption}
              className="text-xs font-semibold text-[#1C2620]/60 hover:text-[#1C2620]"
              disabled={loading}
            >
              + Ajouter une option
            </button>
            <button 
              type="submit"
              disabled={!newQuestion.trim() || newOptions.filter(o => o.trim() !== '').length < 2 || loading}
              className="px-4 py-2 bg-[#1C2620] text-white rounded-xl text-xs font-semibold disabled:opacity-50"
            >
              Créer le sondage
            </button>
          </div>
        </form>
      )}

      <div className="space-y-6">
        {decisions.length === 0 && !isAdding && (
          <p className="text-center text-sm text-[#1C2620]/50 py-4">Aucun sondage en cours.</p>
        )}
        
        {decisions.map(decision => {
          const totalVotes = decision.options.reduce((acc, opt) => acc + (opt.votes || 0), 0);
          
          return (
          <div key={decision.id} className="bg-[#E7E3D6]/20 border border-[#1C2620]/10 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="font-semibold text-sm text-[#1C2620]">{decision.author}</span>
              <span className="text-[9px] font-mono uppercase tracking-widest bg-[#33463C]/10 text-[#33463C] px-1.5 py-0.5 rounded-sm">{decision.tag}</span>
              <span className="text-xs text-[#1C2620]/50 ml-auto">{decision.meta}</span>
            </div>
            
            <p className="text-sm text-[#1C2620] mb-5 font-sans leading-relaxed">
              {decision.question}
            </p>
            
            <div className="space-y-3 mb-5">
              {decision.options.map(option => {
                const pct = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
                
                return (
                <button 
                  key={option.index}
                  onClick={() => handleVote(decision.id, option.index)}
                  className={`w-full relative overflow-hidden rounded-xl border text-left transition-colors
                    ${option.selected ? 'border-[#33463C] bg-white' : 'border-[#1C2620]/10 bg-white hover:border-[#33463C]/30'}`}
                >
                  <div className="absolute inset-0 bg-[#33463C]/5" />
                  <motion.div 
                    className={`absolute inset-y-0 left-0 ${option.selected ? 'bg-[#33463C]/10' : 'bg-[#E7E3D6]/50'}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5 }}
                  />
                  
                  <div className="relative p-3 flex items-center justify-between z-10">
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors
                        ${option.selected ? 'border-[#33463C] bg-[#33463C] text-white' : 'border-[#1C2620]/20 bg-transparent text-transparent'}`}>
                        <Icon name="CheckIcon" size={12} />
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${option.selected ? 'text-[#1C2620]' : 'text-[#1C2620]/70'}`}>{option.label}</p>
                      </div>
                    </div>
                    <span className={`font-mono font-bold text-sm ${option.selected ? 'text-[#33463C]' : 'text-[#1C2620]/50'}`}>
                      {pct}%
                    </span>
                  </div>
                </button>
              )})}
            </div>
            
            <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-widest text-[#1C2620]/50 pt-3 border-t border-[#1C2620]/10">
              <span>{totalVotes} votes exprimés</span>
            </div>
          </div>
        )})}
      </div>
    </div>
  );
}
