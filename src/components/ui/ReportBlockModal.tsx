"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Modal } from '@/components/ui/Modal';
import { lkvAlert, lkvConfirm } from '@/components/ui/dialogs';
import { REPORT_CATEGORIES } from '@/features/compte/domain/reportCategories';
import {
  blockUser,
  loadModerationState,
  moderationErrorMessage,
  muteContentUser,
  muteUser,
  reportUser,
  unblockUser,
  unmuteContentUser,
  unmuteUser,
  type ModerationState,
} from '@/features/compte/client/moderationClient';

export interface ReportTarget {
  userId: string;
  userName: string;
  groupId?: string;
  groupName?: string;
}

export type SafetyAction =
  | 'report'
  | 'block'
  | 'unblock'
  | 'mute_content'
  | 'unmute_content'
  | 'mute_conversation'
  | 'unmute_conversation'
  // Alias historiques de la sourdine de conversation, conservés pour les
  // appelants qui écoutaient déjà `mute`/`unmute`.
  | 'mute'
  | 'unmute';
type SafetyTab = 'report' | 'block' | 'mute';

interface Props {
  target: ReportTarget | null;
  onClose: () => void;
  onSuccess?: (action: SafetyAction) => void;
}

/**
 * Feuille de sécurité d'un profil : signaler, bloquer/débloquer, masquer les
 * contenus (fil et stories) et couper les notifications de la conversation
 * directe. Les mutations passent par les routes réseau ; le composant ne
 * décide ni d'une suspension, ni d'un droit, et n'écrit jamais directement
 * dans les tables de modération.
 */
export default function ReportBlockModal({ target, onClose, onSuccess }: Props) {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<SafetyTab>('report');
  const [selectedCategory, setSelectedCategory] = useState(REPORT_CATEGORIES[0].id);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [actionDoneMsg, setActionDoneMsg] = useState('');
  const [state, setState] = useState<ModerationState | null>(null);
  const [stateLoading, setStateLoading] = useState(false);
  const [stateError, setStateError] = useState(false);

  useEffect(() => {
    setActiveTab('report');
    setSelectedCategory(REPORT_CATEGORIES[0].id);
    setReason('');
    setSubmitted(false);
    setActionDoneMsg('');
    setState(null);
    setStateError(false);

    if (!user || !target?.userId) {
      setStateLoading(false);
      return;
    }

    let cancelled = false;
    setStateLoading(true);
    void loadModerationState(target.userId)
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch(() => {
        // Un état illisible n'autorise pas à prétendre « non bloqué » ou
        // « non muet » : l'écran le signale et le serveur reste l'autorité.
        if (!cancelled) setStateError(true);
      })
      .finally(() => {
        if (!cancelled) setStateLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [target?.userId, user?.id]);

  if (!target) return null;

  const requireUser = () => {
    if (user) return true;
    lkvAlert('Connectez-vous pour utiliser les actions de sécurité.');
    return false;
  };

  const finish = (message: string, action: SafetyAction) => {
    setSubmitted(true);
    setActionDoneMsg(message);
    onSuccess?.(action);
  };

  const handleReport = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!requireUser()) return;
    setLoading(true);
    try {
      const result = await reportUser(
        target.userId,
        selectedCategory,
        reason,
        target.groupId
      );
      finish(
        result.duplicate
          ? 'Un signalement est déjà en attente pour ce profil. La modération le traitera.'
          : 'Votre signalement a été enregistré. La modération LKDV va l’examiner.',
        'report'
      );
    } catch (error) {
      lkvAlert(moderationErrorMessage(error, 'Le signalement n’a pas pu être enregistré.'));
    } finally {
      setLoading(false);
    }
  };

  const handleBlock = async () => {
    if (!requireUser()) return;
    const alreadyBlocked = state?.blockedByViewer === true;
    const confirmed = await lkvConfirm({
      title: alreadyBlocked
        ? `Débloquer ${target.userName} ?`
        : `Bloquer ${target.userName} ?`,
      message: alreadyBlocked
        ? 'Vous pourrez de nouveau voir son profil et ses contenus publics.'
        : 'Vous ne verrez plus ses demandes, ses contenus et il ne pourra plus vous contacter.',
      confirmLabel: alreadyBlocked ? 'Débloquer' : 'Bloquer',
      variant: alreadyBlocked ? 'default' : 'destructive',
    });
    if (!confirmed) return;
    setLoading(true);
    try {
      if (alreadyBlocked) {
        await unblockUser(target.userId);
        setState((current) => (current ? { ...current, blockedByViewer: false } : current));
        finish(`${target.userName} a été débloqué.`, 'unblock');
      } else {
        await blockUser(target.userId, target.groupId);
        setState((current) => (current ? { ...current, blockedByViewer: true } : current));
        finish(`${target.userName} a été bloqué.`, 'block');
      }
    } catch (error) {
      lkvAlert(moderationErrorMessage(error, 'Le blocage n’a pas pu être enregistré.'));
    } finally {
      setLoading(false);
    }
  };

  const handleContentMute = async () => {
    if (!requireUser()) return;
    const alreadyMuted = state?.mutedContent === true;
    setLoading(true);
    try {
      if (alreadyMuted) {
        await unmuteContentUser(target.userId);
        setState((current) =>
          current ? { ...current, mutedContent: false } : current
        );
        finish(
          `Les publications et les stories de ${target.userName} sont de nouveau visibles.`,
          'unmute_content'
        );
      } else {
        const result = await muteContentUser(target.userId);
        setState((current) =>
          current
            ? {
                ...current,
                mutedContent: result.contentMuted,
              }
            : current
        );
        finish(
          `Les publications et les stories de ${target.userName} sont masquées. Le suivi est conservé.`,
          'mute_content'
        );
      }
    } catch (error) {
      lkvAlert(
        moderationErrorMessage(error, 'La sourdine de contenu n’a pas pu être enregistrée.')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConversationMute = async () => {
    if (!requireUser()) return;
    const alreadyMuted = state?.mutedConversation === true;
    setLoading(true);
    try {
      if (alreadyMuted) {
        await unmuteUser(target.userId);
        setState((current) =>
          current ? { ...current, mutedConversation: false } : current
        );
        finish(
          `Les notifications de la conversation directe avec ${target.userName} sont rétablies.`,
          'unmute_conversation'
        );
      } else {
        const result = await muteUser(target.userId);
        setState((current) =>
          current
            ? {
                ...current,
                mutedConversation: result.conversationMuted,
              }
            : current
        );
        finish(
          `Les notifications de la conversation directe avec ${target.userName} sont coupées.`,
          'mute_conversation'
        );
      }
    } catch (error) {
      lkvAlert(
        moderationErrorMessage(
          error,
          'La sourdine de conversation n’a pas pu être enregistrée.'
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const blocked = state?.blockedByViewer === true;
  const blockedEitherWay =
    state?.blockedByViewer === true || state?.blockedByTarget === true;
  const mutedContent = state?.mutedContent === true;
  const mutedConversation = state?.mutedConversation === true;
  const anyMuted = mutedContent || mutedConversation;
  // Sans état lisible, on laisse le serveur décider. Avec un état connu, la
  // sourdine de contenu n'est proposée que pour un compte réellement suivi.
  const contentMuteUnavailable =
    state != null && !mutedContent && !state.policy.canMuteContent;
  const conversationUnavailable = state?.hasDirectConversation === false;

  return (
    <Modal
      open={Boolean(target)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Sécurité & Signalement"
    >
      <div className="space-y-4">
        <p className="text-xs text-[var(--lkv-text-muted)] -mt-1">
          Membre concerné : <strong className="text-[var(--lkv-text-primary)]">{target.userName}</strong>
        </p>

        {submitted ? (
          <div className="py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] shadow-[var(--btn-rim)] text-[color:var(--lkv-text-primary)] flex items-center justify-center text-xl mx-auto mb-3">✓</div>
            <h4 className="font-bold text-lg mb-2">Action confirmée</h4>
            <p className="text-sm text-white/70 mb-6 max-w-sm mx-auto">{actionDoneMsg}</p>
            <button onClick={onClose} className="px-6 py-2.5 bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] shadow-[var(--btn-rim)] text-[color:var(--lkv-text-primary)] rounded-full font-bold text-xs hover:brightness-[1.05] transition-colors">
              Fermer
            </button>
          </div>
        ) : (
          <div>
            {stateError ? (
              <p className="mb-3 rounded-xl border border-white/10 bg-black/20 p-2.5 text-xs text-white/70" role="status">
                L’état de sécurité de ce profil n’a pas pu être lu. Les actions restent
                envoyées au serveur, qui décidera.
              </p>
            ) : null}

            <div className="flex gap-2 p-1 bg-black/30 rounded-xl mb-5 border border-white/10">
              <button
                type="button"
                onClick={() => setActiveTab('report')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                  activeTab === 'report' ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white'
                }`}
              >
                <span>🚩</span> Signaler
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('block')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                  activeTab === 'block' ? 'bg-red-500/20 text-red-300' : 'text-white/60 hover:text-white'
                }`}
              >
                <span>🚫</span> {blocked ? 'Débloquer' : 'Bloquer'}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('mute')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                  activeTab === 'mute' ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white'
                }`}
              >
                <span>🔕</span> {anyMuted ? 'Réactiver' : 'Sourdine'}
              </button>
            </div>

            {stateLoading ? (
              <p className="mb-3 text-center text-xs text-white/50" role="status">
                Lecture de l’état de sécurité…
              </p>
            ) : null}

            {activeTab === 'report' ? (
              <form onSubmit={handleReport} className="space-y-4">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-white/60 mb-2">Motif du signalement</label>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {REPORT_CATEGORIES.map((cat) => (
                      <label
                        key={cat.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                          selectedCategory === cat.id
                            ? 'bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] shadow-[var(--btn-rim)] border-[color:var(--sage-400)] text-[color:var(--lkv-text-primary)]'
                            : 'bg-black/20 border-white/10 text-[color:var(--lkv-text-primary)]/70 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="reportCat"
                            value={cat.id}
                            checked={selectedCategory === cat.id}
                            onChange={() => setSelectedCategory(cat.id)}
                            className="text-[color:var(--glass-label)] accent-foreground"
                          />
                          <span>{cat.label}</span>
                        </div>
                        {cat.severity === 'grave' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-mono">
                            Priorité haute
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-white/60 mb-1">Détails (Optionnel mais recommandé)</label>
                  <textarea
                    rows={3}
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Expliquez ce qui s'est passé de manière factuelle..."
                    className="w-full bg-black/25 border border-white/15 rounded-xl p-3 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[color:var(--sage-400)] resize-none"
                  ></textarea>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-semibold"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 bg-red-500/80 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Envoi...' : 'Transmettre le signalement'}
                  </button>
                </div>
              </form>
            ) : activeTab === 'block' ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-white/80 space-y-2">
                  <p className="font-bold text-red-300">
                    {blocked ? 'Ce profil est bloqué.' : 'Effet immédiat du blocage :'}
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-white/70">
                    <li>{target.userName} ne pourra plus vous contacter ni demander à vous suivre.</li>
                    <li>Vous ne verrez plus son profil dans vos abonnés, vos suivis et vos demandes.</li>
                    <li>Toute demande de suivi en attente entre vous sera retirée.</li>
                  </ul>
                  {state?.blockedByTarget ? (
                    <p className="text-white/60">
                      Ce profil vous a également bloqué. Le déblocage de votre côté ne rétablit
                      pas son propre blocage.
                    </p>
                  ) : null}
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-semibold"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleBlock}
                    disabled={loading || stateLoading}
                    className={`flex-1 py-2.5 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 ${
                      blocked ? 'bg-white/15 hover:bg-white/20' : 'bg-red-600 hover:bg-red-500'
                    }`}
                  >
                    {loading ? 'Enregistrement...' : blocked ? 'Débloquer ce profil' : 'Confirmer le blocage'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-white/10 border border-white/15 text-xs text-white/80 space-y-2">
                  <p className="font-bold text-white">Sourdine de contenu :</p>
                  <p className="text-white/70">
                    Masque les publications de fil et les stories de {target.userName}.
                    Le suivi est conservé, aucune relation n’est supprimée, et la personne
                    n’est pas notifiée.
                  </p>
                  <p className="text-white/50">
                    Cette préférence reste privée : seul votre compte peut la lire. Elle ne
                    remplace pas le blocage et ne coupe pas les notifications de la
                    conversation directe.
                  </p>
                  {contentMuteUnavailable && !blockedEitherWay ? (
                    <p className="text-white/60">
                      La sourdine de contenu est proposée pour les comptes que vous suivez.
                      Suivez ce compte pour masquer ses publications et ses stories sans
                      perdre le suivi.
                    </p>
                  ) : null}
                  {blockedEitherWay ? (
                    <p className="text-white/60">
                      {state?.blockedByViewer
                        ? 'Vous avez bloqué ce profil : ses contenus sont déjà masqués. Débloquez-le pour régler séparément la sourdine de contenu.'
                        : 'Ce profil vous a bloqué : ses contenus sont déjà masqués. La sourdine de contenu ne peut pas être posée tant que ce blocage existe.'}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleContentMute}
                    disabled={loading || stateLoading || contentMuteUnavailable}
                    className="w-full py-2.5 bg-white/15 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    {loading
                      ? 'Enregistrement...'
                      : mutedContent
                        ? 'Réafficher ses contenus'
                        : 'Masquer ses contenus'}
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-white/10 border border-white/15 text-xs text-white/80 space-y-2">
                  <p className="font-bold text-white">Sourdine de conversation :</p>
                  <p className="text-white/70">
                    Coupe uniquement les notifications de la conversation directe avec{' '}
                    {target.userName}. Aucune publication ni story n’est masquée par ce
                    réglage.
                  </p>
                  {conversationUnavailable ? (
                    <p className="text-white/60">
                      Aucune conversation directe n’existe encore : il n’y a pas de
                      notification à couper. La sourdine de contenu reste réglable pour un
                      compte suivi.
                    </p>
                  ) : (
                    <p className="text-white/50">
                      Le suivi et le signalement restent disponibles ; la conversation
                      n’est pas supprimée.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={handleConversationMute}
                    disabled={
                      loading ||
                      stateLoading ||
                      (!mutedConversation && conversationUnavailable)
                    }
                    className="w-full py-2.5 bg-white/15 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    {loading
                      ? 'Enregistrement...'
                      : mutedConversation
                        ? 'Rétablir les notifications'
                        : 'Couper les notifications'}
                  </button>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-semibold"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
