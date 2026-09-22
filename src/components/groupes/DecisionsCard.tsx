'use client';
import { lkvAlert } from '@/components/ui/dialogs';
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { Badge, Button, Card, EmptyState, Spinner } from '@/components/ui';

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
  pollType?: string;
  resolution?: {
    adopted: boolean;
    reason: string;
    winnerIndex: number | null;
    requiredVotes: number | null;
  };
}

interface DecisionsCardProps {
  decisions: Decision[];
  groupId?: string;
  onRefresh?: () => void;
  user?: any;
}

const FIELD_CLASS =
  'w-full rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-primary)] placeholder:text-[color:var(--lkv-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lkv-focus-ring)]';

export default function DecisionsCard({ decisions: initialDecisions, groupId, onRefresh, user }: DecisionsCardProps) {
  const supabase = createClient();
  const [decisions, setDecisions] = useState(initialDecisions);
  const [isAdding, setIsAdding] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newOptions, setNewOptions] = useState(['', '']);
  const [loading, setLoading] = useState(false);
  const [savingVoteId, setSavingVoteId] = useState<string | null>(null);
  const [importantDecision, setImportantDecision] = useState(false);

  const resolutionLabel = (decision: Decision) => {
    const resolution = decision.resolution;
    if (!resolution) return '';
    if (resolution.adopted) {
      return decision.pollType === 'organizer_approval'
        ? 'Décision approuvée (vote organisateur)'
        : 'Décision adoptée';
    }
    switch (resolution.reason) {
      case 'quorum_missing':
        return resolution.requiredVotes
          ? `Quorum non atteint — ${resolution.requiredVotes} voix requises`
          : 'Quorum non atteint';
      case 'organizer_missing':
        return 'En attente d’un vote organisateur';
      case 'tie':
        return 'Égalité — un vote départageant est requis';
      case 'no_votes':
        return 'Aucun vote exprimé';
      default:
        return 'Décision non adoptée';
    }
  };

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
      lkvAlert('Connectez-vous pour voter.');
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
      lkvAlert('Erreur lors du vote : ' + error.message);
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
      status: 'open',
      poll_type: importantDecision ? 'quorum_majority' : 'simple',
      quorum_threshold: 0.5,
    });

    if (error) {
      console.error(error);
      lkvAlert('Erreur: ' + error.message);
    } else {
      setNewQuestion('');
      setNewOptions(['', '']);
      setIsAdding(false);
      setImportantDecision(false);
      if (onRefresh) onRefresh();
    }
    setLoading(false);
  };

  return (
    <Card className="p-[var(--space-6)] transition-all duration-[var(--motion-control-duration)]">
      <div className="mb-[var(--space-2)] flex items-start justify-between">
        <h2 className="font-display text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)]">
          Décisions <span className="font-serif italic font-normal text-[color:var(--lkv-text-primary)]">en cours</span>
        </h2>
        <div className="flex items-center gap-[var(--space-2)]">
          <Badge>{decisions.length} actifs</Badge>
        </div>
      </div>

      <div className="mb-[var(--space-6)] flex items-center justify-between">
        <span />
        <Button
          variant={isAdding ? 'secondary' : 'primary'}
          size="sm"
          onClick={() => setIsAdding(!isAdding)}
          icon={<Icon name={isAdding ? 'XMarkIcon' : 'PlusIcon'} size={12} aria-hidden="true" />}
        >
          {isAdding ? 'Annuler' : 'Lancer un vote'}
        </Button>
      </div>

      {isAdding && (
        <Card variant="compact" className="mb-[var(--space-8)] p-[var(--space-5)]">
        <form onSubmit={handleCreatePoll} className="space-y-[var(--space-4)]">
          <div>
            <label htmlFor="poll-question" className="mb-[var(--space-2)] block text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-text-primary)]">
              La question à trancher :
            </label>
            <input
              id="poll-question"
              type="text"
              autoFocus
              value={newQuestion}
              onChange={e => setNewQuestion(e.target.value)}
              placeholder="Ex: Quel itinéraire prendre ?"
              className={FIELD_CLASS}
              disabled={loading}
            />
          </div>

          <div className="space-y-[var(--space-3)]">
            <span className="block text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-text-primary)]">
              Les options (minimum 2) :
            </span>
            {newOptions.map((opt, i) => (
              <div key={i} className="flex gap-[var(--space-2)]">
                <input
                  type="text"
                  value={opt}
                  onChange={e => handleOptionChange(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                  aria-label={`Option ${i + 1}`}
                  className={`${FIELD_CLASS} flex-1`}
                  disabled={loading}
                />
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant={importantDecision ? 'primary' : 'secondary'}
            fullWidth
            onClick={() => setImportantDecision(!importantDecision)}
            aria-pressed={importantDecision}
            className="justify-between rounded-[var(--lkv-radius-md)]"
            data-testid="decision-important-toggle"
          >
            <span>Décision importante (quorum requis)</span>
            <span aria-hidden>{importantDecision ? '✓' : '○'}</span>
          </Button>

          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleAddOption}
              disabled={loading}
            >
              + Ajouter une option
            </Button>
            <Button
              type="submit"
              size="sm"
              onClick={handleCreatePoll}
              disabled={!newQuestion.trim() || newOptions.filter(o => o.trim() !== '').length < 2 || loading}
              loading={loading}
            >
              Créer le sondage
            </Button>
          </div>
        </form>
        </Card>
      )}

      <div className="space-y-[var(--space-6)]">
        {decisions.length === 0 && !isAdding && (
          <EmptyState
            compact
            icon={<Icon name="ChatBubbleLeftRightIcon" size={22} aria-hidden="true" />}
            title="Aucun sondage en cours"
            description="Lancez un vote pour trancher les décisions du groupe."
          />
        )}

        {decisions.map(decision => {
          const totalVotes = decision.options.reduce((acc, opt) => acc + (opt.votes || 0), 0);

          return (
          <Card key={decision.id} variant="compact" className="space-y-[var(--space-3)] p-[var(--space-5)]">
            <div className="flex items-center gap-[var(--space-2)]">
              <span className="text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">{decision.author}</span>
              <Badge>{decision.tag}</Badge>
              <span className="ml-auto font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">{decision.meta}</span>
            </div>

            <p className="font-sans text-[length:var(--lkv-text-caption)] leading-relaxed text-[color:var(--lkv-text-primary)]">
              {decision.question}
            </p>

            <div className="space-y-[var(--space-3)]" role="radiogroup" aria-label={decision.question}>
              {decision.options.map(option => {
                const pct = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;

                return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={option.selected}
                  key={option.index}
                  onClick={() => handleVote(decision.id, option.index)}
                  disabled={savingVoteId === decision.id}
                  className={`group relative w-full cursor-pointer overflow-hidden rounded-[var(--lkv-radius-md)] border text-left transition-colors disabled:opacity-[var(--opacity-disabled)] ${
                    option.selected
                      ? 'border-[color:var(--lkv-primary)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset'
                      : 'border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] '
                  }`}
                >
                  <motion.div
                    aria-hidden="true"
                    className={`absolute inset-y-0 left-0 ${option.selected ? 'bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn' : 'bg-[color:var(--btn-tint)] '}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5 }}
                  />

                  <div className="relative z-10 flex items-center justify-between p-[var(--space-3)]">
                    <div className="flex items-center gap-[var(--space-3)]">
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                          option.selected
                            ? 'border-[color:var(--lkv-primary)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[color:var(--lkv-text-primary)]'
                            : 'border-[color:var(--btn-glass-border)] bg-[color:var(--lkv-field-bg)]'
                        }`}
                      >
                        {option.selected && <Icon name="CheckIcon" size={12} aria-hidden="true" />}
                      </span>
                      <p className={`text-[length:var(--lkv-text-caption)] font-semibold ${option.selected ? 'text-[color:var(--lkv-text-primary)]' : 'text-[color:var(--lkv-text-muted)]'}`}>
                        {option.label}
                      </p>
                    </div>
                    <span className={`font-mono text-[length:var(--lkv-text-caption)] font-bold ${option.selected ? 'text-[color:var(--lkv-text-primary)]' : 'text-[color:var(--lkv-text-muted)]'}`}>
                      {pct}%
                    </span>
                  </div>
                </button>
              )})}
            </div>

            {decision.pollType && decision.pollType !== 'simple' && decision.resolution && (
              <p
                className={`font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest ${
                  decision.resolution.adopted ? 'text-[color:var(--lkv-text-primary)]' : 'text-[color:var(--lkv-text-muted)]'
                }`}
                data-testid="decision-resolution"
              >
                {resolutionLabel(decision)}
              </p>
            )}

            <div className="flex items-center justify-between border-t border-[color:var(--lkv-border)] pt-[var(--space-3)] font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-[color:var(--lkv-text-muted)]">
              <span>{totalVotes} votes exprimés</span>
              {savingVoteId === decision.id && <Spinner size="xs" label="Enregistrement du vote" />}
            </div>
          </Card>
        )})}
      </div>
    </Card>
  );
}
