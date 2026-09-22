'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Icon from '@/components/ui/AppIcon';
import Image from 'next/image';
import Link from 'next/link';
import CarnetVerticalTabs from '@/components/carnets/CarnetVerticalTabs';
import CarnetHubHero from '@/components/carnets/CarnetHubHero';
import CarnetHubCard from '@/components/carnets/CarnetHubCard';
import CarnetRightSidebar from '@/components/carnets/CarnetRightSidebar';
import { createClient } from '@/lib/supabase/client';
import { requestCarnetPublicationAward } from '@/lib/progression-award-requests';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';
import { useAuth } from '@/contexts/AuthContext';
import CommentItem from '@/components/communaute/CommentItem';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import MobileCarnetsHub from '@/components/carnets/MobileCarnetsHub';
import CompteBackground from '@/components/compte/CompteBackground';
import { MarbleZone } from '@/components/glass/MarbleZone';
import { SkeletonCarnetCard } from '@/components/ui/Skeleton';
import {
  Badge,
  Button,
  Card,
  Chip,
  ConfirmDialog,
  EmptyState,
  IconButton,
  LoadingState,
  Modal,
  SearchField,
  Switch,
} from '@/components/ui';

interface Carnet {
  id: string;
  author_id: string;
  title: string;
  destination: string;
  description: string;
  cover_image: string;
  cover_image_alt: string;
  start_date: string | null;
  end_date: string | null;
  weather: string;
  route_rating: number;
  visibility: 'public' | 'private' | 'friends';
  tags: string[];
  map_points: MapPoint[];
  is_collaborative: boolean;
  likes_count: number;
  comments_count: number;
  favorites_count: number;
  views_count: number;
  verified: boolean;
  created_at: string;
  author?: { full_name: string; avatar_url: string; trust_score: number };
  user_liked?: boolean;
  user_favorited?: boolean;
  user_reaction?: string;
}

interface MapPoint {
  lat: number;
  lng: number;
  label: string;
  day?: number;
}

interface Comment {
  id: string;
  carnet_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author?: { full_name: string; avatar_url: string };
}

interface CarnetForm {
  title: string;
  destination: string;
  description: string;
  cover_image: string;
  start_date: string;
  end_date: string;
  weather: string;
  route_rating: number;
  visibility: 'public' | 'private' | 'friends';
  tags: string;
  is_collaborative: boolean;
}

const EMPTY_FORM: CarnetForm = {
  title: '',
  destination: '',
  description: '',
  cover_image: '',
  start_date: '',
  end_date: '',
  weather: '',
  route_rating: 8,
  visibility: 'private',
  tags: '',
  is_collaborative: false,
};

const VISIBILITY_OPTS = [
  { value: 'public', label: '🌍 Public', desc: 'Visible par tous' },
  { value: 'friends', label: '👥 Amis', desc: 'Visible par vos abonnés' },
  { value: 'private', label: '🔒 Privé', desc: 'Visible uniquement par vous' },
];

const REACTION_OPTS = [
  { key: 'useful', emoji: '🎒', label: 'Utile' },
  { key: 'security', emoji: '🛡️', label: 'Sécurité' },
  { key: 'bag', emoji: '⚖️', label: 'Léger' },
  { key: 'fire', emoji: '🔥', label: 'Incroyable' },
  { key: 'heart', emoji: '❤️', label: 'Coup de cœur' },
];

const FIELD_CLASS =
  'w-full rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-primary)] placeholder:text-[color:var(--lkv-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lkv-focus-ring)]';

const LABEL_CLASS = 'mb-[var(--space-1)] block font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-wider text-[color:var(--lkv-text-muted)]';

function CarnetModal({
  open,
  onClose,
  onSave,
  initial,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (form: CarnetForm) => void;
  initial?: CarnetForm;
  saving: boolean;
}) {
  const [form, setForm] = useState<CarnetForm>(initial ?? EMPTY_FORM);
  useEffect(() => { setForm(initial ?? EMPTY_FORM); }, [initial, open]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const set = (k: keyof CarnetForm, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal
      open={open}
      onOpenChange={(next) => { if (!next) onClose(); }}
      title={initial ? 'Modifier le carnet' : "Nouveau carnet d'expédition"}
      size="lg"
      loading={saving}
      footer={
        <div className="flex w-full gap-[var(--space-3)]">
          <Button variant="secondary" onClick={onClose} className="flex-1" disabled={saving}>
            Annuler
          </Button>
          <Button
            onClick={() => onSave(form)}
            disabled={saving || !form.title.trim() || !form.destination.trim()}
            loading={saving}
            className="flex-1"
          >
            {saving ? 'Enregistrement...' : initial ? 'Mettre à jour' : 'Publier le carnet'}
          </Button>
        </div>
      }
    >
      <div className="space-y-[var(--space-5)]">
        <div>
          <label htmlFor="carnet-modal-title" className={LABEL_CLASS}>Titre *</label>
          <input id="carnet-modal-title" className={FIELD_CLASS} placeholder="Ex: Circuit des Annapurnas — 18 jours" value={form.title} onChange={(e) => set('title', e.target.value)} />
        </div>
        <div>
          <label htmlFor="carnet-modal-destination" className={LABEL_CLASS}>Destination *</label>
          <input id="carnet-modal-destination" className={FIELD_CLASS} placeholder="Ex: Népal, Corse, Islande..." value={form.destination} onChange={(e) => set('destination', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-[var(--space-4)]">
          <div>
            <label htmlFor="carnet-modal-start" className={LABEL_CLASS}>Date de départ</label>
            <input id="carnet-modal-start" type="date" className={FIELD_CLASS} value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />
          </div>
          <div>
            <label htmlFor="carnet-modal-end" className={LABEL_CLASS}>Date de retour</label>
            <input id="carnet-modal-end" type="date" className={FIELD_CLASS} value={form.end_date} onChange={(e) => set('end_date', e.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor="carnet-modal-description" className={LABEL_CLASS}>Description</label>
          <textarea id="carnet-modal-description" rows={4} className={`${FIELD_CLASS} resize-none`} placeholder="Décrivez votre expédition, les conditions, les moments forts..." value={form.description} onChange={(e) => set('description', e.target.value)} />
        </div>
        <div>
          <label htmlFor="carnet-modal-cover" className={LABEL_CLASS}>URL de la photo de couverture</label>
          <input id="carnet-modal-cover" className={FIELD_CLASS} placeholder="https://..." value={form.cover_image} onChange={(e) => set('cover_image', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-[var(--space-4)]">
          <div>
            <label htmlFor="carnet-modal-weather" className={LABEL_CLASS}>Météo</label>
            <input id="carnet-modal-weather" className={FIELD_CLASS} placeholder="Ex: Ensoleillé, tempête J5..." value={form.weather} onChange={(e) => set('weather', e.target.value)} />
          </div>
          <div>
            <label htmlFor="carnet-modal-rating" className={LABEL_CLASS}>Note parcours ({form.route_rating}/10)</label>
            <input id="carnet-modal-rating" type="range" min={1} max={10} step={0.1} className="mt-[var(--space-2)] w-full accent-[var(--lkv-primary)]" value={form.route_rating} onChange={(e) => set('route_rating', parseFloat(e.target.value))} />
          </div>
        </div>
        <div>
          <label htmlFor="carnet-modal-tags" className={LABEL_CLASS}>Tags (séparés par des virgules)</label>
          <input id="carnet-modal-tags" className={FIELD_CLASS} placeholder="himalaya, autonomie, haute-altitude..." value={form.tags} onChange={(e) => set('tags', e.target.value)} />
        </div>
        <div>
          <span className={`${LABEL_CLASS} mb-[var(--space-2)]`}>Visibilité</span>
          <div className="grid grid-cols-3 gap-[var(--space-2)]">
            {VISIBILITY_OPTS.map((opt) => (
              <Chip
                key={opt.value}
                selected={form.visibility === opt.value}
                onClick={() => set('visibility', opt.value)}
                className="h-auto flex-col items-start justify-start gap-[var(--space-1)] px-[var(--space-3)] py-[var(--space-2)]"
              >
                <span className="text-[length:var(--lkv-text-caption-2)] font-semibold">{opt.label}</span>
                <span className="text-[length:var(--lkv-text-caption-2)] font-normal">{opt.desc}</span>
              </Chip>
            ))}
          </div>
        </div>
        <Card variant="compact" className="flex items-center justify-between">
          <div>
            <p className="text-[length:var(--lkv-text-caption-2)] font-semibold text-[color:var(--lkv-text-primary)]">Carnet collaboratif</p>
            <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Permettre à d&apos;autres membres de contribuer</p>
          </div>
          <Switch
            checked={form.is_collaborative}
            onCheckedChange={(checked) => set('is_collaborative', checked)}
            aria-label="Carnet collaboratif"
          />
        </Card>
      </div>
    </Modal>
  );
}

function CarnetDetailModal({
  carnet,
  onClose,
  onEdit,
  onDelete,
  onLike,
  onFavorite,
  onCommentCountChange,
  currentUserId,
}: {
  carnet: Carnet | null;
  onClose: () => void;
  onEdit: (c: Carnet) => void;
  onDelete: (c: Carnet) => void;
  onLike: (c: Carnet, reaction: string) => void;
  onFavorite: (c: Carnet) => void;
  onCommentCountChange: (carnetId: string, delta: number) => void;
  currentUserId?: string;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [commentCount, setCommentCount] = useState(carnet?.comments_count ?? 0);
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    setCommentCount(carnet?.comments_count ?? 0);
  }, [carnet?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!carnet) return;
    setLoadingComments(true);

    supabase.from('carnet_views').insert({
      carnet_id: carnet.id,
      user_id: user?.id || null,
    }).then(undefined, () => {});

    supabase
      .from('carnet_comments')
      .select('id, carnet_id, author_id, content, created_at')
      .eq('carnet_id', carnet.id)
      .order('created_at', { ascending: true })
      .then(async ({ data }) => {
        const rows = (data as unknown as Array<Omit<Comment, 'author'>>) ?? [];
        const profiles = await fetchPublicProfilesWith(supabase, rows.map((r) => r.author_id));
        const list = rows.map((r) => ({
          ...r,
          author: profiles[r.author_id]
            ? {
                full_name: profiles[r.author_id].full_name ?? '',
                avatar_url: profiles[r.author_id].avatar_url ?? '',
              }
            : undefined,
        })) as Comment[];
        setComments(list);
        setLoadingComments(false);
        const diff = list.length - (carnet.comments_count ?? 0);
        if (diff !== 0) onCommentCountChange(carnet.id, diff);
      });
  }, [carnet, supabase, user?.id, onCommentCountChange]);

  const handleSubmitComment = async () => {
    if (!user || !carnet || !newComment.trim()) return;
    setSubmitting(true);
    const { data } = await supabase
      .from('carnet_comments')
      .insert({ carnet_id: carnet.id, author_id: user.id, content: newComment.trim() })
      .select('id, carnet_id, author_id, content, created_at')
      .single();
    if (data) {
      const row = data as unknown as Omit<Comment, 'author'>;
      const profiles = await fetchPublicProfilesWith(supabase, [row.author_id]);
      const profile = profiles[row.author_id];
      setComments((prev) => [
        ...prev,
        {
          ...row,
          author: profile
            ? { full_name: profile.full_name ?? '', avatar_url: profile.avatar_url ?? '' }
            : undefined,
        } as Comment,
      ]);
      setCommentCount((prev) => prev + 1);
      onCommentCountChange(carnet.id, 1);
    }
    setNewComment('');
    setSubmitting(false);
  };

  const isOwner = currentUserId === carnet?.author_id;
  const durationDays = carnet?.start_date && carnet?.end_date
    ? Math.ceil((new Date(carnet.end_date).getTime() - new Date(carnet.start_date).getTime()) / 86400000)
    : null;

  return (
    <Modal
      open={!!carnet}
      onOpenChange={(next) => { if (!next) onClose(); }}
      title={carnet?.title ?? 'Carnet'}
      size="lg"
      hideTitle
    >
      {!carnet ? null : (
        <div className="space-y-[var(--space-6)]">
          <div className="relative h-64 overflow-hidden rounded-[var(--lkv-radius-md)] bg-[color:var(--btn-tint)]">
            {carnet.cover_image ? (
              <Image src={carnet.cover_image} alt={carnet.cover_image_alt || carnet.title} fill className="object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-6xl" aria-hidden>🗺️</div>
            )}
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

            <div className="absolute left-[var(--space-4)] top-[var(--space-4)] flex flex-wrap gap-[var(--space-2)]">
              {carnet.verified && <Badge tone="sage" className="font-bold">✓ Ajouter</Badge>}
              {carnet.is_collaborative && <Badge tone="info" className="font-bold">👥 Collaboratif</Badge>}
              <Badge className="border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] font-bold text-[color:var(--lkv-text-inverted)] backdrop-blur-[var(--blur-md)]">
                {carnet.visibility === 'public' ? '🌍 Public' : carnet.visibility === 'friends' ? '👥 Amis' : '🔒 Privé'}
              </Badge>
            </div>
            <div className="absolute right-[var(--space-4)] top-[var(--space-4)] flex gap-[var(--space-2)]">
              {isOwner && (
                <>
                  <IconButton variant="glass" onClick={() => { onClose(); onEdit(carnet); }} aria-label="Modifier le carnet">
                    <Icon name="PencilIcon" size={15} aria-hidden="true" />
                  </IconButton>
                  <IconButton variant="glass" onClick={() => { onClose(); onDelete(carnet); }} aria-label="Supprimer le carnet" className="text-[color:var(--lkv-danger)]">
                    <Icon name="TrashIcon" size={15} aria-hidden="true" />
                  </IconButton>
                </>
              )}
              <IconButton variant="glass" onClick={onClose} aria-label="Fermer">
                <Icon name="XMarkIcon" size={18} aria-hidden="true" />
              </IconButton>
            </div>

            <div className="absolute bottom-[var(--space-5)] left-[var(--space-5)] right-[var(--space-5)]">
              <p className="mb-[var(--space-1)] font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-wider text-[color:var(--lkv-text-inverted)]">{carnet.destination}</p>
              <h2 className="mb-[var(--space-2)] font-display text-[length:var(--lkv-text-title-sm)] font-extrabold leading-tight text-[color:var(--lkv-text-inverted)]">{carnet.title}</h2>
              <div className="flex items-center gap-[var(--space-3)]">
                {carnet.author_id ? (
                  <Link href={`/profil/${carnet.author_id}`} className="flex items-center gap-[var(--space-2)] transition-opacity hover:opacity-80">
                    <span className="flex h-7 w-7 items-center justify-center rounded-[var(--lkv-radius-md)] bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">
                      {carnet.author?.full_name?.[0] ?? '?'}
                    </span>
                    <span className="text-[length:var(--lkv-text-caption)] font-medium text-[color:var(--lkv-text-inverted)]/80">{carnet.author?.full_name ?? 'Anonyme'}</span>
                  </Link>
                ) : (
                  <>
                    <span className="flex h-7 w-7 items-center justify-center rounded-[var(--lkv-radius-md)] bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">
                      {carnet.author?.full_name?.[0] ?? '?'}
                    </span>
                    <span className="text-[length:var(--lkv-text-caption)] font-medium text-[color:var(--lkv-text-inverted)]/80">{carnet.author?.full_name ?? 'Anonyme'}</span>
                  </>
                )}
                <span aria-hidden className="text-[color:var(--lkv-text-inverted)]/40">·</span>
                <span className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-inverted)]/60">{new Date(carnet.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-5 divide-x divide-[color:var(--lkv-border)] border-y border-[color:var(--lkv-border)]">
            {[
              { label: 'Note', value: `${carnet.route_rating}/10`, icon: '⭐' },
              { label: 'Durée', value: durationDays ? `${durationDays}j` : '—', icon: '📅' },
              { label: 'Vues', value: carnet.views_count ?? 0, icon: '👁️' },
              { label: 'Réactions', value: carnet.likes_count, icon: '🎒' },
              { label: 'Favoris', value: carnet.favorites_count, icon: '🔖' },
            ].map((s) => (
              <div key={s.label} className="p-[var(--space-3)] text-center">
                <p className="mb-[var(--space-1)] text-[length:var(--lkv-text-caption)]" aria-hidden>{s.icon}</p>
                <p className="font-display text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">{s.value}</p>
                <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="space-y-[var(--space-6)]">
            {(carnet.start_date || carnet.end_date) && (
              <div className="flex items-center gap-[var(--space-4)] rounded-[var(--lkv-radius-md)] bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn p-[var(--space-4)]">
                <Icon name="CalendarDaysIcon" size={20} className="shrink-0 text-[color:var(--lkv-text-inverted)]" aria-hidden="true" />
                <div className="flex flex-wrap items-center gap-[var(--space-4)] text-[length:var(--lkv-text-caption)]">
                  {carnet.start_date && (
                    <div>
                      <p className="text-[length:var(--lkv-text-caption-2)] uppercase tracking-wider text-[color:var(--lkv-text-inverted)]/40">Départ</p>
                      <p className="font-semibold text-[color:var(--lkv-text-inverted)]">{new Date(carnet.start_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                  )}
                  {carnet.start_date && carnet.end_date && (
                    <div aria-hidden className="text-[length:var(--lkv-text-title-sm)] text-[color:var(--lkv-text-inverted)]/30">→</div>
                  )}
                  {carnet.end_date && (
                    <div>
                      <p className="text-[length:var(--lkv-text-caption-2)] uppercase tracking-wider text-[color:var(--lkv-text-inverted)]/40">Retour</p>
                      <p className="font-semibold text-[color:var(--lkv-text-inverted)]">{new Date(carnet.end_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                  )}
                  {durationDays && (
                    <div className="ml-auto">
                      <p className="text-[length:var(--lkv-text-caption-2)] uppercase tracking-wider text-[color:var(--lkv-text-inverted)]/40">Durée</p>
                      <p className="font-mono text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-inverted)]">{durationDays}j</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {carnet.description && (
              <div>
                <p className="mb-[var(--space-3)] font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-wider text-[color:var(--lkv-text-muted)]">Récit d&apos;expédition</p>
                <p className="whitespace-pre-line text-[length:var(--lkv-text-caption)] leading-relaxed text-[color:var(--lkv-text-primary)]">{carnet.description}</p>
              </div>
            )}

            {carnet.weather && (
              <Card variant="compact" className="flex items-start gap-[var(--space-3)]">
                <Icon name="CloudIcon" size={18} className="mt-[2px] shrink-0 text-[color:var(--lkv-text-muted)]" aria-hidden="true" />
                <div>
                  <p className="mb-[var(--space-1)] font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-wider text-[color:var(--lkv-text-muted)]">Conditions météo</p>
                  <p className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-primary)]">{carnet.weather}</p>
                </div>
              </Card>
            )}

            {carnet.map_points?.length > 0 && (
              <div>
                <p className="mb-[var(--space-3)] font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-wider text-[color:var(--lkv-text-muted)]">Points d&apos;étape</p>
                <div className="space-y-[var(--space-2)]">
                  {carnet.map_points.map((point, i) => (
                    <Card key={i} variant="compact" className="flex items-center gap-[var(--space-3)]">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--lkv-radius-md)] bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">
                        {point.day ?? i + 1}
                      </span>
                      <div className="flex-1">
                        <p className="text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-text-primary)]">{point.label}</p>
                        {point.lat != null && point.lng != null && (
                          <p className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">{point.lat.toFixed(4)}, {point.lng.toFixed(4)}</p>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {carnet.tags?.length > 0 && (
              <div>
                <p className="mb-[var(--space-2)] font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-wider text-[color:var(--lkv-text-muted)]">Tags</p>
                <div className="flex flex-wrap gap-[var(--space-2)]">
                  {carnet.tags.map((tag) => (
                    <Badge key={tag}>#{tag}</Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-[var(--space-3)] border-t border-[color:var(--lkv-border)] py-[var(--space-3)]">
              <div className="relative">
                <Button
                  variant={carnet.user_liked ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setShowReactions(!showReactions)}
                  aria-expanded={showReactions}
                  aria-label="Réactions"
                  icon={<span aria-hidden>{carnet.user_reaction ? REACTION_OPTS.find((r) => r.key === carnet.user_reaction)?.emoji : '🎒'}</span>}
                >
                  <span>{carnet.likes_count} réactions</span>
                </Button>
                {showReactions && (
                  <Card className="absolute bottom-full left-0 z-[var(--z-dropdown)] mb-[var(--space-2)] flex gap-[var(--space-1)] p-[var(--space-2)]">
                    {REACTION_OPTS.map((r) => (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => { onLike(carnet, r.key); setShowReactions(false); }}
                        title={r.label}
                        aria-label={r.label}
                        className={`flex h-9 w-9 items-center justify-center rounded-[var(--lkv-radius-md)] text-[length:var(--lkv-text-subheadline)] transition-colors hover:bg-[color:var(--lkv-hover-surface)] ${carnet.user_reaction === r.key ? 'bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn' : ''}`}
                      >
                        {r.emoji}
                      </button>
                    ))}
                  </Card>
                )}
              </div>

              <Button
                variant={carnet.user_favorited ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => onFavorite(carnet)}
                icon={<Icon name="bookmark" size={14} aria-hidden="true" />}
              >
                {carnet.favorites_count} favoris
              </Button>

              {carnet.author_id && (
                <Link
                  href={`/profil/${carnet.author_id}`}
                  className="ml-auto inline-flex min-h-[var(--control-height-sm)] items-center gap-[var(--space-1)] rounded-full border border-[color:var(--lkv-border)] bg-[color:var(--card-tint-strong)] px-[var(--space-3)] text-[length:var(--lkv-text-caption-2)] font-semibold text-[color:var(--lkv-text-primary)]"
                >
                  <Icon name="user" size={14} aria-hidden="true" />
                  Voir le profil
                </Link>
              )}
            </div>

            <div>
              <p className="mb-[var(--space-3)] font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-wider text-[color:var(--lkv-text-muted)]">
                Commentaires ({commentCount})
              </p>
              {loadingComments ? (
                <LoadingState compact label="Chargement des commentaires…" />
              ) : comments.length === 0 ? (
                <EmptyState
                  compact
                  icon={<Icon name="ChatBubbleLeftIcon" size={22} aria-hidden="true" />}
                  title="Aucun commentaire"
                  description="Aucun commentaire. Soyez le premier !"
                />
              ) : (
                <div className="mb-[var(--space-4)] space-y-[var(--space-3)]">
                  {(() => {
                    const roots: Comment[] = comments.filter((c) => !(c as any).parent_id);
                    const byParent: Record<string, Comment[]> = {};
                    comments.forEach((c) => {
                      if ((c as any).parent_id) {
                        (byParent[(c as any).parent_id] = byParent[(c as any).parent_id] || []).push(c);
                      }
                    });
                    const replyCore = (c: Comment) => (
                      <CommentItem
                        key={c.id}
                        comment={c}
                        currentUser={user}
                        tableName="carnet_comments"
                        onUpdate={(id, newContent) =>
                          setComments((prev) => prev.map((item) => (item.id === id ? { ...item, content: newContent } : item)))
                        }
                        onDelete={(id) => {
                          setComments((prev) => prev.filter((item) => item.id !== id));
                          setCommentCount((prev) => Math.max(0, prev - 1));
                          onCommentCountChange(carnet.id, -1);
                        }}
                        onReply={(parentId, reply) => {
                          setComments((prev) => [...prev, { ...reply, carnet_id: carnet!.id } as Comment]);
                          setCommentCount((prev) => prev + 1);
                          onCommentCountChange(carnet.id, 1);
                        }}
                        replyTargetName={c.author?.full_name}
                      />
                    );
                    const renderBranch = (c: Comment, depth: number): React.ReactNode => (
                      <div key={c.id}>
                        {replyCore(c)}
                        {(byParent[c.id] || []).map((child) => (
                          <div key={child.id} className={depth < 2 ? 'ml-[var(--space-8)]' : ''}>
                            {renderBranch(child, depth + 1)}
                          </div>
                        ))}
                      </div>
                    );
                    return roots.map((c) => renderBranch(c, 0));
                  })()}
                </div>
              )}
              {user ? (
                <div className="flex gap-[var(--space-3)]">
                  <input
                    className={`${FIELD_CLASS} flex-1`}
                    placeholder="Écrire un commentaire..."
                    aria-label="Écrire un commentaire"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitComment(); } }}
                  />
                  <Button onClick={handleSubmitComment} disabled={submitting || !newComment.trim()} loading={submitting} className="shrink-0">
                    {submitting ? '...' : 'Envoyer'}
                  </Button>
                </div>
              ) : (
                <p className="py-[var(--space-2)] text-center text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
                  <Link href="/connexion" className="text-[color:var(--lkv-text-primary)] hover:underline">Connectez-vous</Link> pour commenter
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function CarnetsPage() {
  const [carnets, setCarnets] = useState<Carnet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'mine' | 'favorites' | 'drafts' | 'published'>('all');
  const [search, setSearch] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [editCarnet, setEditCarnet] = useState<Carnet | null>(null);
  const [deleteCarnet, setDeleteCarnet] = useState<Carnet | null>(null);
  const [detailCarnet, setDetailCarnet] = useState<Carnet | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const loadCarnets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('carnets')
        .select('id,author_id,title,destination,description,cover_image,cover_image_alt,start_date,end_date,weather,route_rating,visibility,tags,map_points,is_collaborative,likes_count,comments_count,favorites_count,views_count,verified,created_at')
        .order('created_at', { ascending: false });

      if (filter === 'mine' && user) {
        query = query.eq('author_id', user.id);
      } else if (filter === 'favorites' && user) {
        const { data: favs } = await supabase.from('carnet_favorites').select('carnet_id').eq('user_id', user.id);
        const ids = favs?.map((f) => f.carnet_id) ?? [];
        if (ids.length === 0) { setCarnets([]); setLoading(false); return; }
        query = query.in('id', ids);
      } else {
        query = query.eq('visibility', 'public');
      }

      const { data, error: qErr } = await query;
      if (qErr) throw qErr;

      const rows = (data ?? []) as Carnet[];
      const profiles = await fetchPublicProfilesWith(supabase, rows.map((c) => c.author_id));

      let likedIds: string[] = [];
      let favIds: string[] = [];
      let reactions: Record<string, string> = {};

      if (user) {
        const [likesResult, favsResult] = await Promise.all([
          supabase.from('carnet_likes').select('carnet_id, reaction').eq('user_id', user.id),
          supabase.from('carnet_favorites').select('carnet_id').eq('user_id', user.id),
        ]);
        const likesData = likesResult.data;
        const favs = favsResult.data;
        likedIds = (likesData as Array<{ carnet_id: string; reaction: string }> | null)?.map((l) => l.carnet_id) ?? [];
        favIds = (favs as Array<{ carnet_id: string }> | null)?.map((f) => f.carnet_id) ?? [];
        reactions = Object.fromEntries(((likesData as Array<{ carnet_id: string; reaction: string }> | null) ?? []).map((l) => [l.carnet_id, l.reaction]));
      }

      setCarnets(
        rows.map((c) => ({
          ...c,
          author: profiles[c.author_id]
            ? {
                full_name: profiles[c.author_id].full_name ?? '',
                avatar_url: profiles[c.author_id].avatar_url ?? '',
                trust_score: profiles[c.author_id].trust_score ?? 0,
              }
            : undefined,
          map_points: Array.isArray(c.map_points) ? c.map_points : [],
          user_liked: likedIds.includes(c.id),
          user_favorited: favIds.includes(c.id),
          user_reaction: reactions[c.id],
        })) as Carnet[]
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [supabase, user, filter]);

  useEffect(() => { loadCarnets(); }, [loadCarnets]);

  const handleSave = async (form: CarnetForm) => {
    if (!user) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        destination: form.destination,
        description: form.description,
        cover_image: form.cover_image,
        cover_image_alt: form.title,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        weather: form.weather,
        route_rating: form.route_rating,
        visibility: form.visibility,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        is_collaborative: form.is_collaborative,
        author_id: user.id,
      };

      if (editCarnet) {
        const { error: uErr } = await supabase.from('carnets').update(payload).eq('id', editCarnet.id);
        if (uErr) throw uErr;
        showToast('Carnet mis à jour !');
        if (form.visibility !== 'private') {
          requestCarnetPublicationAward(editCarnet.id);
        }
      } else {
        const { data: newC, error: iErr } = await supabase.from('carnets').insert(payload).select('id').single();
        if (iErr) throw iErr;
        showToast('Carnet publié !');

        if (form.visibility !== 'private' && newC?.id) {
          requestCarnetPublicationAward(newC.id);
        }

        try {
          await fetch('/api/rewards/claim', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action_type: 'carnet',
              target_id: newC?.id,
              target_type: 'carnet',
              metadata: { title: form.title, description: form.description }
            })
          });
        } catch (rewardsErr) {
          console.warn('Rewards claim error:', rewardsErr);
        }
      }
      setShowCreate(false);
      setEditCarnet(null);
      await loadCarnets();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteCarnet) return;
    setDeleting(true);
    await supabase.from('carnets').delete().eq('id', deleteCarnet.id);
    setDeleteCarnet(null);
    setDeleting(false);
    showToast('Carnet supprimé');
    await loadCarnets();
  };

  const handleLike = async (carnet: Carnet, reaction: string) => {
    if (!user) { showToast('Connectez-vous pour réagir'); return; }
    if (carnet.user_liked && carnet.user_reaction === reaction) {
      await supabase.from('carnet_likes').delete().eq('carnet_id', carnet.id).eq('user_id', user.id);
      setCarnets((prev) => prev.map((c) => c.id === carnet.id ? { ...c, user_liked: false, user_reaction: undefined, likes_count: Math.max(0, c.likes_count - 1) } : c));
      if (detailCarnet?.id === carnet.id) setDetailCarnet((prev) => prev ? { ...prev, user_liked: false, user_reaction: undefined, likes_count: Math.max(0, prev.likes_count - 1) } : null);
    } else {
      await supabase.from('carnet_likes').upsert({ carnet_id: carnet.id, user_id: user.id, reaction }, { onConflict: 'carnet_id,user_id' });
      if (!carnet.user_liked) {
        setCarnets((prev) => prev.map((c) => c.id === carnet.id ? { ...c, user_liked: true, user_reaction: reaction, likes_count: c.likes_count + 1 } : c));
        if (detailCarnet?.id === carnet.id) setDetailCarnet((prev) => prev ? { ...prev, user_liked: true, user_reaction: reaction, likes_count: prev.likes_count + 1 } : null);
      } else {
        setCarnets((prev) => prev.map((c) => c.id === carnet.id ? { ...c, user_reaction: reaction } : c));
        if (detailCarnet?.id === carnet.id) setDetailCarnet((prev) => prev ? { ...prev, user_reaction: reaction } : null);
      }
    }
  };

  const handleFavorite = async (carnet: Carnet) => {
    if (!user) { showToast('Connectez-vous pour sauvegarder'); return; }
    if (carnet.user_favorited) {
      await supabase.from('carnet_favorites').delete().eq('carnet_id', carnet.id).eq('user_id', user.id);
      setCarnets((prev) => prev.map((c) => c.id === carnet.id ? { ...c, user_favorited: false, favorites_count: Math.max(0, c.favorites_count - 1) } : c));
      if (detailCarnet?.id === carnet.id) setDetailCarnet((prev) => prev ? { ...prev, user_favorited: false, favorites_count: Math.max(0, prev.favorites_count - 1) } : null);
      showToast('Retiré des favoris');
    } else {
      await supabase.from('carnet_favorites').insert({ carnet_id: carnet.id, user_id: user.id });
      setCarnets((prev) => prev.map((c) => c.id === carnet.id ? { ...c, user_favorited: true, favorites_count: c.favorites_count + 1 } : c));
      if (detailCarnet?.id === carnet.id) setDetailCarnet((prev) => prev ? { ...prev, user_favorited: true, favorites_count: prev.favorites_count + 1 } : null);
      showToast('Ajouté aux favoris ⭐');
    }
  };

  const handleCommentCountChange = useCallback((carnetId: string, delta: number) => {
    setCarnets((prev) => prev.map((c) => c.id === carnetId ? { ...c, comments_count: Math.max(0, (c.comments_count ?? 0) + delta) } : c));
    setDetailCarnet((prev) => prev && prev.id === carnetId ? { ...prev, comments_count: Math.max(0, (prev.comments_count ?? 0) + delta) } : prev);
  }, []);

  const handleShare = (_carnet: Carnet) => {
    const url = `${window.location.origin}/carnets/${_carnet.id}`;
    if (navigator.share) {
      navigator.share({ title: _carnet.title, url }).then(() => {}, () => {});
      return;
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      showToast('Lien copié dans le presse-papier !');
    }
  };

  const filtered = carnets.filter((c) =>
    !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.destination.toLowerCase().includes(search.toLowerCase())
  );

  const editForm: CarnetForm | undefined = editCarnet ? {
    title: editCarnet.title,
    destination: editCarnet.destination,
    description: editCarnet.description,
    cover_image: editCarnet.cover_image,
    start_date: editCarnet.start_date ?? '',
    end_date: editCarnet.end_date ?? '',
    weather: editCarnet.weather,
    route_rating: editCarnet.route_rating,
    visibility: editCarnet.visibility,
    tags: editCarnet.tags?.join(', ') ?? '',
    is_collaborative: editCarnet.is_collaborative,
  } : undefined;

  return (
    <>
      <div className="hidden md:block">
        <div className="relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-transparent font-sans text-[color:var(--lkv-text-primary)]">
          <CompteBackground />
          <MarbleZone />
          <Header />
          <main className="mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 gap-[var(--space-5)] overflow-hidden px-[var(--space-4)] pb-[var(--space-4)] pt-24 sm:px-[var(--space-6)] lg:px-[var(--space-8)]">
            <div className="h-full w-[230px] shrink-0 overflow-hidden">
              <CarnetVerticalTabs
                activeFilter={filter}
                onSelectFilter={(f) => setFilter(f as typeof filter)}
              />
            </div>

            <div className="h-full min-w-0 flex-1 space-y-[var(--space-5)] overflow-y-auto pr-[var(--space-2)]">
              <div className="flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-caption-2)] font-medium text-[color:var(--lkv-text-muted)]">
                <Link href="/communaute" className="transition-colors hover:text-[color:var(--lkv-text-primary)]">Communauté</Link>
                <Icon name="ChevronRightIcon" size={12} className="text-[color:var(--lkv-text-muted)]" aria-hidden="true" />
                <span className="font-semibold text-[color:var(--lkv-text-primary)]">Carnets d&apos;expédition</span>
              </div>

              <CarnetHubHero
                totalCarnets={carnets.length}
                onCreateClick={() => {
                  if (!user) {
                    showToast('Connectez-vous pour rédiger un carnet.');
                    return;
                  }
                  setEditCarnet(null);
                  setShowCreate(true);
                }}
              />

              <SearchField
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClear={() => setSearch('')}
                placeholder="Rechercher une destination, un massif ou un titre (ex: Vercors, Chartreuse)..."
                aria-label="Rechercher un carnet"
              />

              <section className="space-y-[var(--space-3)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-[var(--space-2)]">
                    <h2 className="font-display text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">
                      {filter === 'mine' ? 'Mes carnets d’expédition' : filter === 'favorites' ? 'Mes récits favoris' : 'Récits & Expéditions'}
                    </h2>
                    <Badge className="font-mono font-bold">
                      {filtered.length} récits
                    </Badge>
                  </div>
                </div>

                {loading ? (
                  <div className="grid grid-cols-1 gap-[var(--space-4)] lg:grid-cols-2">
                    {[1, 2, 3, 4].map((i) => (
                      <SkeletonCarnetCard key={i} />
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <Card className="p-[var(--space-12)]">
                    <EmptyState
                      icon={<span className="text-[length:var(--lkv-text-title-sm)]" aria-hidden>🏔️</span>}
                      title="Aucun carnet trouvé"
                      description="Essayez de modifier votre recherche ou soyez le premier à partager cette aventure !"
                    />
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 gap-[var(--space-4)] lg:grid-cols-2">
                    {filtered.map((c) => (
                      <CarnetHubCard
                        key={c.id}
                        carnet={c}
                        currentUserId={user?.id}
                        onLike={handleLike}
                        onFavorite={handleFavorite}
                        onShare={handleShare}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>

            <CarnetRightSidebar
              totalCarnets={carnets.length}
              featuredCarnet={carnets[0]}
            />
          </main>
        </div>
      </div>

      <div className="relative block min-h-screen font-sans text-[color:var(--lkv-text-primary)] md:hidden">
        <MobilePageShell videoBackground={true} background="transparent">
          <MobileCarnetsHub
            carnets={carnets}
            myCarnets={user ? carnets.filter(c => c.author_id === user.id) : []}
            loading={loading}
            user={user}
            onLikeCarnet={async (cid, liked) => {
              const target = carnets.find(c => c.id === cid);
              if (target) handleLike(target, 'heart');
            }}
            onSaveCarnet={async (cid, saved) => {
              const target = carnets.find(c => c.id === cid);
              if (target) handleFavorite(target);
            }}
            onOpenCreateModal={() => {
              if (!user) {
                setToast('Veuillez vous connecter pour rédiger un carnet.');
                return;
              }
              setEditCarnet(null);
              setShowCreate(true);
            }}
            onRefresh={loadCarnets}
          />
        </MobilePageShell>
      </div>

      <CarnetModal
        open={showCreate}
        onClose={() => { setShowCreate(false); setEditCarnet(null); }}
        onSave={handleSave}
        initial={editForm}
        saving={saving}
      />
      <CarnetDetailModal
        carnet={detailCarnet}
        onClose={() => setDetailCarnet(null)}
        onEdit={(c) => { setDetailCarnet(null); setEditCarnet(c); setShowCreate(true); }}
        onDelete={(c) => { setDetailCarnet(null); setDeleteCarnet(c); }}
        onLike={handleLike}
        onFavorite={handleFavorite}
        onCommentCountChange={handleCommentCountChange}
        currentUserId={user?.id}
      />

      <ConfirmDialog
        open={!!deleteCarnet}
        title="Supprimer ce carnet ?"
        description="Cette action est irréversible. Tous les commentaires et réactions seront supprimés."
        confirmLabel={deleting ? 'Suppression...' : 'Supprimer'}
        cancelLabel="Annuler"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteCarnet(null)}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[var(--z-toast)] -translate-x-1/2 rounded-[var(--lkv-radius-md)] bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn px-[var(--space-5)] py-[var(--space-3)] text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-text-primary)]">
          {toast}
        </div>
      )}
    </>
  );
}

export const dynamic = 'force-dynamic';
