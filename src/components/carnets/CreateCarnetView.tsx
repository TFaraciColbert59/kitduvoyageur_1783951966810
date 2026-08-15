'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

export interface ChapterItem {
  id: string;
  num: string;
  title: string;
  wordCount: number;
  photoCount: number;
  status: 'Rédigé' | 'En cours' | 'À écrire';
  content?: string;
}

export default function CreateCarnetView({ onCloseModal }: { onCloseModal?: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  // Chapter editing modal state
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editChapterTitle, setEditChapterTitle] = useState('');
  const [editChapterStatus, setEditChapterStatus] = useState<'Rédigé' | 'En cours' | 'À écrire'>('Rédigé');
  const [editChapterWords, setEditChapterWords] = useState(500);
  const [editChapterPhotos, setEditChapterPhotos] = useState(2);
  const [editChapterContent, setEditChapterContent] = useState('');

  // Form State
  const [form, setForm] = useState({
    title: 'Trois jours sur les crêtes',
    subtitle: 'Chartreuse · octobre 2026 · 27 km à deux',
    chapeau: '« On était deux, un thermos à moitié rempli, et l\'idée qu\'on se trompait pas exactement de ce qu\'on cherchait. La brume s\'est levée après — c\'est là que le voyage a commencé, vraiment. »',
    coverImage: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1200',
    linkedAdventureId: 'av-1',
    readingStyle: 'journal', // 'journal' | 'paper' | 'recit'
    chapters: [
      { id: 'ch-1', num: 'I', title: 'La montée au silence', wordCount: 640, photoCount: 3, status: 'Rédigé', content: 'Le soleil perçait à peine la brume matinale au col de la Chamette...' },
      { id: 'ch-2', num: 'II', title: 'Le refuge et ce qu\'on y a trouvé', wordCount: 1240, photoCount: 5, status: 'Rédigé', content: 'Une cabane en bois brut sous les arêtes, le poêle crépitait encore...' },
      { id: 'ch-3', num: 'III', title: 'Le col à 2100m sous le vent', wordCount: 420, photoCount: 1, status: 'En cours', content: 'Le vent balayait les crêtes rocailleuses...' },
      { id: 'ch-4', num: 'IV', title: 'Des crêtes jusqu\'en bas', wordCount: 0, photoCount: 0, status: 'À écrire', content: '' }
    ] as ChapterItem[],
    selectedThemes: ['Bivouac', 'Chartreuse', 'Solo', 'Refuge gardé', 'Automne'],
    customTags: ['Crêtes', 'Alpes', 'Automne 2026'],
    newTagInput: '',
    publishTiming: 'now', // 'brouillon' | 'now' | 'planifie'
    visibility: 'public', // 'public' | 'subscribers' | 'private'
    allowComments: true,
    recommendToReaders: true,
    allowPdfDownload: false
  });

  const availableThemes = [
    'Bivouac', 'Chartreuse', 'Solo', 'Refuge gardé', 'Automne', 
    'Été', 'Hiver', 'Traversée', 'Sommet', 'Nuit étoilée', 'Faune', 'Rencontre'
  ];

  const linkedAdventuresList = [
    { id: 'av-1', title: 'Traversée de la Chartreuse', date: '12-14 oct. 2026', details: '27.4 km • 3 refuges', gpx: true },
    { id: 'av-2', title: 'Arêtes du Charmant Som', date: '28 sept. 2026', details: '14.2 km • 1 jour', gpx: false },
    { id: 'av-3', title: 'Bivouac au lac Achard', date: '15 sept. 2026', details: '18.6 km • 2 jours', gpx: true }
  ];

  // Load User Profile on Mount
  useEffect(() => {
    async function loadUser() {
      try {
        const supabase = createClient();
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
          setUser(currentUser);
        }
      } catch (err) {
        console.error("Error loading user:", err);
      }
    }
    loadUser();
  }, []);

  // Field Setters
  const setField = (key: string, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const toggleTheme = (theme: string) => {
    setForm(prev => {
      const exists = prev.selectedThemes.includes(theme);
      return {
        ...prev,
        selectedThemes: exists ? prev.selectedThemes.filter(t => t !== theme) : [...prev.selectedThemes, theme]
      };
    });
  };

  const addCustomTag = () => {
    if (!form.newTagInput.trim()) return;
    const tag = form.newTagInput.trim();
    if (!form.customTags.includes(tag)) {
      setForm(prev => ({ ...prev, customTags: [...prev.customTags, tag], newTagInput: '' }));
    }
  };

  const removeCustomTag = (tag: string) => {
    setForm(prev => ({ ...prev, customTags: prev.customTags.filter(t => t !== tag) }));
  };

  // Chapter Handlers
  const addChapter = () => {
    const nextNumIndex = form.chapters.length;
    const romanNums = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
    const newCh: ChapterItem = {
      id: `ch-${Date.now()}`,
      num: romanNums[nextNumIndex] || `${nextNumIndex + 1}`,
      title: `Chapitre ${nextNumIndex + 1}`,
      wordCount: 0,
      photoCount: 0,
      status: 'À écrire',
      content: ''
    };
    setForm(prev => ({ ...prev, chapters: [...prev.chapters, newCh] }));
  };

  const removeChapter = (id: string) => {
    const romanNums = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
    setForm(prev => {
      const filtered = prev.chapters.filter(ch => ch.id !== id);
      const reindexed = filtered.map((ch, idx) => ({ ...ch, num: romanNums[idx] || `${idx + 1}` }));
      return { ...prev, chapters: reindexed };
    });
  };

  const startEditChapter = (ch: ChapterItem) => {
    setEditingChapterId(ch.id);
    setEditChapterTitle(ch.title);
    setEditChapterStatus(ch.status);
    setEditChapterWords(ch.wordCount);
    setEditChapterPhotos(ch.photoCount);
    setEditChapterContent(ch.content || '');
  };

  const saveChapterChanges = () => {
    if (!editingChapterId) return;
    setForm(prev => ({
      ...prev,
      chapters: prev.chapters.map(ch => ch.id === editingChapterId ? {
        ...ch,
        title: editChapterTitle,
        status: editChapterStatus,
        wordCount: editChapterWords,
        photoCount: editChapterPhotos,
        content: editChapterContent
      } : ch)
    }));
    setEditingChapterId(null);
  };

  // Total Words
  const totalWords = React.useMemo(() => {
    return form.chapters.reduce((acc, ch) => acc + ch.wordCount, 0);
  }, [form.chapters]);

  // Progress Score Calculation
  const completionScore = React.useMemo(() => {
    let score = 0;
    if (form.title) score += 20;
    if (form.coverImage) score += 15;
    if (form.linkedAdventureId) score += 15;
    if (form.chapters.length >= 2) score += 20;
    if (form.selectedThemes.length >= 2) score += 15;
    if (form.chapeau) score += 15;
    return Math.min(100, score);
  }, [form]);

  // Submit Carnet to Supabase
  const handlePublish = async (isDraft = false) => {
    if (!form.title.trim()) {
      alert("Veuillez indiquer au moins un titre pour votre carnet.");
      return;
    }

    setSaving(true);
    setSaveSuccess(false);

    try {
      const supabase = createClient();
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const authorId = currentUser?.id;

      const payload = {
        title: form.title,
        destination: form.subtitle || 'Alpes',
        description: form.chapeau,
        cover_image: form.coverImage,
        cover_image_alt: form.title,
        tags: [...form.selectedThemes],
        visibility: form.visibility === 'private' ? 'private' : form.visibility === 'subscribers' ? 'friends' : 'public',
        is_collaborative: false,
        author_id: authorId || null,
        likes_count: 0,
        comments_count: 0,
        favorites_count: 0,
        views_count: 0,
        verified: false,
      };

      const { data: newCarnet, error } = await supabase
        .from('carnets')
        .insert(payload)
        .select('id')
        .single();

      if (error) {
        alert("Impossible de publier le carnet : " + (error.message || 'erreur serveur'));
        setSaving(false);
        return;
      }

      setSaveSuccess(true);

      // Persist to localStorage for instant local reflection in community feed & user profile
      try {
        const existing = JSON.parse(localStorage.getItem('user_carnets_data') || '[]');
        const localRecord = newCarnet ? { ...payload, id: newCarnet.id } : { ...payload, id: `local-${Date.now()}` };
        localStorage.setItem('user_carnets_data', JSON.stringify([localRecord, ...existing]));
        window.dispatchEvent(new Event('carnet_created'));
      } catch (e) {
        console.error(e);
      }

      setTimeout(() => {
        setSaveSuccess(false);
        if (onCloseModal) {
          onCloseModal();
        } else if (newCarnet?.id) {
          router.push(`/carnets/${newCarnet.id}`);
        } else {
          router.push('/carnets');
        }
      }, 800);
    } catch (err) {
      console.error("Error creating carnet:", err);
      alert("Une erreur est survenue lors de la création du carnet.");
    } finally {
      setSaving(false);
    }
  };

  const selectedAdventure = linkedAdventuresList.find(a => a.id === form.linkedAdventureId);

  return (
    <>
      {/* ── DESKTOP ── */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-[#F5F2E8] font-sans text-[#1C2620] pb-28">
      
      {/* 1. TOP STICKY NAVBAR */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[#E8E4D8] px-4 sm:px-8 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/communaute" className="flex items-center gap-2 text-xs font-semibold text-[#5C6B5E] hover:text-[#1C2620] transition-colors">
            <Icon name="ArrowLeftIcon" size={16} />
            <span>Communauté</span>
          </Link>
          <span className="text-[#E8E4D8]">|</span>
          <span className="text-xs font-bold text-[#1C2620] uppercase tracking-wider">Nouveau carnet</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setPreviewModalOpen(true)}
            className="px-4 py-2 rounded-full text-xs font-bold text-[#2D5A3D] bg-[#EAF0EB] border border-[#2D5A3D]/20 hover:bg-[#2D5A3D] hover:text-white transition-colors flex items-center gap-1.5"
          >
            <Icon name="EyeIcon" size={14} />
            <span>Aperçu lecteur</span>
          </button>

          <button
            onClick={() => handlePublish(true)}
            disabled={saving}
            className="px-4 py-2 rounded-full text-xs font-semibold text-[#5C6B5E] border border-[#E8E4D8] hover:bg-[#F5F2E8] hover:text-[#1C2620] transition-colors"
          >
            Sauvegarder
          </button>

          <button
            onClick={() => handlePublish(false)}
            disabled={saving || !form.title.trim()}
            className="px-5 py-2 bg-[#2D5A3D] hover:bg-[#1C2620] text-white rounded-full text-xs font-bold shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <span>{saving ? 'Publication...' : saveSuccess ? '✓ Publié !' : 'Publier'}</span>
          </button>
        </div>
      </header>

      {/* 2. HERO TITLE SECTION */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6">
        <div className="text-[10px] font-mono tracking-widest text-[#5C6B5E] uppercase font-bold mb-2">
          — NOUVEAU CARNET DE VOYAGE
        </div>
        <h1 className="font-display font-800 text-3xl sm:text-5xl text-[#1C2620] tracking-tight mb-3">
          Un récit, <br className="hidden sm:inline" />
          <em className="font-serif italic font-normal text-[#2D5A3D]">pas un rapport.</em>
        </h1>
        <p className="text-xs sm:text-sm text-[#5C6B5E] max-w-2xl leading-relaxed">
          Un carnet, c'est du temps rendu visible : les images, les silences qui restent, et ce que la trace n'a pas su enregistrer.
        </p>
      </div>

      {/* 3. MAIN FORM & SIDEBAR GRID */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: FORM SECTIONS (8 COLS) */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* ─── SECTION 01: COUVERTURE & TITRE ──────────────────────── */}
          <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 border border-[#E8E4D8] shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#F5F2E8]">
              <div>
                <h2 className="font-display font-800 text-xl text-[#1C2620]">Couverture & titre</h2>
                <p className="text-xs text-[#5C6B5E] mt-0.5">Une image forte, un titre en un mot ou en trois. C'est ce que la communauté verra sur le fil de la maison.</p>
              </div>
              <span className="text-[10px] font-mono font-bold tracking-widest uppercase bg-[#F5F2E8] px-2.5 py-1 rounded-full text-[#5C6B5E]">
                01 · VISUEL & CARTE
              </span>
            </div>

            {/* Cover Image Live Showcase Card */}
            <div className="relative rounded-2xl overflow-hidden min-h-[220px] sm:min-h-[280px] bg-[#1C2620] text-white p-6 flex flex-col justify-end group shadow-lg">
              <img src={form.coverImage} alt="Couverture" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
              
              <div className="absolute top-4 left-4">
                <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest text-white border border-white/20 font-bold">
                  APERÇU · COUVERTURE
                </span>
              </div>

              <div className="absolute top-4 right-4 flex gap-2">
                <label className="px-3 py-1.5 bg-white/90 hover:bg-white text-[#1C2620] text-xs font-bold rounded-full shadow-md cursor-pointer transition-colors flex items-center gap-1">
                  <Icon name="CameraIcon" size={14} /> Changer
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setField('coverImage', URL.createObjectURL(e.target.files[0]));
                    }
                  }} />
                </label>
                <button 
                  onClick={() => setField('coverImage', 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1200')}
                  className="px-3 py-1.5 bg-black/60 hover:bg-black/80 text-white text-xs font-semibold rounded-full backdrop-blur-md transition-colors"
                >
                  Masquer
                </button>
              </div>

              <div className="relative z-10 space-y-1 max-w-xl">
                <h3 className="font-display font-800 text-2xl sm:text-4xl text-white tracking-tight">
                  {form.title || 'Titre de votre carnet'}
                </h3>
                <p className="text-xs sm:text-sm text-white/80 font-mono">
                  {form.subtitle || 'Lieu • Saison • Format'}
                </p>
              </div>
            </div>

            {/* Inputs */}
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-1">Titre du carnet *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setField('title', e.target.value)}
                  placeholder="Ex: Trois jours sur les crêtes"
                  className="w-full bg-[#F5F2E8] border-none rounded-2xl px-4 py-3 text-sm text-[#1C2620] font-bold focus:ring-1 focus:ring-[#2D5A3D]"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-1">Sous-titre (Contexte / Lieu)</label>
                <input
                  type="text"
                  value={form.subtitle}
                  onChange={e => setField('subtitle', e.target.value)}
                  placeholder="Ex: Chartreuse · octobre 2026 · 27 km à deux"
                  className="w-full bg-[#F5F2E8] border-none rounded-2xl px-4 py-3 text-xs text-[#1C2620] font-semibold focus:ring-1 focus:ring-[#2D5A3D]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block">Chapeau (Introduction courte)</label>
                  <span className="text-[10px] font-mono text-[#5C6B5E]">{form.chapeau.length} / 300</span>
                </div>
                <textarea
                  rows={3}
                  maxLength={300}
                  value={form.chapeau}
                  onChange={e => setField('chapeau', e.target.value)}
                  placeholder="Deux ou trois phrases qui donnent le ton de la lecture..."
                  className="w-full bg-[#F5F2E8] border-none rounded-2xl p-4 text-xs text-[#1C2620] font-serif italic leading-relaxed resize-none focus:ring-1 focus:ring-[#2D5A3D]"
                />
              </div>
            </div>
          </div>


          {/* ─── SECTION 02: AVENTURE ASSOCIÉE ─────────────────────── */}
          <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 border border-[#E8E4D8] shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#F5F2E8]">
              <div>
                <h2 className="font-display font-800 text-xl text-[#1C2620]">Aventure associée</h2>
                <p className="text-xs text-[#5C6B5E] mt-0.5">Le carnet peut être rattaché à une aventure enregistrée : les traces GPX, les dates et les participants s'afficheront sous votre récit.</p>
              </div>
              <span className="text-[10px] font-mono font-bold tracking-widest uppercase bg-[#F5F2E8] px-2.5 py-1 rounded-full text-[#5C6B5E]">
                02 · SOURCING
              </span>
            </div>

            <div className="space-y-3">
              {linkedAdventuresList.map(adv => {
                const isSelected = form.linkedAdventureId === adv.id;
                return (
                  <div
                    key={adv.id}
                    onClick={() => setField('linkedAdventureId', isSelected ? null : adv.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                      isSelected 
                        ? 'bg-[#EAF0EB] border-[#2D5A3D] shadow-sm' 
                        : 'bg-[#F5F2E8] border-transparent hover:border-[#E8E4D8]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#2D5A3D] text-white flex items-center justify-center font-bold text-sm shrink-0">
                        🏔️
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-[#1C2620]">{adv.title}</h4>
                        <p className="text-[10px] text-[#5C6B5E] font-mono mt-0.5">{adv.date} • {adv.details}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                        isSelected 
                          ? 'bg-[#2D5A3D] text-white' 
                          : 'bg-white text-[#5C6B5E] border border-[#E8E4D8]'
                      }`}
                    >
                      {isSelected ? '✓ Associée' : 'Associer'}
                    </button>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => setField('linkedAdventureId', null)}
                className="w-full py-3 rounded-2xl border border-dashed border-[#E8E4D8] hover:border-[#2D5A3D] text-xs font-semibold text-[#5C6B5E] hover:text-[#1C2620] transition-colors text-center"
              >
                + Créer un carnet sans aventure liée
              </button>
            </div>
          </div>


          {/* ─── SECTION 03: STYLE DE LECTURE ───────────────────────── */}
          <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 border border-[#E8E4D8] shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#F5F2E8]">
              <div>
                <h2 className="font-display font-800 text-xl text-[#1C2620]">Style de lecture</h2>
                <p className="text-xs text-[#5C6B5E] mt-0.5">Lisez la typographie de votre texte "Chapeau" pour un carnet d'origine. "Paper Page" pour un récit plus documentaire.</p>
              </div>
              <span className="text-[10px] font-mono font-bold tracking-widest uppercase bg-[#F5F2E8] px-2.5 py-1 rounded-full text-[#5C6B5E]">
                03 · PRÉFÉRENCE
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { id: 'journal', name: 'Journal', font: 'Sans + Serif italique', preview: 'Aa Aa' },
                { id: 'paper', name: 'Paper Page', font: 'Texte documentaire', preview: 'Aa' },
                { id: 'recit', name: 'Récit', font: 'Typographique', preview: 'Aa' }
              ].map(style => {
                const isActive = form.readingStyle === style.id;
                return (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setField('readingStyle', style.id)}
                    className={`p-5 rounded-2xl border transition-all text-center flex flex-col justify-between min-h-[120px] ${
                      isActive 
                        ? 'bg-[#EAF0EB] border-[#2D5A3D] shadow-md ring-1 ring-[#2D5A3D]' 
                        : 'bg-[#F5F2E8] border-transparent hover:bg-[#E8E4D8]'
                    }`}
                  >
                    <div className={`text-2xl font-bold mb-2 ${style.id === 'journal' ? 'font-serif italic' : style.id === 'paper' ? 'font-mono' : 'font-display'}`}>
                      {style.preview}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-[#1C2620]">{style.name}</div>
                      <div className="text-[10px] text-[#5C6B5E] font-mono mt-0.5">{style.font}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>


          {/* ─── SECTION 04: L'ÉTAPE PAR ÉTAPE (CHAPITRES) ──────────── */}
          <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 border border-[#E8E4D8] shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#F5F2E8]">
              <div>
                <h2 className="font-display font-800 text-xl text-[#1C2620]">L'Étape par Étape</h2>
                <p className="text-xs text-[#5C6B5E] mt-0.5">Découpez votre récit en 3 à 5 chapitres. Chacun aura sa propre image et pourra être publié séparément.</p>
              </div>
              <span className="text-[10px] font-mono font-bold tracking-widest uppercase bg-[#F5F2E8] px-2.5 py-1 rounded-full text-[#5C6B5E]">
                04 · STRUCTURE
              </span>
            </div>

            <div className="space-y-3">
              {form.chapters.map((ch) => (
                <div key={ch.id} className="bg-[#F5F2E8] p-4 rounded-2xl flex items-center justify-between gap-4 border border-[#E8E4D8] hover:border-[#2D5A3D] transition-all">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <span className="font-serif font-bold text-lg text-[#2D5A3D] w-6 text-center shrink-0">{ch.num}</span>
                    <div className="min-w-0 flex-1">
                      <input
                        type="text"
                        value={ch.title}
                        onChange={e => {
                          const val = e.target.value;
                          setForm(prev => ({
                            ...prev,
                            chapters: prev.chapters.map(c => c.id === ch.id ? { ...c, title: val } : c)
                          }));
                        }}
                        className="bg-transparent border-none text-xs font-bold text-[#1C2620] focus:ring-0 p-0 w-full"
                      />
                      <p className="text-[10px] text-[#5C6B5E] font-mono mt-0.5">
                        {ch.wordCount} mots • {ch.photoCount} photos • <span className={`font-bold ${ch.status === 'Rédigé' ? 'text-[#2D5A3D]' : ch.status === 'En cours' ? 'text-amber-600' : 'text-gray-400'}`}>{ch.status}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button 
                      type="button" 
                      onClick={() => startEditChapter(ch)}
                      className="px-3 py-1 bg-white hover:bg-[#2D5A3D] text-[#1C2620] hover:text-white rounded-full text-xs font-bold transition-all border border-[#E8E4D8]"
                    >
                      ✏️ Éditer
                    </button>
                    <button type="button" onClick={() => removeChapter(ch.id)} className="p-1.5 text-[#5C6B5E] hover:text-red-500 transition-colors">
                      <Icon name="TrashIcon" size={14} />
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addChapter}
                className="w-full py-3 rounded-2xl bg-[#EAF0EB] text-[#2D5A3D] text-xs font-bold hover:bg-[#2D5A3D] hover:text-white transition-colors text-center shadow-sm"
              >
                + Ajouter un chapitre
              </button>
            </div>
          </div>


          {/* ─── SECTION 05: MOTS-CLÉS & CLASSEMENT ──────────────────── */}
          <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 border border-[#E8E4D8] shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#F5F2E8]">
              <div>
                <h2 className="font-display font-800 text-xl text-[#1C2620]">Mots-clés & classement</h2>
                <p className="text-xs text-[#5C6B5E] mt-0.5">Les tags permettent de facilement retrouver vos carnets dans le journal de la communauté.</p>
              </div>
              <span className="text-[10px] font-mono font-bold tracking-widest uppercase bg-[#F5F2E8] px-2.5 py-1 rounded-full text-[#5C6B5E]">
                05 · RÉFÉRENCEMENT
              </span>
            </div>

            <div>
              <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-2">Thématiques</label>
              <div className="flex flex-wrap gap-2">
                {availableThemes.map(theme => {
                  const isSelected = form.selectedThemes.includes(theme);
                  return (
                    <button
                      key={theme}
                      type="button"
                      onClick={() => toggleTheme(theme)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                        isSelected 
                          ? 'bg-[#2D5A3D] text-white shadow-sm' 
                          : 'bg-[#F5F2E8] text-[#5C6B5E] hover:bg-[#E8E4D8] hover:text-[#1C2620]'
                      }`}
                    >
                      {isSelected ? `✓ ${theme}` : theme}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-2">Tags libres</label>
              <div className="flex flex-wrap items-center gap-2 bg-[#F5F2E8] p-3 rounded-2xl border border-[#E8E4D8]">
                {form.customTags.map(tag => (
                  <span key={tag} className="bg-[#2D5A3D] text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5">
                    <span>{tag}</span>
                    <button type="button" onClick={() => removeCustomTag(tag)} className="hover:text-red-300">✕</button>
                  </span>
                ))}

                <div className="flex items-center gap-2 flex-1 min-w-[140px]">
                  <input
                    type="text"
                    value={form.newTagInput}
                    onChange={e => setField('newTagInput', e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomTag())}
                    placeholder="Ajouter un tag..."
                    className="bg-transparent border-none text-xs text-[#1C2620] focus:ring-0 p-1 w-full"
                  />
                  <button type="button" onClick={addCustomTag} className="px-2.5 py-1 bg-[#1C2620] text-white text-[10px] font-bold rounded-full">
                    + Add
                  </button>
                </div>
              </div>
            </div>
          </div>


          {/* ─── SECTION 06: DIFFUSION & AUDIENCE ───────────────────── */}
          <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 border border-[#E8E4D8] shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#F5F2E8]">
              <div>
                <h2 className="font-display font-800 text-xl text-[#1C2620]">Diffusion & audience</h2>
                <p className="text-xs text-[#5C6B5E] mt-0.5">Vous pouvez publier maintenant, planifier une date ou garder ce carnet en brouillon.</p>
              </div>
              <span className="text-[10px] font-mono font-bold tracking-widest uppercase bg-[#F5F2E8] px-2.5 py-1 rounded-full text-[#5C6B5E]">
                06 · PUBLICATION
              </span>
            </div>

            {/* Timing selection */}
            <div>
              <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-2">Quand publier ?</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: 'brouillon', label: '⭕ Enregistrer en brouillon' },
                  { id: 'now', label: '✓ Publier maintenant' },
                  { id: 'planifie', label: '📅 Planifier' }
                ].map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setField('publishTiming', t.id)}
                    className={`py-3 px-4 rounded-2xl text-xs font-bold border transition-all text-center ${
                      form.publishTiming === t.id 
                        ? 'bg-[#2D5A3D] text-white border-[#2D5A3D] shadow-sm' 
                        : 'bg-[#F5F2E8] text-[#5C6B5E] border-transparent hover:bg-[#E8E4D8]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Visibility choice cards */}
            <div>
              <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-2">Accès au carnet</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: 'public', title: '🌐 Journal public', desc: 'Visible par toute la communauté' },
                  { id: 'subscribers', title: '🔒 Abonnés uniquement', desc: 'Seuls vos abonnés peuvent lire' },
                  { id: 'private', title: '🔒 Privé (Moi seul)', desc: 'Contenu et journal personnel' }
                ].map(item => {
                  const isActive = form.visibility === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setField('visibility', item.id)}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        isActive 
                          ? 'bg-[#EAF0EB] border-[#2D5A3D] shadow-sm ring-1 ring-[#2D5A3D]' 
                          : 'bg-[#F5F2E8] border-transparent hover:bg-[#E8E4D8]'
                      }`}
                    >
                      <div className="font-bold text-xs text-[#1C2620]">{item.title}</div>
                      <div className="text-[10px] text-[#5C6B5E] mt-0.5">{item.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-3 pt-2">
              {[
                { key: 'allowComments', title: 'Autoriser les commentaires', desc: 'Les lecteurs peuvent laisser des messages sous chaque chapitre.' },
                { key: 'recommendToReaders', title: 'Recommander aux nouveaux lecteurs', desc: 'Ce carnet peut apparaître dans la section "À ne pas manquer".' },
                { key: 'allowPdfDownload', title: 'Autoriser le téléchargement PDF', desc: 'Les lecteurs peuvent enregistrer le carnet complet.' }
              ].map(item => {
                const val = (form as any)[item.key];
                return (
                  <div key={item.key} className="flex items-center justify-between gap-4 py-2 border-b border-[#F5F2E8] last:border-none">
                    <div>
                      <h4 className="font-bold text-xs text-[#1C2620]">{item.title}</h4>
                      <p className="text-[11px] text-[#5C6B5E] mt-0.5">{item.desc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setField(item.key, !val)}
                      className={`w-12 h-6 rounded-full transition-colors relative p-1 shrink-0 ${
                        val ? 'bg-[#2D5A3D]' : 'bg-[#E8E4D8]'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${
                        val ? 'translate-x-6' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

        </div>


        {/* RIGHT COLUMN: SIDEBAR WIDGETS (4 COLS) */}
        <div className="lg:col-span-4 space-y-6 sticky top-20">
          
          {/* WIDGET 1: CARNET EN BROUILLON (Live Preview) */}
          <div className="bg-[#1C2620] rounded-[2.5rem] p-6 text-white shadow-xl relative overflow-hidden space-y-4">
            <div className="text-[9px] font-mono tracking-widest text-[#17402C] uppercase font-bold">CARNET EN BROUILLON</div>

            <div className="relative rounded-2xl overflow-hidden aspect-[16/9]">
              <img src={form.coverImage} alt="Cover preview" className="w-full h-full object-cover" />
            </div>

            <div>
              <h3 className="font-display font-800 text-lg leading-tight">{form.title || 'Titre du carnet'}</h3>
              <p className="text-[11px] text-white/70 font-mono mt-1">{form.subtitle}</p>
            </div>

            <div className="flex items-center justify-between text-xs text-white/80 pt-2 border-t border-white/10 font-mono">
              <span>📖 {form.chapters.length} chapitres</span>
              <span>💬 0 com.</span>
            </div>

            <button
              onClick={() => setPreviewModalOpen(true)}
              className="w-full py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all text-center border border-white/10"
            >
              👁️ Ouvrir l'aperçu complet
            </button>
          </div>


          {/* WIDGET 2: RÉDACTION X% */}
          <div className="bg-white rounded-[2.5rem] p-6 border border-[#E8E4D8] shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-800 text-sm text-[#1C2620]">Rédaction {completionScore}%</h3>
              <span className="text-xs font-mono font-bold text-[#2D5A3D]">{completionScore}/100</span>
            </div>

            <div className="w-full bg-[#F5F2E8] h-2.5 rounded-full overflow-hidden">
              <div className="bg-[#2D5A3D] h-full transition-all duration-500 rounded-full" style={{ width: `${completionScore}%` }} />
            </div>

            <div className="space-y-2 pt-2">
              {[
                { label: 'Couverture + Titre', done: !!form.title && !!form.coverImage },
                { label: 'Titres d\'étapes', done: form.chapters.length >= 2 },
                { label: 'Aventure liée', done: !!form.linkedAdventureId },
                { label: 'Terminer chapitre II', done: true },
                { label: 'Rédiger chapitre IV', done: false },
                { label: 'Ajouter 3 photos par chapitre', done: false }
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between text-xs">
                  <span className={item.done ? 'text-[#1C2620] font-medium' : 'text-[#5C6B5E]'}>
                    {item.done ? '✓ ' : '⭕ '}{item.label}
                  </span>
                  <span className="text-[10px] font-mono text-[#5C6B5E]">{item.done ? 'Fait' : 'À faire'}</span>
                </div>
              ))}
            </div>
          </div>


          {/* WIDGET 3: ASTUCES RÉDACTION */}
          <div className="bg-[#EAF0EB] rounded-[2.5rem] p-6 text-[#1C2620] space-y-2 border border-[#2D5A3D]/20">
            <div className="text-[10px] font-mono tracking-widest text-[#2D5A3D] uppercase font-bold">CONSEIL RÉDACTION</div>
            <h4 className="font-display font-800 text-sm">Une image tous les 300 mots.</h4>
            <p className="text-xs text-[#4A574C] leading-relaxed">
              Les carnets qui gardent l'attention alternent texte serré et respiration visuelle. Evitez les galeries en fin de carnet.
            </p>
          </div>

        </div>

      </div>

      {/* 4. FLOATING BOTTOM BAR */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1C2620]/95 backdrop-blur-md text-white px-6 py-3.5 rounded-full shadow-2xl flex items-center gap-6 border border-[#2D5A3D] max-w-xl w-11/12 justify-between">
        <div className="text-xs text-white/80 hidden sm:flex items-center gap-2 font-mono">
          <span>⚡</span>
          <span>Brouillon • {totalWords} mots • Sauvegardé</span>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button 
            onClick={() => setPreviewModalOpen(true)} 
            className="px-4 py-2 text-xs font-semibold text-white/90 hover:text-white transition-colors bg-white/10 hover:bg-white/20 rounded-full"
          >
            Aperçu lecteur
          </button>
          
          <button
            onClick={() => handlePublish(false)}
            disabled={saving || !form.title.trim()}
            className="px-6 py-2.5 bg-[#2D5A3D] hover:bg-[#17402C] text-white rounded-full text-xs font-bold shadow-lg transition-all disabled:opacity-50"
          >
            {saving ? 'Publication...' : saveSuccess ? '✓ Publié !' : 'Publier le carnet'}
          </button>
        </div>
      </div>

    </div>
      </div>

      {/* ── MOBILE ── */}
      <div className="block md:hidden">
        <MobilePageShell background="#F5F2E8">
          {/* Sticky header */}
          <div style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(251,250,246,0.92)', backdropFilter: 'blur(16px) saturate(1.5)', WebkitBackdropFilter: 'blur(16px) saturate(1.5)', borderBottom: '1px solid rgba(11,31,23,0.06)', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Link href="/communaute" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 500, color: '#0B1F17', textDecoration: 'none' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0B1F17" strokeWidth="1.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              </Link>
              <span style={{ fontSize: '17px', fontWeight: 600, color: '#0B1F17', letterSpacing: '-0.01em' }}>Nouveau carnet</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ background: '#EDF3ED', borderRadius: '999px', padding: '2px 10px', fontSize: '10px', fontFamily: 'ui-monospace, monospace', fontWeight: 600, color: '#17402C' }}>
                {completionScore}%
              </div>
            </div>
          </div>

          <div style={{ padding: '16px' }}>
            {/* Cover image */}
            <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', minHeight: '200px', background: '#0B1F17', marginBottom: '16px' }}>
              <img src={form.coverImage} alt="Couverture" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(11,31,23,0.8), rgba(11,31,23,0.2))' }} />
              <div style={{ position: 'absolute', bottom: '12px', left: '12px', right: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div style={{ color: '#fff', fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em', textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>
                  {form.title || 'Titre du carnet'}
                </div>
                <label style={{ background: 'rgba(255,255,255,0.9)', color: '#0B1F17', border: 'none', borderRadius: '999px', padding: '6px 12px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'inherit' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  Changer
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setField('coverImage', URL.createObjectURL(e.target.files[0]));
                    }
                  }} />
                </label>
              </div>
            </div>

            {/* Title input */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.14em', color: '#6B7A72', display: 'block', marginBottom: '4px', fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>
                Titre *
              </label>
              <input
                type="text"
                value={form.title}
                onChange={e => setField('title', e.target.value)}
                placeholder="Ex: Trois jours sur les crêtes"
                style={{ width: '100%', background: '#FBFAF6', border: '1px solid rgba(11,31,23,0.06)', borderRadius: '12px', padding: '10px 14px', fontSize: '15px', fontWeight: 600, color: '#0B1F17', outline: 'none', fontFamily: 'inherit' }}
              />
            </div>

            {/* Subtitle input */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.14em', color: '#6B7A72', display: 'block', marginBottom: '4px', fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>
                Sous-titre
              </label>
              <input
                type="text"
                value={form.subtitle}
                onChange={e => setField('subtitle', e.target.value)}
                placeholder="Chartreuse · octobre 2026 · 27 km à deux"
                style={{ width: '100%', background: '#FBFAF6', border: '1px solid rgba(11,31,23,0.06)', borderRadius: '12px', padding: '10px 14px', fontSize: '13px', fontWeight: 500, color: '#0B1F17', outline: 'none', fontFamily: 'inherit' }}
              />
            </div>

            {/* Chapeau textarea */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.14em', color: '#6B7A72', fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>
                  Chapeau
                </label>
                <span style={{ fontSize: '10px', fontFamily: 'ui-monospace, monospace', color: '#6B7A72' }}>{form.chapeau.length} / 300</span>
              </div>
              <textarea
                rows={3}
                maxLength={300}
                value={form.chapeau}
                onChange={e => setField('chapeau', e.target.value)}
                placeholder="Deux ou trois phrases qui donnent le ton de la lecture..."
                style={{ width: '100%', background: '#FBFAF6', border: '1px solid rgba(11,31,23,0.06)', borderRadius: '12px', padding: '10px 14px', fontSize: '13px', fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#0B1F17', outline: 'none', lineHeight: '1.6', resize: 'none' }}
              />
            </div>

            {/* Chapter list */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.14em', color: '#6B7A72', fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>
                  Chapitres ({form.chapters.length})
                </label>
                <button
                  type="button"
                  onClick={addChapter}
                  style={{ background: 'none', border: 'none', fontSize: '11px', fontWeight: 600, color: '#17402C', cursor: 'pointer', padding: '2px 6px', fontFamily: 'inherit' }}
                >
                  + Ajouter
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {form.chapters.map(ch => (
                  <div key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: '#FBFAF6', borderRadius: '12px', border: '1px solid rgba(11,31,23,0.06)' }}>
                    <span style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: '14px', color: '#17402C', width: '20px', textAlign: 'center', flexShrink: 0 }}>{ch.num}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#0B1F17', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ch.title}</div>
                      <div style={{ fontSize: '10px', fontFamily: 'ui-monospace, monospace', color: '#6B7A72', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{ch.wordCount} mots</span>
                        <span>·</span>
                        <span style={{
                          fontWeight: 600,
                          color: ch.status === 'Rédigé' ? '#2D6B4A' : ch.status === 'En cours' ? '#B8860B' : '#A3A8A3'
                        }}>{ch.status}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => startEditChapter(ch)}
                      style={{ background: '#F4F1EA', border: 'none', borderRadius: '999px', padding: '4px 10px', fontSize: '10px', fontWeight: 600, color: '#0B1F17', cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }}
                    >
                      Éditer
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Theme tags */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.14em', color: '#6B7A72', display: 'block', marginBottom: '8px', fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>
                Thématiques
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {availableThemes.map(theme => {
                  const isSelected = form.selectedThemes.includes(theme);
                  return (
                    <button
                      key={theme}
                      type="button"
                      onClick={() => toggleTheme(theme)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 600,
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        background: isSelected ? '#17402C' : '#F4F1EA',
                        color: isSelected ? '#fff' : '#6B7A72'
                      }}
                    >
                      {isSelected ? `✓ ${theme}` : theme}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Preview + Publish buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '4px' }}>
              <button
                onClick={() => setPreviewModalOpen(true)}
                style={{ width: '100%', padding: '12px', borderRadius: '999px', border: '1px solid rgba(11,31,23,0.06)', background: '#F4F1EA', color: '#0B1F17', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' }}
              >
                Aperçu lecteur
              </button>
              <button
                onClick={() => handlePublish(false)}
                disabled={saving || !form.title.trim()}
                style={{ width: '100%', padding: '12px', borderRadius: '999px', border: 'none', background: '#17402C', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', opacity: saving || !form.title.trim() ? 0.5 : 1 }}
              >
                {saving ? 'Publication...' : saveSuccess ? 'Publier' : 'Publier le carnet'}
              </button>
            </div>
          </div>

          {/* Footer spacer */}
          <div style={{ height: 'calc(62px + 12px + 12px + env(safe-area-inset-bottom))' }} />
        </MobilePageShell>
      </div>

      {/* ── SHARED MODALS ── */}

      {/* 5. CHAPTER EDIT MODAL */}
      {editingChapterId && (
        <div className="fixed inset-0 z-[350] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] border border-[#E8E4D8] p-6 sm:p-8 w-full max-w-lg shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-[#F5F2E8]">
              <h3 className="font-display font-800 text-lg text-[#1C2620]">Modifier le chapitre</h3>
              <button onClick={() => setEditingChapterId(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-1">Titre du chapitre *</label>
                <input
                  type="text"
                  value={editChapterTitle}
                  onChange={e => setEditChapterTitle(e.target.value)}
                  className="w-full bg-[#F5F2E8] border-none rounded-2xl px-4 py-3 text-xs font-bold text-[#1C2620]"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-1">Statut</label>
                <select
                  value={editChapterStatus}
                  onChange={e => setEditChapterStatus(e.target.value as any)}
                  className="w-full bg-[#F5F2E8] border-none rounded-2xl px-4 py-3 text-xs font-bold text-[#1C2620]"
                >
                  <option value="Rédigé">✓ Rédigé</option>
                  <option value="En cours">⏳ En cours</option>
                  <option value="À écrire">📝 À écrire</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-1">Nombre de mots</label>
                  <input
                    type="number"
                    value={editChapterWords}
                    onChange={e => setEditChapterWords(Number(e.target.value))}
                    className="w-full bg-[#F5F2E8] border-none rounded-2xl px-4 py-3 text-xs font-semibold text-[#1C2620]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-1">Nombre de photos</label>
                  <input
                    type="number"
                    value={editChapterPhotos}
                    onChange={e => setEditChapterPhotos(Number(e.target.value))}
                    className="w-full bg-[#F5F2E8] border-none rounded-2xl px-4 py-3 text-xs font-semibold text-[#1C2620]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-1">Contenu / Récit du chapitre</label>
                <textarea
                  rows={4}
                  value={editChapterContent}
                  onChange={e => setEditChapterContent(e.target.value)}
                  placeholder="Écrivez le récit de cette étape..."
                  className="w-full bg-[#F5F2E8] border-none rounded-2xl p-4 text-xs text-[#1C2620] leading-relaxed resize-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-[#F5F2E8]">
              <button onClick={() => setEditingChapterId(null)} className="px-4 py-2 text-xs font-semibold text-[#5C6B5E]">Annuler</button>
              <button onClick={saveChapterChanges} className="flex-1 py-2.5 bg-[#2D5A3D] hover:bg-[#1C2620] text-white rounded-full text-xs font-bold shadow-md">
                Enregistrer le chapitre
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. FULLSCREEN READER PREVIEW MODAL */}
      {previewModalOpen && (
        <div className="fixed inset-0 z-[300] bg-[#F5F2E8] overflow-y-auto animate-fade-in font-sans">

          {/* Preview Header Bar */}
          <header className="sticky top-0 z-50 bg-[#1C2620] text-white px-6 py-3 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <span className="bg-[#17402C] text-white text-[10px] font-mono font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                👁️ Mode Aperçu Lecteur
              </span>
              <span className="text-xs text-white/60 font-mono hidden sm:inline">
                Style : {form.readingStyle.toUpperCase()}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setPreviewModalOpen(false)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <span>Fermer l'aperçu</span>
                <span>✕</span>
              </button>

              <button
                onClick={() => {
                  setPreviewModalOpen(false);
                  handlePublish(false);
                }}
                className="px-5 py-2 bg-[#2D5A3D] hover:bg-[#17402C] text-white rounded-full text-xs font-bold transition-all shadow-md"
              >
                Publier le carnet
              </button>
            </div>
          </header>

          {/* Reader Content Body */}
          <div className={`max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-10 ${
            form.readingStyle === 'journal' ? 'font-serif' : form.readingStyle === 'paper' ? 'font-mono' : 'font-sans'
          }`}>

            {/* Cover Banner */}
            <div className="relative rounded-[2.5rem] overflow-hidden min-h-[350px] sm:min-h-[450px] shadow-2xl bg-[#1C2620] text-white p-8 sm:p-12 flex flex-col justify-end">
              <img src={form.coverImage} alt={form.title} className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

              <div className="relative z-10 space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-mono font-bold text-white border border-white/20">
                  <span>📖 Carnet de voyage</span>
                </div>

                <h1 className="font-display font-800 text-3xl sm:text-5xl lg:text-6xl text-white tracking-tight leading-tight">
                  {form.title}
                </h1>

                <p className="text-sm sm:text-lg text-white/80 font-mono">
                  {form.subtitle}
                </p>

                {/* Author row */}
                <div className="flex items-center gap-3 pt-4 border-t border-white/20">
                  <div className="w-10 h-10 rounded-full bg-white/30 border-2 border-white overflow-hidden">
                    <img src={user?.user_metadata?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400'} alt="Auteur" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Par Marceline Chevrier</div>
                    <div className="text-[10px] text-white/60 font-mono">Publié en octobre 2026 · {totalWords} mots</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Chapeau Quote Box */}
            {form.chapeau && (
              <div className="bg-white p-8 rounded-[2rem] border border-[#E8E4D8] shadow-sm">
                <p className="italic text-base sm:text-lg text-[#1C2620] leading-relaxed">
                  {form.chapeau}
                </p>
              </div>
            )}

            {/* Linked Adventure Badge */}
            {selectedAdventure && (
              <div className="bg-[#EAF0EB] p-6 rounded-[2rem] border border-[#2D5A3D]/20 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#2D5A3D] text-white flex items-center justify-center text-xl shadow-md">
                    🏔️
                  </div>
                  <div>
                    <div className="text-[10px] font-mono tracking-widest text-[#2D5A3D] font-bold uppercase">AVENTURE ASSOCIÉE</div>
                    <h3 className="font-bold text-sm text-[#1C2620]">{selectedAdventure.title}</h3>
                    <p className="text-xs text-[#5C6B5E] font-mono mt-0.5">{selectedAdventure.date} • {selectedAdventure.details}</p>
                  </div>
                </div>

                <span className="px-4 py-2 bg-white text-[#2D5A3D] rounded-full text-xs font-bold shadow-sm border border-[#E8E4D8]">
                  Tracé GPX disponible
                </span>
              </div>
            )}

            {/* Chapters List Reader view */}
            <div className="space-y-8">
              <h2 className="font-display font-800 text-2xl text-[#1C2620] pb-2 border-b border-[#E8E4D8]">
                Chapitres du récit ({form.chapters.length})
              </h2>

              {form.chapters.map(ch => (
                <div key={ch.id} className="bg-white p-8 rounded-[2.5rem] border border-[#E8E4D8] shadow-sm space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-[#2D5A3D] text-white flex items-center justify-center font-bold text-sm">
                      {ch.num}
                    </span>
                    <h3 className="font-display font-800 text-xl text-[#1C2620]">{ch.title}</h3>
                  </div>

                  <p className="text-xs sm:text-sm text-[#5C6B5E] leading-relaxed">
                    {ch.content || "Le soleil perçait à peine la brume matinale au col. Le vent soufflait régulièrement, balayant les crêtes rocailleuses. Chaque pas sur ce sentier escarpé nous rapprochait du refuge, isolé loin de la foule..."}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-[#5C6B5E] font-mono pt-2 border-t border-[#F5F2E8]">
                    <span>📝 {ch.wordCount} mots</span>
                    <span>📷 {ch.photoCount} photos</span>
                    <span className="text-[#2D5A3D] font-bold">✓ {ch.status}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Tags & Themes */}
            <div className="bg-white p-6 rounded-[2rem] border border-[#E8E4D8] shadow-sm space-y-3">
              <h4 className="text-xs font-mono uppercase tracking-widest text-[#5C6B5E] font-bold">Mots-clés & Thématiques</h4>
              <div className="flex flex-wrap gap-2">
                {form.selectedThemes.map(t => (
                  <span key={t} className="bg-[#2D5A3D] text-white px-3 py-1 rounded-full text-xs font-bold">
                    #{t}
                  </span>
                ))}
                {form.customTags.map(t => (
                  <span key={t} className="bg-[#EAF0EB] text-[#2D5A3D] px-3 py-1 rounded-full text-xs font-bold">
                    #{t}
                  </span>
                ))}
              </div>
            </div>

            {/* Close Bar */}
            <div className="text-center pt-6">
              <button
                onClick={() => setPreviewModalOpen(false)}
                className="px-8 py-3 bg-[#1C2620] text-white rounded-full text-xs font-bold hover:bg-[#2D5A3D] transition-colors shadow-lg"
              >
                ← Revenir à l'édition du carnet
              </button>
            </div>

          </div>
        </div>
      )}

    </>
  );
}
