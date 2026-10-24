'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, ChevronLeft, ChevronRight, Flag, Heart, Link2, MessageCircle, MoreHorizontal, Repeat2, Send, Share2, Trash2, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { LensPager } from '@/components/compte/drawer/LensPager';
import { fetchPostDetail } from '@/features/community/posts/queries';
import {
  copyPostLink, createPostComment, deletePost, deletePostComment, optimisticComment,
  repostPost, reportComment, reportPost, sharePostExternally, sharePostToConversation,
  toggleCommentLike, togglePostLike, togglePostSave, updatePostComment,
} from '@/features/community/posts/mutations';
import { POST_REPORT_REASONS, postPermalink, type PostComment, type PostDetail, type ShareTarget } from '@/features/community/posts/types';
import { DrawerButton, OverlaySheet } from './OverlaySheet';
import { PostCommentsPanel } from '@/features/community/feed/PostCommentsPanel';
import { PostSharePanel } from '@/features/community/feed/PostSharePanel';
import type { FeedPost } from '@/features/community/feed/useCommunityFeed';

type Pane = 'share' | 'post' | 'comments';
const ORDER: Pane[] = ['share', 'post', 'comments'];
const INDEX: Record<Pane, number> = { share: 0, post: 1, comments: 2 };

function ago(value: string) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'À l’instant';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d} j` : new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function Avatar({ name, url }: { name: string; url?: string | null }) {
  return url ? <img className="lkdv-post-avatar" src={url} alt="" loading="lazy" /> : <span className="lkdv-post-avatar is-fallback">{name.charAt(0).toUpperCase()}</span>;
}

export interface PostDrawerProps {
  postId: string;
  initialPane?: Pane;
  initialCommentId?: string | null;
  onClose: () => void;
  onOpenProfile?: (id: string) => void;
  onDeleted?: () => void;
}

export function PostDrawer({ postId, initialPane = 'post', initialCommentId = null, onClose, onOpenProfile, onDeleted }: PostDrawerProps) {
  const { user } = useAuth();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pane, setPane] = useState<Pane>(initialPane);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<PostComment | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [targets, setTargets] = useState<ShareTarget[]>([]);
  const [shareTab, setShareTab] = useState<'send' | 'external'>('send');
  const [query, setQuery] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportComment, setReportComment] = useState<PostComment | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [editing, setEditing] = useState<PostComment | null>(null);
  const [editText, setEditText] = useState('');
  const commentRefs = useRef(new Map<string, HTMLDivElement>());
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2400);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const detail = await fetchPostDetail(postId);
      if (!detail) throw new Error('Publication introuvable');
      setPost(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const location = post?.location;
    if (!location) return;
    let tries = 0;
    let timer: number | null = null;
    const focus = () => {
      const map = (window as any).__lkdvCompteMap3D ?? (window as any).__lkdvCompteMapInstance;
      if (map && typeof map.flyTo === 'function') {
        map.flyTo({
          center: [location.lng, location.lat],
          zoom: 12.4,
          pitch: 58,
          bearing: -28,
          duration: 1600,
          essential: true,
        });
        return;
      }
      tries += 1;
      if (tries < 24) timer = window.setTimeout(focus, 400);
    };
    focus();
    return () => { if (timer) window.clearTimeout(timer); };
  }, [post?.location]);
  useEffect(() => {
    if (!initialCommentId) return;
    setPane('comments');
  }, [initialCommentId]);

  const media = post?.mediaUrls ?? [];
  const currentMedia = media[Math.min(mediaIndex, Math.max(0, media.length - 1))] ?? null;
  const roots = useMemo(() => comments.filter((c) => !c.parentId), [comments]);
  const replies = useMemo(() => {
    const map = new Map<string, PostComment[]>();
    comments.forEach((c) => { if (c.parentId) map.set(c.parentId, [...(map.get(c.parentId) ?? []), c]); });
    return map;
  }, [comments]);
  const filteredTargets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? targets.filter((t) => t.title.toLowerCase().includes(q)) : targets;
  }, [query, targets]);

  const feedPost = useMemo<FeedPost | null>(() => post ? {
    id: post.id,
    content: post.content,
    title: post.title,
    created_at: post.createdAt,
    likes_count: post.likesCount,
    comments_count: post.commentsCount,
    shares_count: post.sharesCount,
    author_id: post.author?.id ?? null,
    author: post.author ? {
      id: post.author.id,
      full_name: post.author.name,
      avatar_url: post.author.avatarUrl,
      handle: post.author.handle,
    } : undefined,
  } : null, [post]);

  const panelStart = useRef<{ x: number; y: number } | null>(null);
  const onPanelPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button,a,input,textarea')) return;
    panelStart.current = { x: event.clientX, y: event.clientY };
  };
  const onPanelPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = panelStart.current;
    panelStart.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      if (pane === 'comments' && dx < 0) setPane('share');
      if (pane === 'share' && dx > 0) setPane('comments');
      return;
    }
    const body = (event.target as HTMLElement).closest('.lkdv-post-panel-body') as HTMLElement | null;
    if (dy > 70 && dy > Math.abs(dx) && (!body || body.scrollTop <= 0)) setPane('post');
  };

  const patch = (next: Partial<PostDetail>) => setPost((current) => current ? { ...current, ...next } : current);

  const like = async () => {
    if (!post) return;
    const wasLiked = post.userLiked;
    const count = post.likesCount;
    patch({ userLiked: !wasLiked, likesCount: Math.max(0, count + (wasLiked ? -1 : 1)) });
    try { await togglePostLike(post.id); } catch { patch({ userLiked: wasLiked, likesCount: count }); notify('Like impossible'); }
  };

  const save = async () => {
    if (!post) return;
    const wasSaved = post.userSaved;
    patch({ userSaved: !wasSaved });
    try { await togglePostSave(post.id); notify(wasSaved ? 'Retiré des enregistrements' : 'Publication enregistrée'); }
    catch { patch({ userSaved: wasSaved }); notify('Enregistrement impossible'); }
  };

  const submitComment = async () => {
    if (!post || !text.trim()) return;
    const value = text.trim();
    const optimistic = optimisticComment(value, {
      id: user?.id || 'moi',
      name: (user?.user_metadata?.full_name as string) || 'Moi',
      handle: (user?.user_metadata?.username as string) || 'moi',
      avatarUrl: (user?.user_metadata?.avatar_url as string) || null,
    }, replyTo?.id ?? null);
    setComments((rows) => [...rows, optimistic]);
    setText('');
    setBusy(true);
    try { await createPostComment(post.id, value, replyTo?.id ?? null); setReplyTo(null); notify('Commentaire publié'); await load(); }
    catch (err) { setComments((rows) => rows.filter((c) => c.id !== optimistic.id)); notify(err instanceof Error ? err.message : 'Commentaire impossible'); }
    finally { setBusy(false); }
  };

  const likeComment = async (comment: PostComment) => {
    const next = !comment.userLiked;
    setComments((rows) => rows.map((row) => row.id === comment.id ? { ...row, userLiked: next, likesCount: Math.max(0, row.likesCount + (next ? 1 : -1)) } : row));
    try { await toggleCommentLike(comment.id, next); }
    catch { setComments((rows) => rows.map((row) => row.id === comment.id ? comment : row)); }
  };

  const saveEdit = async () => {
    if (!editing || !editText.trim()) return;
    try { await updatePostComment(editing.id, editText); setEditing(null); notify('Commentaire modifié'); await load(); }
    catch { notify('Modification impossible'); }
  };

  const removeComment = async (comment: PostComment) => {
    try { await deletePostComment(comment.id); notify('Commentaire supprimé'); await load(); }
    catch { notify('Suppression impossible'); }
  };

  const share = async () => {
    if (!post) return;
    try {
      const result = await sharePostExternally(post.title || 'Publication LKDV', post.content.slice(0, 120), post.id);
      notify(result === 'copied' ? 'Lien copié' : 'Partage ouvert');
    } catch { notify('Partage annulé'); }
  };

  const copy = async () => {
    if (!post) return;
    try { const url = await copyPostLink(post.id); notify(`Lien copié · ${url}`); }
    catch { notify('Copie impossible'); }
  };

  const send = async (target: ShareTarget) => {
    if (!post) return;
    setBusy(true);
    try { await sharePostToConversation(post.id, target.id); notify(`Envoyé à ${target.title}`); setPane('post'); }
    catch { notify('Envoi impossible'); }
    finally { setBusy(false); }
  };

  const repost = async () => {
    if (!post) return;
    try { await repostPost(post.id); notify('Publication republiée'); setOptionsOpen(false); }
    catch { notify('Republication impossible'); }
  };

  const remove = async () => {
    if (!post) return;
    setBusy(true);
    try { await deletePost(post.id); onDeleted?.(); onClose(); }
    catch { notify('Suppression impossible'); setBusy(false); }
  };

  const doReport = async (reason: string) => {
    if (!post) return;
    try { await reportPost(post.id, reason); setReportOpen(false); notify('Signalement envoyé'); }
    catch { notify('Signalement impossible'); }
  };

  const doReportComment = async (reason: string) => {
    if (!reportComment) return;
    try { await reportComment_(reportComment.id, reason); setReportComment(null); notify('Signalement envoyé'); }
    catch { notify('Signalement impossible'); }
  };

  const submitCommentRef = useRef(submitComment);
  submitCommentRef.current = submitComment;

  return (
    <>
      <OverlaySheet
        title={post?.author?.name || "Publication"}
        subtitle={post?.author ? `@${post.author.handle} · ${ago(post.createdAt)}` : undefined}
        onClose={onClose}
        className="lkdv-post-drawer"
        hideClose
        onHeadingClick={onClose}
        leading={post ? <Avatar name={post.author?.name || 'Voyageur'} url={post.author?.avatarUrl} /> : undefined}
        headerRight={<button type="button" className={`lkdv-post-options-trigger${optionsOpen ? ' is-open' : ''}`} aria-label={optionsOpen ? 'Fermer le menu' : 'Options'} aria-expanded={optionsOpen} onClick={() => setOptionsOpen((v) => !v)}>{optionsOpen ? <X size={18} /> : <MoreHorizontal size={18} />}</button>}
      >
        {loading ? <div className="lkdv-overlay-empty"><p>Chargement…</p></div> : error || !post ? (
          <div className="lkdv-overlay-empty" role="alert"><b>Publication indisponible</b><p>{error}</p><DrawerButton onClick={() => void load()}>Réessayer</DrawerButton></div>
        ) : (
          <>
            <div className="lkdv-post-swipe">
            <LensPager index={INDEX[pane]} count={3} onIndexChange={(i) => setPane(ORDER[i] ?? 'post')} label="Panneaux de la publication">
              <div className="lkdv-lens-pane lkdv-post-pane">
                {pane === 'share' && feedPost ? (
                  <div className="lkdv-community-panel-slot" data-side="share" onPointerDown={onPanelPointerDown} onPointerUp={onPanelPointerUp} onPointerCancel={() => { panelStart.current = null; }}>
                    <PostSharePanel post={feedPost} user={user} onClose={() => setPane('post')} />
                  </div>
                ) : null}
              </div>

              <div className="lkdv-lens-pane lkdv-post-pane">
                <div className="lkdv-post-main">
                  <header className="lkdv-post-author">
                    <button type="button" className="lkdv-post-author-btn" onClick={() => post.author && onOpenProfile?.(post.author.id)}>
                      <Avatar name={post.author?.name || 'Voyageur'} url={post.author?.avatarUrl} />
                      <span><b>{post.author?.name || 'Voyageur'}</b><small>@{post.author?.handle || 'voyageur'} · {ago(post.createdAt)}</small></span>
                    </button>
                    <button type="button" className="lkdv-post-options-trigger" aria-label="Options" onClick={() => setOptionsOpen((v) => !v)}><MoreHorizontal size={18} /></button>
                  </header>
                  {currentMedia ? (
                    <div className="lkdv-post-media-wrap">
                      <div className="lkdv-post-media"><img src={currentMedia} alt="" draggable={false} /></div>
                      {media.length > 1 ? <><button type="button" className="lkdv-post-media-nav is-left" aria-label="Précédent" onClick={() => setMediaIndex((i) => Math.max(0, i - 1))}><ChevronLeft size={18} /></button><button type="button" className="lkdv-post-media-nav is-right" aria-label="Suivant" onClick={() => setMediaIndex((i) => Math.min(media.length - 1, i + 1))}><ChevronRight size={18} /></button><span className="lkdv-post-media-count">{mediaIndex + 1}/{media.length}</span></> : null}
                      <div className="lkdv-post-media-glass">
                        <button type="button" className={post.userLiked ? 'on' : ''} onClick={() => void like()} aria-label="Aimer"><Heart size={20} fill={post.userLiked ? 'currentColor' : 'none'} /></button>
                        <button type="button" onClick={() => setPane('comments')} aria-label="Commenter"><MessageCircle size={20} /></button>
                        <button type="button" onClick={() => setPane('share')} aria-label="Partager"><Send size={20} /></button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="lkdv-lens-pane lkdv-post-pane">
                {pane === 'comments' && feedPost ? (
                  <div className="lkdv-community-panel-slot" data-side="comments" onPointerDown={onPanelPointerDown} onPointerUp={onPanelPointerUp} onPointerCancel={() => { panelStart.current = null; }}>
                    <PostCommentsPanel post={feedPost} user={user} onClose={() => setPane('post')} focusCommentId={initialCommentId} />
                  </div>
                ) : null}
              </div>
            </LensPager>
            </div>
          </>
        )}

        {optionsOpen && post ? (
          <div className="lkdv-post-options-menu" role="menu" aria-label="Options de la publication">
            <button type="button" role="menuitem" aria-label={post.userSaved ? 'Retirer des enregistrements' : 'Enregistrer'} title={post.userSaved ? 'Retirer des enregistrements' : 'Enregistrer'} onClick={() => { setOptionsOpen(false); void save(); }}>
              <Bookmark size={17} fill={post.userSaved ? 'currentColor' : 'none'} />
            </button>
            <button type="button" role="menuitem" aria-label="Copier le lien" title="Copier le lien" onClick={() => { setOptionsOpen(false); void copy(); }}>
              <Link2 size={17} />
            </button>
            <button type="button" role="menuitem" aria-label="Republier" title="Republier" onClick={() => { setOptionsOpen(false); void repost(); }}>
              <Repeat2 size={17} />
            </button>
            <button type="button" role="menuitem" aria-label="Signaler" title="Signaler" onClick={() => { setOptionsOpen(false); setReportOpen(true); }}>
              <Flag size={17} />
            </button>
            {user?.id === post.author?.id ? <button type="button" className="is-danger" role="menuitem" aria-label="Supprimer" title="Supprimer" onClick={() => { setOptionsOpen(false); setDeleteOpen(true); }}>
              <Trash2 size={17} />
            </button> : null}
          </div>
        ) : null}
        {deleteOpen ? <div className="lkdv-post-confirm"><b>Supprimer cette publication ?</b><p>Cette action est définitive.</p><div><DrawerButton tone="ghost" onClick={() => setDeleteOpen(false)}>Annuler</DrawerButton><DrawerButton tone="danger" disabled={busy} onClick={() => void remove()}>Supprimer</DrawerButton></div></div> : null}
        {toast ? <div className="lkdv-post-toast" role="status">{toast}</div> : null}
      </OverlaySheet>

      {reportOpen && post ? <ReportPicker title="Signaler la publication" onClose={() => setReportOpen(false)} onPick={(reason) => void doReport(reason)} /> : null}
      {reportComment ? <ReportPicker title="Signaler le commentaire" onClose={() => setReportComment(null)} onPick={(reason) => void doReportComment(reason)} /> : null}
    </>
  );
}

type CommentTools = {
  editing: PostComment | null;
  editText: string;
  setEditText: (value: string) => void;
  setEditing: (comment: PostComment | null) => void;
  saveEdit: () => Promise<void>;
  removeComment: (comment: PostComment) => Promise<void>;
  likeComment: (comment: PostComment) => Promise<void>;
  setReplyTo: (comment: PostComment | null) => void;
  setReportComment: (comment: PostComment | null) => void;
  register: (id: string, node: HTMLDivElement | null) => void;
};

function renderComment(comment: PostComment, isReply: boolean, tools: CommentTools) {
  return (
    <div key={comment.id} ref={(node) => tools.register(comment.id, node)} className={`lkdv-comment ${isReply ? 'is-reply' : ''}`}>
      <Avatar name={comment.author?.name || 'Voyageur'} url={comment.author?.avatarUrl} />
      <div className="lkdv-comment-body">
        <div className="lkdv-comment-head"><b>{comment.author?.name || 'Voyageur'}</b><small>@{comment.author?.handle || 'voyageur'} · {ago(comment.createdAt)}</small></div>
        {tools.editing?.id === comment.id ? (
          <div className="lkdv-comment-edit"><textarea value={tools.editText} onChange={(event) => tools.setEditText(event.target.value)} /><div><button type="button" onClick={() => tools.setEditing(null)}>Annuler</button><button type="button" onClick={() => void tools.saveEdit()}>Enregistrer</button></div></div>
        ) : <p>{comment.content}</p>}
        <div className="lkdv-comment-actions">
          <button type="button" className={comment.userLiked ? 'on' : ''} onClick={() => void tools.likeComment(comment)}><Heart size={13} fill={comment.userLiked ? 'currentColor' : 'none'} />{comment.likesCount || ''}</button>
          {!isReply ? <button type="button" onClick={() => tools.setReplyTo(comment)}>Répondre</button> : null}
          {comment.isOwner ? <><button type="button" onClick={() => { tools.setEditing(comment); tools.setEditText(comment.content); }}>Modifier</button><button type="button" onClick={() => void tools.removeComment(comment)}>Supprimer</button></> : <button type="button" onClick={() => tools.setReportComment(comment)}>Signaler</button>}
        </div>
      </div>
    </div>
  );
}

function ReportPicker({ title, onClose, onPick }: { title: string; onClose: () => void; onPick: (reason: string) => void }) {
  return (
    <OverlaySheet title={title} onClose={onClose} nested>
      <div className="lkdv-report-list">
        {POST_REPORT_REASONS.map((reason) => <button key={reason.id} type="button" className="lkdv-overlay-row" onClick={() => onPick(reason.label)}><span className="lkdv-report-dot" /><span className="lkdv-overlay-row-main"><b>{reason.label}</b></span></button>)}
      </div>
    </OverlaySheet>
  );
}

async function reportComment_(id: string, reason: string) {
  return reportComment(id, reason);
}

export default PostDrawer;
