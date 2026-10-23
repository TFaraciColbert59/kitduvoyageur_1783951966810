'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, ChevronLeft, ChevronRight, Heart, MessageCircle, MoreHorizontal, Send, Share2, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { LensPager } from '@/components/compte/drawer/LensPager';
import { fetchPostComments, fetchPostDetail, fetchShareTargets } from '@/features/community/posts/queries';
import {
  copyPostLink, createPostComment, deletePost, deletePostComment, optimisticComment,
  repostPost, reportComment, reportPost, sharePostExternally, sharePostToConversation,
  toggleCommentLike, togglePostLike, togglePostSave, updatePostComment,
} from '@/features/community/posts/mutations';
import { POST_REPORT_REASONS, postPermalink, type PostComment, type PostDetail, type ShareTarget } from '@/features/community/posts/types';
import { DrawerButton, OverlaySheet } from './OverlaySheet';

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
  const [lightbox, setLightbox] = useState(false);
  const [editing, setEditing] = useState<PostComment | null>(null);
  const [editText, setEditText] = useState('');
  const commentRefs = useRef(new Map<string, HTMLDivElement>());
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const touchStartX = useRef<number | null>(null);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2400);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [detail, rows] = await Promise.all([fetchPostDetail(postId), fetchPostComments(postId)]);
      if (!detail) throw new Error('Publication introuvable');
      setPost(detail);
      setComments(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!initialCommentId) return;
    setPane('comments');
    const timer = window.setTimeout(() => commentRefs.current.get(initialCommentId)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 450);
    return () => window.clearTimeout(timer);
  }, [initialCommentId]);
  useEffect(() => {
    if (pane === 'share') void fetchShareTargets().then(setTargets).catch(() => setTargets([]));
  }, [pane]);

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
        leading={post ? <Avatar name={post.author?.name || 'Voyageur'} url={post.author?.avatarUrl} /> : undefined}
        headerRight={<button type="button" className="lkdv-post-options-trigger" aria-label="Options" aria-expanded={optionsOpen} onClick={() => setOptionsOpen((v) => !v)}><MoreHorizontal size={18} /></button>}
        footer={pane === 'post' || pane === 'comments' ? (
          <div className="lkdv-post-composer">
            <Avatar name={(user?.user_metadata?.full_name as string) || 'Moi'} url={(user?.user_metadata?.avatar_url as string) || null} />
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ajouter un commentaire…" aria-label="Ajouter un commentaire" onFocus={() => setPane('comments')} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submitComment(); } }} />
            <button type="button" className="lkdv-post-send" aria-label="Publier" disabled={!text.trim() || busy} onClick={() => void submitComment()}><Send size={17} /></button>
          </div>
        ) : undefined}
      >
        {loading ? <div className="lkdv-overlay-empty"><p>Chargement…</p></div> : error || !post ? (
          <div className="lkdv-overlay-empty" role="alert"><b>Publication indisponible</b><p>{error}</p><DrawerButton onClick={() => void load()}>Réessayer</DrawerButton></div>
        ) : (
          <>
            <div
              className="lkdv-post-swipe"
              onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }}
              onTouchEnd={(event) => {
                const start = touchStartX.current;
                touchStartX.current = null;
                if (start == null) return;
                const delta = (event.changedTouches[0]?.clientX ?? start) - start;
                if (Math.abs(delta) < 36) return;
                const current = ORDER.indexOf(pane);
                const next = delta < 0 ? Math.min(2, current + 1) : Math.max(0, current - 1);
                setPane(ORDER[next]);
              }}
            >
            <LensPager index={INDEX[pane]} count={3} onIndexChange={(i) => setPane(ORDER[i] ?? 'post')} label="Panneaux de la publication">
              <div className="lkdv-lens-pane lkdv-post-pane">
                <div className="lkdv-share-pane">
                  <div className="lkdv-share-tabs" role="tablist">
                    <button type="button" role="tab" aria-selected={shareTab === 'send'} onClick={() => setShareTab('send')}>Envoyer</button>
                    <button type="button" role="tab" aria-selected={shareTab === 'external'} onClick={() => setShareTab('external')}>Partage externe</button>
                  </div>
                  {shareTab === 'send' ? (
                    <>
                      <input className="lkdv-share-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher une conversation" aria-label="Rechercher une conversation" />
                      <div className="lkdv-overlay-card lkdv-share-list">
                        {filteredTargets.length === 0 ? <div className="lkdv-overlay-empty"><p>Aucune conversation.</p></div> : filteredTargets.map((target) => (
                          <button key={target.id} type="button" className="lkdv-overlay-row" disabled={busy} onClick={() => void send(target)}>
                            <span className="lkdv-share-avatar">{target.title.charAt(0).toUpperCase()}</span>
                            <span className="lkdv-overlay-row-main"><b>{target.title}</b><small>{target.type === 'group' ? 'Groupe' : 'Message privé'}</small></span>
                            <Send size={16} />
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="lkdv-share-actions">
                      <DrawerButton tone="primary" onClick={() => void share()}>Partager via l’appareil</DrawerButton>
                      <DrawerButton onClick={() => void copy()}>Copier le lien</DrawerButton>
                      <DrawerButton onClick={() => void repost()}>Republier</DrawerButton>
                      <DrawerButton tone="ghost" onClick={() => void save()}>{post.userSaved ? 'Retirer des enregistrements' : 'Enregistrer'}</DrawerButton>
                    </div>
                  )}
                </div>
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
                      <button type="button" className="lkdv-post-media" onClick={() => setLightbox(true)} aria-label="Ouvrir le média"><img src={currentMedia} alt="" /></button>
                      {media.length > 1 ? <><button type="button" className="lkdv-post-media-nav is-left" aria-label="Précédent" onClick={() => setMediaIndex((i) => Math.max(0, i - 1))}><ChevronLeft size={18} /></button><button type="button" className="lkdv-post-media-nav is-right" aria-label="Suivant" onClick={() => setMediaIndex((i) => Math.min(media.length - 1, i + 1))}><ChevronRight size={18} /></button><span className="lkdv-post-media-count">{mediaIndex + 1}/{media.length}</span></> : null}
                      <div className="lkdv-post-media-glass">
                        <button type="button" className={post.userLiked ? 'on' : ''} onClick={() => void like()} aria-label="Aimer"><Heart size={20} fill={post.userLiked ? 'currentColor' : 'none'} /></button>
                        <button type="button" onClick={() => setPane('comments')} aria-label="Commenter"><MessageCircle size={20} /></button>
                        <button type="button" onClick={() => setPane('share')} aria-label="Partager"><Send size={20} /></button>
                        <button type="button" className={post.userSaved ? 'on' : ''} onClick={() => void save()} aria-label="Enregistrer"><Bookmark size={20} fill={post.userSaved ? 'currentColor' : 'none'} /></button>
                      </div>
                    </div>
                  ) : null}
                  <p className="lkdv-post-likes">{post.likesCount.toLocaleString('fr-FR')} mentions J’aime</p>
                  {post.title ? <h3 className="lkdv-post-title">{post.title}</h3> : null}
                  {post.content ? <p className="lkdv-post-caption">{post.content}</p> : null}
                  <button type="button" className="lkdv-post-comments-link" onClick={() => setPane('comments')}>Voir les {post.commentsCount} commentaire{post.commentsCount > 1 ? 's' : ''}</button>
                  <a className="lkdv-post-permalink" href={postPermalink(post.id)}>Voir la publication complète</a>
                </div>
              </div>

              <div className="lkdv-lens-pane lkdv-post-pane">
                <div className="lkdv-comments-pane">
                  {comments.length === 0 ? <div className="lkdv-overlay-empty"><b>Sois le premier à commenter</b><p>Partage ton expérience.</p></div> : (
                    <div className="lkdv-comment-list">
                      {roots.map((root) => (
                        <div key={root.id}>
                          {renderComment(root, false, { editing, editText, setEditText, setEditing, saveEdit, removeComment, likeComment, setReplyTo, setReportComment, register: (id, n) => n ? commentRefs.current.set(id, n) : commentRefs.current.delete(id) })}
                          {(replies.get(root.id) ?? []).map((reply) => renderComment(reply, true, { editing, editText, setEditText, setEditing, saveEdit, removeComment, likeComment, setReplyTo, setReportComment, register: (id, n) => n ? commentRefs.current.set(id, n) : commentRefs.current.delete(id) }))}
                        </div>
                      ))}
                    </div>
                  )}
                  {replyTo ? <div className="lkdv-comment-reply-banner">Réponse à @{replyTo.author?.handle || replyTo.author?.name}<button type="button" onClick={() => setReplyTo(null)} aria-label="Annuler">×</button></div> : null}
                </div>
              </div>
            </LensPager>
            </div>
          </>
        )}

        {optionsOpen && post ? (
          <div className="lkdv-post-options-menu" role="menu">
            <button type="button" role="menuitem" onClick={() => void copy()}>Copier le lien</button>
            <button type="button" role="menuitem" onClick={() => void repost()}><Share2 size={15} /> Republier</button>
            <button type="button" role="menuitem" onClick={() => { setReportOpen(true); setOptionsOpen(false); }}>Signaler</button>
            {user?.id === post.author?.id ? <button type="button" className="is-danger" role="menuitem" onClick={() => { setDeleteOpen(true); setOptionsOpen(false); }}><Trash2 size={15} /> Supprimer</button> : null}
          </div>
        ) : null}
        {deleteOpen ? <div className="lkdv-post-confirm"><b>Supprimer cette publication ?</b><p>Cette action est définitive.</p><div><DrawerButton tone="ghost" onClick={() => setDeleteOpen(false)}>Annuler</DrawerButton><DrawerButton tone="danger" disabled={busy} onClick={() => void remove()}>Supprimer</DrawerButton></div></div> : null}
        {toast ? <div className="lkdv-post-toast" role="status">{toast}</div> : null}
      </OverlaySheet>

      {reportOpen && post ? <ReportPicker title="Signaler la publication" onClose={() => setReportOpen(false)} onPick={(reason) => void doReport(reason)} /> : null}
      {reportComment ? <ReportPicker title="Signaler le commentaire" onClose={() => setReportComment(null)} onPick={(reason) => void doReportComment(reason)} /> : null}
      {lightbox && currentMedia ? <div className="lkdv-post-lightbox" role="dialog" aria-modal="true"><button type="button" className="lkdv-post-lightbox-close" onClick={() => setLightbox(false)} aria-label="Fermer">×</button><img src={currentMedia} alt="" /></div> : null}
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
