'use client';

import { useState } from 'react';
import { messagingService } from '@/features/messaging/services/messagingService';
import { shareableConversations, toStageMessageMeta, type ShareConversationChoice } from '../../../messageLink';
import type { CollaborativeStage } from '../../../types';
import { Btn, Note } from '../track/atoms';
import { useRouteWorkspace } from '../WorkspaceContext';

type Phase =
  | { readonly kind: 'closed' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'pick'; readonly choices: ReadonlyArray<ShareConversationChoice> }
  | { readonly kind: 'sending'; readonly choices: ReadonlyArray<ShareConversationChoice> }
  | { readonly kind: 'sent'; readonly label: string }
  | { readonly kind: 'error'; readonly message: string };

/**
 * 8.10 : « Envoyer ce jour dans la messagerie ». Le message est une carte d'étape (`toStageMessageMeta`) qui ouvre
 * ce jour à la réception (`TrailCard`). Seules les conversations de la personne sont proposées (lecture de la
 * messagerie, sous RLS) et l'envoi passe par le service de messagerie existant, comme tout message « trail ».
 * Le lien ne donne aucun droit : l'itinéraire ne s'ouvre que pour qui peut déjà le lire, et le jeton d'un lien de
 * lecture n'est jamais joint.
 */
export function ShareStageToChat({ stage }: { stage: CollaborativeStage }) {
  const { workspace, serverSynced, shareToken, currentUserId } = useRouteWorkspace();
  const [phase, setPhase] = useState<Phase>({ kind: 'closed' });
  const signedIn = currentUserId !== 'guest-local';

  if (shareToken) return null;

  if (!signedIn || !serverSynced) {
    return (
      <Note>
        Envoi dans la messagerie : {signedIn ? 'enregistrez d’abord l’itinéraire dans un voyage' : 'connectez-vous'} pour que la carte puisse l’ouvrir.
      </Note>
    );
  }

  const open = async () => {
    setPhase({ kind: 'loading' });
    try {
      const all = await messagingService.getConversations(currentUserId);
      setPhase({ kind: 'pick', choices: shareableConversations(all) });
    } catch {
      setPhase({ kind: 'error', message: 'Impossible de charger vos conversations.' });
    }
  };

  const send = async (choice: ShareConversationChoice, choices: ReadonlyArray<ShareConversationChoice>) => {
    const meta = toStageMessageMeta(workspace, stage.id);
    if (!meta) {
      setPhase({ kind: 'error', message: 'Cette étape n’existe plus dans l’itinéraire.' });
      return;
    }
    setPhase({ kind: 'sending', choices });
    const sent = await messagingService.sendMessage(
      choice.id,
      currentUserId,
      meta.name,
      'trail',
      undefined,
      meta as unknown as Record<string, unknown>,
    );
    setPhase(sent ? { kind: 'sent', label: choice.label } : { kind: 'error', message: 'Envoi impossible pour l’instant : rien n’a été envoyé.' });
  };

  return (
    <div className="rts-block" data-testid={`share-stage-chat-${stage.id}`}>
      {phase.kind === 'closed' || phase.kind === 'error' || phase.kind === 'sent' ? (
        <Btn testId="share-stage-message" onClick={() => void open()}>
          Envoyer ce jour dans la messagerie
        </Btn>
      ) : null}
      {phase.kind === 'loading' ? <Note>Chargement de vos conversations…</Note> : null}
      {phase.kind === 'pick' || phase.kind === 'sending' ? (
        <>
          <Note>
            Choisissez la conversation. La carte ouvre ce jour pour les personnes qui ont accès à l’itinéraire ; le lien de lecture n’est pas joint.
          </Note>
          {phase.choices.length === 0 ? (
            <Note tone="warn">Aucune conversation active pour l’instant.</Note>
          ) : (
            <div className="rts-actions" role="group" aria-label="Conversation d’envoi" data-testid="share-stage-conversations">
              {phase.choices.map((c) => (
                <Btn
                  key={c.id}
                  testId={`share-stage-to-${c.id}`}
                  disabled={phase.kind === 'sending'}
                  onClick={() => void send(c, phase.choices)}
                >
                  {c.label}
                  {c.kind === 'group' ? ' (groupe)' : ''}
                </Btn>
              ))}
            </div>
          )}
          <Btn onClick={() => setPhase({ kind: 'closed' })}>Annuler</Btn>
        </>
      ) : null}
      {phase.kind === 'sent' ? (
        <Note>
          <span role="status" data-testid="share-stage-sent">Jour {stage.dayNumber} envoyé à {phase.label}.</span>
        </Note>
      ) : null}
      {phase.kind === 'error' ? (
        <Note tone="bad">
          <span role="alert" data-testid="share-stage-error">{phase.message}</span>
        </Note>
      ) : null}
    </div>
  );
}
