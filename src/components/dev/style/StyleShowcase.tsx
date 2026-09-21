'use client';

import React, { useEffect, useState } from 'react';
import { Button, IconButton } from '@/components/ui';
import { Chip } from '@/components/ui';
import Icon from '@/components/ui/AppIcon';
import LiquidGlass from '@/components/glass/LiquidGlass';

/* ------------------------------------------------------------------ *
 * Planche de style LKDV — LE style unique des boutons.
 * Toutes les pilules passent par le MÊME composant (pile LiquidGlass,
 * référence section 4). Valeurs pilotées par tokens --btn-* (tokens.css).
 * ------------------------------------------------------------------ */

/** Panneau « variables » : chaque curseur écrit les tokens btn et card
 *  sur :root — TOUS les boutons ET toutes les cards du site changent. */
function VariablePanel() {
  const [tintAlpha, setTintAlpha] = useState(0.2);
  const [radius, setRadius] = useState(999);
  const [blur, setBlur] = useState(6);
  const [content, setContent] = useState('#FFFFFF');
  const [solid, setSolid] = useState('#17402C');
  const [cardAlpha, setCardAlpha] = useState(0.88);
  const [cardRadius, setCardRadius] = useState(28);
  const [cardBlur, setCardBlur] = useState(14);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--btn-tint', `rgba(255,255,255,${tintAlpha})`);
    root.setProperty('--btn-radius', `${radius}px`);
    root.setProperty('--btn-blur', `${blur}px`);
    root.setProperty('--btn-content', content);
    root.setProperty('--btn-tint-solid', solid);
    root.setProperty('--card-tint', `rgba(238,243,236,${cardAlpha})`);
    root.setProperty('--card-tint-strong', `rgba(238,243,236,${Math.min(1, cardAlpha + 0.08)})`);
    root.setProperty('--card-radius', `${cardRadius}px`);
    root.setProperty('--card-blur', `${cardBlur}px`);
    return () => {
      root.removeProperty('--btn-tint');
      root.removeProperty('--btn-radius');
      root.removeProperty('--btn-blur');
      root.removeProperty('--btn-content');
      root.removeProperty('--btn-tint-solid');
      root.removeProperty('--card-tint');
      root.removeProperty('--card-tint-strong');
      root.removeProperty('--card-radius');
      root.removeProperty('--card-blur');
    };
  }, [tintAlpha, radius, blur, content, solid, cardAlpha, cardRadius, cardBlur]);

  const cssBlock =
    `  /* Boutons */\n` +
    `  --btn-tint: rgba(255,255,255,${tintAlpha});\n` +
    `  --btn-tint-solid: ${solid};\n` +
    `  --btn-radius: ${radius}px;\n` +
    `  --btn-blur: ${blur}px;\n` +
    `  --btn-content: ${content};\n` +
    `  /* Cards */\n` +
    `  --card-tint: rgba(238,243,236,${cardAlpha});\n` +
    `  --card-tint-strong: rgba(238,243,236,${Number(Math.min(1, cardAlpha + 0.08).toFixed(2))});\n` +
    `  --card-radius: ${cardRadius}px;\n` +
    `  --card-blur: ${cardBlur}px;`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cssBlock);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const reset = () => {
    setTintAlpha(0.2);
    setRadius(999);
    setBlur(6);
    setContent('#FFFFFF');
    setSolid('#17402C');
    setCardAlpha(0.88);
    setCardRadius(28);
    setCardBlur(14);
  };

  return (
    <section className="glass rounded-3xl overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <p className="text-[10px] font-mono font-bold tracking-[0.18em] uppercase text-[color:var(--lkv-primary)]">0 · Variables — change ici, tout le site change</p>
        <p className="text-[12px] text-[color:var(--lkv-text-secondary)] mt-1">
          Curseurs <b>--btn-*</b> (boutons) et <b>--card-*</b> (cards) écrits sur <code>:root</code> : classes CSS <b>et</b> composants React de tout le site suivent en direct.
        </p>
      </div>
      <div className="px-5 pb-5 space-y-3 text-[12px]">
        <p className="font-bold text-[11px] uppercase tracking-wider text-[color:var(--lkv-text-secondary)] pt-1">Boutons</p>
        <label className="flex items-center gap-3">
          <span className="w-[170px] font-semibold">Teinte du verre (alpha)</span>
          <input type="range" min={0} max={1} step={0.05} value={tintAlpha} onChange={(e) => setTintAlpha(Number(e.target.value))} className="flex-1" />
          <span className="font-mono w-[52px] text-right">{tintAlpha.toFixed(2)}</span>
        </label>
        <label className="flex items-center gap-3">
          <span className="w-[170px] font-semibold">Rayon des pilules</span>
          <input type="range" min={0} max={999} step={1} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="flex-1" />
          <span className="font-mono w-[52px] text-right">{radius}px</span>
        </label>
        <label className="flex items-center gap-3">
          <span className="w-[170px] font-semibold">Flou du verre</span>
          <input type="range" min={0} max={20} step={1} value={blur} onChange={(e) => setBlur(Number(e.target.value))} className="flex-1" />
          <span className="font-mono w-[52px] text-right">{blur}px</span>
        </label>
        <label className="flex items-center gap-3">
          <span className="w-[170px] font-semibold">Couleur du contenu</span>
          <input type="color" value={content} onChange={(e) => setContent(e.target.value)} />
          <span className="font-mono">{content}</span>
        </label>
        <label className="flex items-center gap-3">
          <span className="w-[170px] font-semibold">Couleur pleine (primaire)</span>
          <input type="color" value={solid} onChange={(e) => setSolid(e.target.value)} />
          <span className="font-mono">{solid}</span>
        </label>

        <p className="font-bold text-[11px] uppercase tracking-wider text-[color:var(--lkv-text-secondary)] pt-2">Cards</p>
        <label className="flex items-center gap-3">
          <span className="w-[170px] font-semibold">Teinte des cards (alpha)</span>
          <input type="range" min={0} max={1} step={0.02} value={cardAlpha} onChange={(e) => setCardAlpha(Number(e.target.value))} className="flex-1" />
          <span className="font-mono w-[52px] text-right">{cardAlpha.toFixed(2)}</span>
        </label>
        <label className="flex items-center gap-3">
          <span className="w-[170px] font-semibold">Rayon des cards</span>
          <input type="range" min={0} max={48} step={1} value={cardRadius} onChange={(e) => setCardRadius(Number(e.target.value))} className="flex-1" />
          <span className="font-mono w-[52px] text-right">{cardRadius}px</span>
        </label>
        <label className="flex items-center gap-3">
          <span className="w-[170px] font-semibold">Flou des cards</span>
          <input type="range" min={0} max={30} step={1} value={cardBlur} onChange={(e) => setCardBlur(Number(e.target.value))} className="flex-1" />
          <span className="font-mono w-[52px] text-right">{cardBlur}px</span>
        </label>

        <div className="flex items-center gap-3 pt-1">
          <button type="button" className="glass-capsule-btn" onClick={copy}>{copied ? 'Copié ✓' : 'Copier le bloc CSS'}</button>
          <button type="button" className="glass-capsule-btn" onClick={reset}>Réinitialiser</button>
        </div>
        <pre className="text-[10.5px] font-mono text-[color:var(--lkv-text-secondary)] whitespace-pre-wrap bg-white/40 rounded-xl p-3">{cssBlock}</pre>
        <p className="text-[11px] text-[color:var(--lkv-text-secondary)]">Pour figer le style : colle ce bloc dans <b>src/styles/tokens.css</b> (sections BOUTONS / CARDS).</p>
      </div>
    </section>
  );
}

/** La pilule de référence — LE bouton unique du site. */
function RefPill({ label, width, solid = false, onClick, children }: {
  label: string;
  width?: number;
  solid?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <LiquidGlass
      as="button"
      type="button"
      aria-label={label}
      onClick={onClick}
      cornerRadius={999}
      displacementScale={70}
      blurAmount={6}
      saturation={160}
      aberrationIntensity={2}
      priority="media"
      elasticity={0.3}
      glassTint={solid ? 'var(--btn-tint-solid)' : 'var(--btn-tint)'}
      shadow="var(--btn-shadow)"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        width: width ? `${width}px` : undefined,
        minWidth: '44px',
        height: '44px',
        padding: width ? 0 : '0 16px',
        border: 'none',
        color: 'var(--btn-content)',
        fontWeight: 900,
        fontSize: '13px',
        textShadow: 'var(--btn-text-shadow)',
        cursor: 'pointer',
      }}
    >
      {children}
    </LiquidGlass>
  );
}

function Section({ title, hint, children, photo = false }: {
  title: string;
  hint: string;
  children: React.ReactNode;
  photo?: boolean;
}) {
  return (
    <section className="glass rounded-3xl overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <p className="text-[10px] font-mono font-bold tracking-[0.18em] uppercase text-[color:var(--lkv-text-secondary)]">{title}</p>
        <p className="text-[12px] text-[color:var(--lkv-text-secondary)] mt-1">{hint}</p>
      </div>
      <div
        className="px-5 pb-6 flex flex-wrap items-center gap-3"
        style={photo ? { backgroundImage: 'url(/assets/images/community-hikers.jpg)', backgroundSize: 'cover', backgroundPosition: 'center 60%', paddingTop: '28px' } : undefined}
      >
        {children}
      </div>
    </section>
  );
}

export default function StyleShowcase() {
  return (
    <main className="min-h-screen bg-[color:var(--lkv-surface)] px-4 py-8 text-[color:var(--lkv-primary)] selection:bg-[color:var(--lkv-primary)]/10 font-sans">
      <div className="max-w-[720px] mx-auto space-y-4">
        <header className="px-1">
          <p className="text-[10px] font-mono font-bold tracking-[0.18em] uppercase text-[color:var(--lkv-text-secondary)]">LKDV · planche de style</p>
          <h1 className="text-[30px] font-bold tracking-[-0.04em] mt-1">Un seul bouton. La référence photo, partout.</h1>
          <p className="text-[13px] text-[color:var(--lkv-text-secondary)] mt-1">
            La même pile LiquidGlass dans tous les contextes · tokens --btn-* (tokens.css) = source unique.
          </p>
        </header>

        {/* 0 — Bouton variable */}
        <VariablePanel />

        {/* 1 — Composants de l'app (pile LiquidGlass) */}
        <Section title="1 · Composants de l'app" hint="Button · IconButton · Chip — tous sur la même pile, contenu blanc, actif = forêt plein">
          <Button variant="primary">Action principale</Button>
          <Button variant="secondary">Action secondaire</Button>
          <Button variant="ghost">Discret</Button>
          <Button variant="destructive">Destructif</Button>
          <IconButton aria-label="Plus"><Icon name="plus" size={18} /></IconButton>
          <IconButton
            title="J'aime"
            aria-label="J'aime"
            variant="solid"
            aria-pressed
            style={{ width: 'auto', paddingInline: '10px' }}
          >
            <span className="inline-flex items-center gap-1.5"><Icon name="heart" size={14} /><span className="tabular-nums">{128}</span></span>
          </IconButton>
          <IconButton
            title="Commenter"
            aria-label="Commenter"
            style={{ width: 'auto', paddingInline: '10px' }}
          >
            <span className="inline-flex items-center gap-1.5"><Icon name="message-square" size={14} /><span className="tabular-nums">{24}</span></span>
          </IconButton>
          <Button variant="primary" disabled>Désactivé</Button>
        </Section>

        {/* 2 — Chips & filtres (même pile) */}
        <Section title="2 · Chips & filtres" hint="les pilules de filtre passent par le même composant — actif = forêt plein">
          <RefPill label="Tous les massifs" solid>Tous les massifs</RefPill>
          <RefPill label="Chartreuse">Chartreuse</RefPill>
          <RefPill label="Vercors">Vercors</RefPill>
          <Chip tone="sage">Sage</Chip>
          <Chip tone="info">Info</Chip>
          <Chip selected onClick={() => {}}>Actif</Chip>
        </Section>

        {/* 3 — Sur photo (même pile, mêmes pastilles) */}
        <Section photo title="3 · Sur photo" hint="exactement les mêmes composants que la référence (4) — ici sur une photo sunrise">
          <RefPill label="J'aime" width={84}>
            <Icon name="heart" size={15} color="#ffffff" /> 2
          </RefPill>
          <RefPill label="Commenter" width={84}>
            <Icon name="message-square" size={15} color="#ffffff" /> 7
          </RefPill>
          <Button variant="primary" icon={<Icon name="plus" size={15} />}>Participer</Button>
          <span className="glass-pill text-[10px] font-mono font-bold text-white border border-white/40" style={{ background: 'var(--btn-tint)' }}>
            Il y a 32 j
          </span>
        </Section>

        {/* 4 — Référence photo (LE même composant, sur la photo communauté) */}
        <Section title="4 · Référence photo" hint="le même composant RefPill que les sections 1-3 — rien de spécifique ici">
          <div className="relative w-full rounded-2xl overflow-hidden" style={{ height: '220px' }}>
            <img src="/assets/images/community-morning.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-x-3 bottom-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <RefPill label="J'aime" width={84}>
                  <Icon name="heart" size={15} color="#ffffff" /> 2
                </RefPill>
                <RefPill label="Commenter" width={84}>
                  <Icon name="message-square" size={15} color="#ffffff" /> 7
                </RefPill>
              </div>
              <div className="flex items-center gap-2.5">
                <RefPill label="Partager">
                  <Icon name="send" size={15} color="#ffffff" />
                </RefPill>
                <RefPill label="Options">
                  <Icon name="ellipsis" size={16} color="#ffffff" />
                </RefPill>
              </div>
            </div>
          </div>
        </Section>

        {/* 5 — Card au même style que le bouton, sur une image */}
        <Section title="5 · Card au même style, sur une image" hint="la card utilise EXACTEMENT la même recette que le bouton (tokens --btn-*) — rayon 28 au lieu de 999">
          <div className="relative w-full rounded-2xl overflow-hidden" style={{ height: '240px' }}>
            <img src="/assets/images/community-hikers.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
            <LiquidGlass
              as="div"
              cornerRadius={28}
              displacementScale={34}
              blurAmount={6}
              saturation={160}
              aberrationIntensity={2}
              priority="surface"
              elasticity={0}
              interactive={false}
              glassTint="var(--btn-tint)"
              shadow="var(--btn-shadow)"
              style={{ position: 'absolute', left: 16, right: 16, bottom: 16 }}
            >
              <div style={{ padding: '18px 20px', color: 'var(--btn-content)' }}>
                <p style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.85, marginBottom: '6px', textShadow: 'var(--btn-text-shadow)' }}>
                  Refuge des mélèzes
                </p>
                <h3 style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em', textShadow: 'var(--btn-text-shadow)' }}>
                  Une pause au bord du lac
                </h3>
                <p style={{ fontSize: '13px', opacity: 0.9, marginTop: '4px', textShadow: 'var(--btn-text-shadow)' }}>
                  12 km · 4 h · 420 m D+
                </p>
              </div>
            </LiquidGlass>
          </div>
        </Section>

        {/* 6 — Spécification */}
        <Section title="6 · Spécification" hint="la référence (4) appliquée à 100% des boutons ET des cards sur image — pilotée par des tokens CSS uniques">
          <table className="w-full text-[12px] leading-relaxed">
            <tbody className="[&_td]:py-1 [&_td]:align-top">
              <tr><td className="font-bold w-[150px]">Source unique</td><td><b>tokens.css → --btn-*</b> : modifier UNE valeur met à jour <b>100% des boutons du site</b> (CSS + React)</td></tr>
              <tr><td className="font-bold">--btn-tint</td><td><b>rgba(255,255,255,0.2)</b> — teinte du verre (référence photo)</td></tr>
              <tr><td className="font-bold">--btn-tint-solid</td><td><b>#17402C</b> — primaire / actif / publier</td></tr>
              <tr><td className="font-bold">--btn-content</td><td><b>#FFFFFF</b> — texte + icônes (ombre <b>--btn-text-shadow</b>)</td></tr>
              <tr><td className="font-bold">--btn-blur / -saturate</td><td><b>6px</b> / <b>160%</b></td></tr>
              <tr><td className="font-bold">--btn-shadow</td><td><b>0 4px 14px rgba(11,31,23,0.16) + 0 1px 3px 0.10</b> (ink uniquement)</td></tr>
              <tr><td className="font-bold">--btn-radius / -font</td><td><b>999px</b> · <b>12px / 600</b></td></tr>
              <tr><td className="font-bold">États</td><td>press <b>--btn-press-scale 0.97</b> · focus anneau 2px · disabled <b>--btn-disabled-opacity 0.45</b></td></tr>
            </tbody>
          </table>
        </Section>
      </div>
    </main>
  );
}
