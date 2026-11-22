'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Check,
  Flame,
  MessageCircle,
  Mountain,
  Plus,
  QrCode,
  Send,
  ShieldCheck,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { ClubG02Workspace } from '@/components/clubs/g02';
import {
  AnimatedNumber,
  ClubStaggerCard,
  ClubStaggerList,
} from './ClubDrawerMotion';
import { ClubEmptyCard } from './ClubSharedUi';
import type { ClubTribuDrawerBodyProps } from './ClubDrawerTypes';

type ChatChannelId = 'all' | 'covoit' | 'meteo' | 'gear';
type ChallengeFilterId = 'all' | 'dplus' | 'km';

const QUICK_CHAT_TEMPLATES = [
  '🚐 Il me reste 2 places en covoiturage samedi matin !',
  '🏔 Point conditions : crête dégagée, crampons inutiles.',
  '🎒 Équipement dispo au coffre d’entraide pour ce week-end.',
  '📍 RDV confirmé 06h30 au parking relais.',
];

export function ClubTribuDrawerBody({
  activeSubTab,
  active = true,
  activeClub,
  challenges,
  chatMessages,
  members,
  initialChatDraft = '',
  onSendChatMessage,
  onToggleClubVisibility,
  onInspectMember,
  onToast,
  onOpenRuntimeOverlay,
  initialSection = 'salons',
}: ClubTribuDrawerBodyProps) {
  const [chatDraft, setChatDraft] = useState(initialChatDraft);
  const [chatChannel, setChatChannel] = useState<ChatChannelId>('all');
  const [reactions, setReactions] = useState<Record<string, number>>({});
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [charterSigned, setCharterSigned] = useState(true);
  const [showQrMatrix, setShowQrMatrix] = useState(false);

  // D19 — Challenge filter & optimistic contribution boosts
  const [challengeFilter, setChallengeFilter] = useState<ChallengeFilterId>('all');
  const [challengeBoosts, setChallengeBoosts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (initialChatDraft) {
      setChatDraft(initialChatDraft);
    }
  }, [initialChatDraft]);

  const filteredMessages = useMemo(() => {
    if (chatChannel === 'all') return chatMessages;
    return chatMessages.filter((msg) => {
      const lower = msg.text.toLowerCase();
      if (chatChannel === 'covoit') return lower.includes('covoit') || lower.includes('place') || lower.includes('van') || lower.includes('rdv');
      if (chatChannel === 'meteo') return lower.includes('météo') || lower.includes('meteo') || lower.includes('crête') || lower.includes('neige') || lower.includes('vent');
      if (chatChannel === 'gear') return lower.includes('coffre') || lower.includes('tente') || lower.includes('dva') || lower.includes('kit') || lower.includes('sac');
      return true;
    });
  }, [chatMessages, chatChannel]);

  // ============================================================================
  // D20 — 4.1 TRIBU-CHAT ("Canal live de la tribu")
  // ============================================================================
  if (activeSubTab === 1) {
    const displayedMessages = filteredMessages.length > 0 ? filteredMessages : chatMessages;

    return (
      <div className="club-drawer-pane-content club-chat-pane" data-testid="club-tribu-chat-pane">
        <div className="club-sec-head">
          <div className="club-sec-head-titles">
            <span className="club-sec-eyebrow">Canal live · {chatMessages.length} messages</span>
            <b className="club-sec-title">Canal Live · {activeClub.name}</b>
          </div>
          <span className="club-badge-sage">En direct</span>
        </div>

        {/* Channel topic pills */}
        <div className="club-form-pills" role="tablist" aria-label="Salons rapides du canal">
          {(
            [
              { id: 'all', label: '#général' },
              { id: 'covoit', label: '#covoiturage' },
              { id: 'meteo', label: '#météo-terrain' },
              { id: 'gear', label: '#matériel' },
            ] as const
          ).map((ch) => (
            <button
              key={ch.id}
              type="button"
              role="tab"
              aria-selected={chatChannel === ch.id}
              className={`reseau-btn ${chatChannel === ch.id ? 'primary' : 'active'}`}
              onClick={() => setChatChannel(ch.id)}
            >
              {ch.label}
            </button>
          ))}
        </div>

        <div className="club-chat-messages">
          {displayedMessages.length === 0 ? (
            <ClubEmptyCard
              icon={<MessageCircle size={22} />}
              title="Aucun message dans ce canal pour le moment."
              description="Lancez la discussion pour coordonner les prochains départs et le covoiturage."
            />
          ) : (
            displayedMessages.map((msg) => {
              const reactCount = reactions[msg.id] ?? 0;
              const matchedMember = members.find(
                (m) => m.handle === msg.authorHandle || m.name === msg.authorName,
              );
              return (
                <div key={msg.id} className="lkdv-comment-row club-glass-card">
                  <span className="lkdv-comment-av" aria-hidden="true">
                    {msg.authorName.charAt(0)}
                  </span>
                  <div className="lkdv-comment-body" style={{ flex: 1 }}>
                    <div className="lkdv-comment-meta">
                      <b
                        style={{ cursor: matchedMember && onInspectMember ? 'pointer' : 'default' }}
                        onClick={() => {
                          if (matchedMember && onInspectMember) {
                            onInspectMember(matchedMember);
                          }
                        }}
                      >
                        {msg.authorName}
                      </b>
                      {msg.roleBadge ? <span className="club-badge-sage">{msg.roleBadge}</span> : null}
                      <span>{msg.time}</span>
                    </div>
                    <p className="lkdv-comment-text">{msg.text}</p>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <button
                        type="button"
                        className="reseau-btn active"
                        style={{ fontSize: 10.5, padding: '2px 7px' }}
                        onClick={() =>
                          setReactions((prev) => ({
                            ...prev,
                            [msg.id]: (prev[msg.id] ?? 0) + 1,
                          }))
                        }
                        aria-label={`Réagir au message de ${msg.authorName}`}
                      >
                        🏔 {reactCount > 0 ? reactCount : 'Bravo'}
                      </button>
                      <button
                        type="button"
                        className="reseau-btn active"
                        style={{ fontSize: 10.5, padding: '2px 7px' }}
                        onClick={() => setChatDraft(`@${msg.authorHandle} `)}
                      >
                        Répondre
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Quick template chips */}
        <div
          className="club-form-pills"
          data-hscroll="true"
          style={{ flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: 4 }}
        >
          {QUICK_CHAT_TEMPLATES.map((tpl, idx) => (
            <button
              key={idx}
              type="button"
              className="reseau-btn active"
              style={{ fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0 }}
              onClick={() => setChatDraft(tpl)}
            >
              {tpl.slice(0, 32)}…
            </button>
          ))}
        </div>

        <form
          className="lkdv-comments-composer lkdv-comments-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!chatDraft.trim()) return;
            onSendChatMessage(chatDraft.trim());
            onToast?.({
              title: 'Message envoyé à la cordée',
              subtitle: activeClub.name,
            });
            setChatDraft('');
          }}
        >
          <input
            type="text"
            className="lkdv-comments-input"
            placeholder={`Écrire à la cordée ${activeClub.name}…`}
            aria-label="Message au canal du club"
            value={chatDraft}
            onChange={(e) => setChatDraft(e.target.value)}
          />
          <button
            type="submit"
            className="lkdv-comments-send"
            aria-label="Envoyer au canal"
            disabled={!chatDraft.trim()}
          >
            <Send size={15} aria-hidden="true" />
          </button>
        </form>
      </div>
    );
  }

  // ============================================================================
  // D21 — 4.2 TRIBU-GOV ("Charte, gouvernance et QR Code")
  // ============================================================================
  if (activeSubTab === 2) {
    const guidesAndAdmins = members.filter(
      (m) => m.role === 'Fondateur' || m.role === 'Guide & Sécurité' || m.role === 'Encadrant',
    );

    return (
      <div className="club-drawer-pane-content" data-testid="club-tribu-gov-pane">
        <div className="club-sec-head">
          <div className="club-sec-head-titles">
            <span className="club-sec-eyebrow">Gouvernance · {activeClub.role}</span>
            <b className="club-sec-title">Charte, Gouvernance & QR Code Terrain</b>
          </div>
          <span className="club-badge-sage">{charterSigned ? 'Charte signée ✓' : 'À signer'}</span>
        </div>

        <div
          className="li nt club-glass-card"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <div className="ttl">
              <b>Charte & Sécurité du Club</b>
            </div>
            <button
              type="button"
              className={`reseau-btn ${charterSigned ? 'active' : 'primary'}`}
              style={{ fontSize: 11.5 }}
              onClick={() => {
                setCharterSigned((v) => !v);
                onToast?.({
                  title: charterSigned ? 'Signature charte retirée' : 'Charte & Sécurité approuvée ✓',
                  subtitle: activeClub.name,
                });
              }}
            >
              {charterSigned ? 'Engagement signé ✓' : 'Signer la charte'}
            </button>
          </div>
          <div className="s2">{activeClub.charter}</div>
        </div>

        <div className="li nt club-glass-card">
          <div>
            <div className="ttl">
              <span>Visibilité & Mode d’adhésion</span>
            </div>
            <div className="s2">
              {activeClub.visibility === 'public'
                ? 'Public · Tout voyageur LKDV peut rejoindre'
                : 'Sur cooptation · Validation par les encadrants'}
            </div>
          </div>
          <button
            type="button"
            className="reseau-btn active"
            onClick={() => {
              onToggleClubVisibility();
              onToast?.({
                title: 'Visibilité du club mise à jour',
                subtitle: activeClub.visibility === 'public' ? 'Passé en Privé' : 'Passé en Public',
              });
            }}
          >
            {activeClub.visibility === 'public' ? 'Public' : 'Privé'}
          </button>
        </div>

        {/* Council of Guides & Referents */}
        {guidesAndAdmins.length > 0 ? (
          <div
            className="li nt club-glass-card"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}
          >
            <div className="ttl">
              <b>Conseil d’Encadrement & Sécurité ({guidesAndAdmins.length})</b>
            </div>
            <div className="club-skill-tags">
              {guidesAndAdmins.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="club-skill-tag"
                  style={{ cursor: 'pointer', border: 'none' }}
                  onClick={() => onInspectMember?.(g)}
                >
                  🛡️ {g.name} ({g.role})
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div
          className="li nt club-glass-card"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 8 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <QrCode size={28} color="#17402C" aria-hidden="true" />
              <div>
                <div className="ttl">
                  <span>Pass QR Terrain · {activeClub.name}</span>
                </div>
                <div className="s2">Scan bivouac / refuge pour rejoindre la cordée</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className="reseau-btn active"
                style={{ fontSize: 11.5 }}
                onClick={() => setShowQrMatrix((v) => !v)}
              >
                {showQrMatrix ? 'Masquer QR' : 'Afficher QR'}
              </button>
              {onOpenRuntimeOverlay ? (
                <button
                  type="button"
                  className="reseau-btn active"
                  style={{ fontSize: 11.5 }}
                  onClick={() => onOpenRuntimeOverlay('seal')}
                >
                  Sceau
                </button>
              ) : null}
              <button
                type="button"
                className="reseau-btn primary club-icon-pill"
                onClick={async () => {
                  try {
                    const url = `${typeof window !== 'undefined' ? window.location.origin : 'https://lkdv.app'}/clubs/${activeClub.slug || activeClub.id}`;
                    await navigator.clipboard?.writeText(url);
                    setCopiedInvite(true);
                    onToast?.({
                      title: 'Lien Pass QR Terrain copié ✓',
                      subtitle: url,
                    });
                    window.setTimeout(() => setCopiedInvite(false), 2000);
                  } catch {
                    // ignore
                  }
                }}
                aria-label={copiedInvite ? 'Copié' : 'Copier le lien QR'}
                title={copiedInvite ? 'Copié' : 'Copier le lien QR'}
              >
                {copiedInvite ? <Check size={16} aria-hidden="true" /> : <QrCode size={16} aria-hidden="true" />}
              </button>
            </div>
          </div>

          {showQrMatrix ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: 10,
                borderRadius: 14,
                background: 'rgba(255,255,255,0.78)',
                border: '1px solid rgba(23,43,36,0.08)',
              }}
            >
              <svg width="64" height="64" viewBox="0 0 64 64" aria-label="QR Code du club">
                <rect width="64" height="64" rx="8" fill="#FBFAF6" />
                <rect x="6" y="6" width="18" height="18" rx="3" fill="none" stroke="#17402C" strokeWidth="3" />
                <rect x="11" y="11" width="8" height="8" fill="#17402C" />
                <rect x="40" y="6" width="18" height="18" rx="3" fill="none" stroke="#17402C" strokeWidth="3" />
                <rect x="45" y="11" width="8" height="8" fill="#17402C" />
                <rect x="6" y="40" width="18" height="18" rx="3" fill="none" stroke="#17402C" strokeWidth="3" />
                <rect x="11" y="45" width="8" height="8" fill="#17402C" />
                <rect x="28" y="28" width="8" height="8" rx="2" fill="#17402C" />
                <rect x="40" y="40" width="6" height="6" fill="#17402C" />
                <rect x="50" y="46" width="8" height="8" fill="#17402C" />
              </svg>
              <div className="s2">
                <b>Pass Terrain Hors-Ligne</b>
                <br />
                Code club : <code>{(activeClub.slug || activeClub.id).toUpperCase()}</code>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // ============================================================================
  // D22 — 4.3 TRIBU-G02 ("Pont Salons, classement, invitations & défis")
  // ============================================================================
  if (activeSubTab === 3) {
    return (
      <div className="club-drawer-pane-content" data-testid="club-tribu-g02-bridge">
        <div className="club-sec-head" style={{ marginBottom: 6 }}>
          <div className="club-sec-head-titles">
            <span className="club-sec-eyebrow">Espace Tribu & Communauté · {activeClub.name}</span>
            <b className="club-sec-title">Salons, Classements, Invitations & Défis</b>
          </div>
          <span className="club-badge-sage">{activeClub.membersCount} membres</span>
        </div>
        {active ? <ClubG02Workspace clubId={activeClub.id} initialSection={initialSection} /> : null}
      </div>
    );
  }

  // ============================================================================
  // D19 — 4.0 TRIBU-CHALLENGES ("Défis collectifs et sommets")
  // ============================================================================
  const filteredChallenges = challenges.filter((ch) => {
    if (challengeFilter === 'all') return true;
    const u = ch.unit.toLowerCase();
    if (challengeFilter === 'dplus') return u.includes('m') || u.includes('d+');
    if (challengeFilter === 'km') return u.includes('km');
    return true;
  });

  return (
    <div className="club-drawer-pane-content" data-testid="club-tribu-challenges-pane">
      <div className="club-sec-head">
        <div className="club-sec-head-titles">
          <span className="club-sec-eyebrow">Défis collectifs</span>
          <b className="club-sec-title">Défis Collectifs & Empreinte du Club</b>
        </div>
        <span className="club-badge-soft">
          <AnimatedNumber value={activeClub.totalKm} /> km · +<AnimatedNumber value={activeClub.totalDplus} /> m D+
        </span>
      </div>

      <div className="club-form-pills" role="tablist" aria-label="Filtres des défis">
        {(
          [
            { id: 'all', label: `Tous (${challenges.length})` },
            { id: 'dplus', label: 'Dénivelé D+ & Sommets' },
            { id: 'km', label: 'Distance & Traversées' },
          ] as const
        ).map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={challengeFilter === f.id}
            className={`reseau-btn ${challengeFilter === f.id ? 'primary' : 'active'}`}
            onClick={() => setChallengeFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filteredChallenges.length === 0 ? (
        <ClubEmptyCard
          icon={<Trophy size={22} />}
          title="Aucun défi actif pour le moment."
          description="Les défis collectifs d’altitude et de distance du club apparaîtront ici."
        />
      ) : (
        <ClubStaggerList style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredChallenges.map((ch) => {
            const boost = challengeBoosts[ch.id] ?? 0;
            const currentVal = ch.current + boost;
            const pct = Math.min(100, Math.round((currentVal / Math.max(1, ch.target)) * 100));
            const stepIncrement = ch.unit.toLowerCase().includes('km') ? 12 : 450;

            return (
              <ClubStaggerCard
                key={ch.id}
                className="li nt club-glass-card"
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 6 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <b style={{ fontSize: 13, color: 'var(--label)' }}>{ch.title}</b>
                  <span className="club-badge-sage">{ch.rewardBadge}</span>
                </div>
                <div className="s2">{ch.subtitle}</div>
                <div className="club-progress-track" aria-label={`${pct}% complété`}>
                  <div className="club-progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="s2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>
                    {currentVal.toLocaleString('fr-FR')} / {ch.target.toLocaleString('fr-FR')} {ch.unit}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <b>{pct}%</b>
                    <button
                      type="button"
                      className="reseau-btn active"
                      style={{ fontSize: 11, padding: '2px 8px' }}
                      onClick={() => {
                        setChallengeBoosts((prev) => ({
                          ...prev,
                          [ch.id]: (prev[ch.id] ?? 0) + stepIncrement,
                        }));
                        onToast?.({
                          title: `Contribution ajoutée (+${stepIncrement} ${ch.unit}) ✓`,
                          subtitle: ch.title,
                          undo: () =>
                            setChallengeBoosts((prev) => ({
                              ...prev,
                              [ch.id]: Math.max(0, (prev[ch.id] ?? 0) - stepIncrement),
                            })),
                        });
                      }}
                    >
                      +{stepIncrement} {ch.unit}
                    </button>
                  </div>
                </div>
              </ClubStaggerCard>
            );
          })}
        </ClubStaggerList>
      )}
    </div>
  );
}

export default ClubTribuDrawerBody;
