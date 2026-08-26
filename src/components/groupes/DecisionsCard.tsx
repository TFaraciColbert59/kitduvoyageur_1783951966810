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
  const [savingVoteId, setSavingVoteId] = useState<string | null>(null);

  React.useEffect(() => {
    setDecisions(initialDecisions);
  }, [initialDecisions]);

  React.useEffect(() => {
    if (!user || decisions.length === 0) return;
    const pollIds = decisions.map(d => d.id);
    (async () => {
      try {
        const { data } = await supabase
          .from('group_poll_votes')
          .select('poll_id, option_index')
          .eq('user_id', user.id)
          .in('poll_id', pollIds);
        if (!data) return;
        const votes = Object.fromEntries((data as any[]).map(v => [v.poll_id, v.option_index]));
        setDecisions(prev => prev.map(d => ({
          ...d,
          options: d.options.map(o => ({ ...o, selected: votes[d.id] === o.index })),
        })));
      } catch (err) {
        console.error(err);
      }
    })();
  }, [user, decisions.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVote = async (pollId: string, optionIndex: number) => {
    if (!groupId || !user) {
      alert('Connectez-vous pour voter.');
      return;
    }
    if (savingVoteId) return;

    const isCurrentlySelected = decisions.find(d => d.id === pollId)?.options.find(o => o.index === optionIndex)?.selected;

    setSavingVoteId(pollId);

    setDecisions(prev => prev.map(decision => {
      if (decision.id !== pollId) return decision;

      const newOpts = decision.options.map(opt => {
        const previouslySelected = opt.selected;
        const nowSelected = opt.index === optionIndex;
        let diff = 0;
        if (nowSelected && !previouslySelected) diff = 1;
        if (!nowSelected && previouslySelected) diff = -1;

        return {
          ...opt,
          selected: (!isCurrentlySelected && nowSelected) ? true : (previouslySelected && opt.index !== optionIndex ? false : opt.selected),
          votes: Math.max(0, opt.votes + diff),
        };
      });

      const corrected = newOpts.map(o => ({ ...o, selected: o.index === optionIndex }));

      const total = corrected.reduce((acc, o) => acc + o.votes, 0);
      corrected.forEach(o => {
        o.percentage = total > 0 ? Math.round((o.votes / total) * 100) : 0;
      });

      return { ...decision, options: corrected };
    }));

    const { error } = await supabase.from('group_poll_votes').upsert(
      { poll_id: pollId, user_id: user.id, option_index: optionIndex },
      { onConflict: 'poll_id,user_id' }
    );

    setSavingVoteId(null);

    if (error) {
      console.error('Vote error:', error);
      alert('Erreur lors du vote : ' + error.message);
    } else if (onRefresh) {
      onRefresh();
    }
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
    <div className="glass p-6 transition-all duration-300">
      <div className="flex justify-between items-start mb-2">
        <h2 className="font-display font-bold text-xl text-[#17402C]">Décisions <span className="font-serif italic font-normal text-[#17402C]">en cours</span></h2>
        <div className="flex items-center gap-2">
          <span className="glass-pill">{decisions.length} actifs</span>
        </div>
      </div>
      
      <div className="flex justify-between items-center mb-6">
        <span />
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="glass-capsule-btn primary py-1.5 px-3 text-xs font-bold flex items-center gap-1"
        >
          <Icon name={isAdding ? "XMarkIcon" : "PlusIcon"} size={12} className="relative z-10" />
          <span className="relative z-10">{isAdding ? 'Annuler' : 'Lancer un vote'}</span>
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleCreatePoll} className="mb-8 glass-sub-card p-5 rounded-2xl">
          <div className="mb-4">
            <label className="block text-xs font-bold text-[#17402C] mb-2">La question à trancher :</label>
            <input 
              type="text" 
              autoFocus
              value={newQuestion}
              onChange={e => setNewQuestion(e.target.value)}
              placeholder="Ex: Quel itinéraire prendre ?" 
              className="glass-input w-full text-xs"
              disabled={loading}
            />
          </div>
          
          <div className="space-y-3 mb-4">
            <label className="block text-xs font-bold text-[#17402C]">Les options (minimum 2) :</label>
            {newOptions.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <input 
                  type="text" 
                  value={opt}
                  onChange={e => handleOptionChange(i, e.target.value)}
                  placeholder={`Option ${i + 1}`} 
                  className="glass-input flex-1 text-xs"
                  disabled={loading}
                />
              </div>
            ))}
          </div>
          
          <div className="flex justify-between items-center mt-6">
            <button 
              type="button" 
              onClick={handleAddOption}
              className="glass-capsule-btn py-1.5 px-3 text-xs font-semibold"
              disabled={loading}
            >
              <span className="relative z-10">+ Ajouter une option</span>
            </button>
            <button 
              type="submit"
              disabled={!newQuestion.trim() || newOptions.filter(o => o.trim() !== '').length < 2 || loading}
              className="glass-capsule-btn primary py-2 px-4 text-xs font-bold disabled:opacity-50"
            >
              <span className="relative z-10">Créer le sondage</span>
            </button>
          </div>
        </form>
      )}

      <div className="space-y-6">
        {decisions.length === 0 && !isAdding && (
          <p className="text-center text-sm text-[#5C6B5E] py-4">Aucun sondage en cours.</p>
        )}
        
        {decisions.map(decision => {
          const totalVotes = decision.options.reduce((acc, opt) => acc + (opt.votes || 0), 0);
          
          return (
          <div key={decision.id} className="glass-sub-card rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="font-bold text-sm text-[#17402C]">{decision.author}</span>
              <span className="glass-pill text-[9px]">{decision.tag}</span>
              <span className="text-xs text-[#5C6B5E] ml-auto font-mono">{decision.meta}</span>
            </div>
            
            <p className="text-sm text-[#17402C] mb-5 font-sans leading-relaxed">
              {decision.question}
            </p>
            
            <div className="space-y-3 mb-5">
              {decision.options.map(option => {
                const pct = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
                
                return (
                <button 
                  type="button"
                  key={option.index}
                  onClick={() => handleVote(decision.id, option.index)}
                  disabled={savingVoteId === decision.id}
                  className={`group w-full relative overflow-hidden rounded-xl border text-left transition-colors disabled:opacity-70 cursor-pointer
                    ${option.selected ? 'border-[#17402C] bg-white' : 'glass-sub-card'}`}
                >
                  <motion.div 
                    className={`absolute inset-y-0 left-0 ${option.selected ? 'bg-[#17402C]/20' : 'bg-[#17402C]/10'}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5 }}
                  />
                  
                  <div className="relative p-3 flex items-center justify-between z-10">
                    <div className="flex items-center gap-3">
                      <div className={`glass-check-circle ${option.selected ? 'checked' : ''}`}>
                        {option.selected && <Icon name="CheckIcon" size={12} className="relative z-10" />}
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${option.selected ? 'text-[#17402C]' : 'text-[#5C6B5E]'}`}>{option.label}</p>
                      </div>
                    </div>
                    <span className={`font-mono font-bold text-sm ${option.selected ? 'text-[#17402C]' : 'text-[#5C6B5E]'}`}>
                      {pct}%
                    </span>
                  </div>
                </button>
              )})}
            </div>
            
            <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-widest text-[#5C6B5E] pt-3 border-t border-[#17402C]/10 font-bold">
              <span>{totalVotes} votes exprimés</span>
            </div>
          </div>
        )})}
      </div>
    </div>
  );
}
