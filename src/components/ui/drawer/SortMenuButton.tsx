'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';

export interface SortOption {
  value: string;
  label: string;
}

export type SortMenuOption = SortOption;

export interface SortMenuButtonProps {
  /** Tri courant (valeur d'option). */
  value: string;
  /** Tri par défaut du volet : sert au point vert et à la coche initiale. */
  defaultValue: string;
  options: SortOption[];
  onChange: (value: string) => void;
  /** Libellé accessible du bouton (défaut : « Trier »). */
  label?: string;
  disabled?: boolean;
}

const SORT_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3" />
  </svg>
);

const CHECK_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

/**
 * Bouton rond de tri (30 px) et son menu `role=menu` / `role=menuitemradio`.
 *
 * Grammaire (maquette + /compte) :
 * - même verre que la mini-capsule 30 px (`--lg-bar-bg`, `--lg-bar-blur`,
 *   `--lg-bar-shadow`, encres `--lg-ink` / `--lg-on`) ;
 * - positionné par la coque à droite de la mini-capsule : la coque ajoute
 *   `has-sort` (ou `lkdv-has-sort`) à la mini-capsule, ce qui la décale de
 *   46 px (`right: 46px`) ;
 * - point vert (`--lg-on`) quand le tri courant diffère du tri par défaut ;
 * - options de 44 px au verre `--glass-bg-medium` / `--drawer-card-bg`,
 *   entrée .28 s spring, fermeture Échap (consommée, sans fermer le tiroir),
 *   clic extérieur, ↑ ↓ + Home/End, Tab ferme et rend le focus au bouton.
 *
 * Le menu est un enfant du tiroir : pas de portail, pas de z-index élevé.
 */
export function SortMenuButton({
  value,
  defaultValue,
  options,
  onChange,
  label = 'Trier',
  disabled = false,
}: SortMenuButtonProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();
  const isModified = value !== defaultValue;

  const focusItem = useCallback((index: number) => {
    if (options.length === 0) return;
    const safe = ((index % options.length) + options.length) % options.length;
    window.requestAnimationFrame(() => {
      itemRefs.current[safe]?.focus({ preventScroll: true });
    });
  }, [options.length]);

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => {
        buttonRef.current?.focus({ preventScroll: true });
      });
    }
  }, []);

  // À l'ouverture : focus sur l'option cochée (ou la première).
  useEffect(() => {
    if (!open) return;
    const checkedIndex = Math.max(
      0,
      options.findIndex((option) => option.value === value),
    );
    focusItem(checkedIndex);
  }, [focusItem, open, options, value]);

  // Clic extérieur : ferme sans voler le focus de la cible cliquée.
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [open]);

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = itemRefs.current.findIndex((item) => item === document.activeElement);
    switch (event.key) {
      case 'Escape':
        // Consomme Échap : le tiroir ne doit pas se fermer derrière le menu.
        event.preventDefault();
        event.stopPropagation();
        event.nativeEvent.stopImmediatePropagation?.();
        close(true);
        return;
      case 'Tab':
        // Tab ferme le menu et rend le focus au bouton (ordre de la coque).
        event.preventDefault();
        event.stopPropagation();
        close(true);
        return;
      case 'ArrowDown':
        event.preventDefault();
        event.stopPropagation();
        focusItem(currentIndex < 0 ? 0 : currentIndex + 1);
        return;
      case 'ArrowUp':
        event.preventDefault();
        event.stopPropagation();
        focusItem(currentIndex < 0 ? options.length - 1 : currentIndex - 1);
        return;
      case 'Home':
        event.preventDefault();
        event.stopPropagation();
        focusItem(0);
        return;
      case 'End':
        event.preventDefault();
        event.stopPropagation();
        focusItem(options.length - 1);
        return;
      default:
        return;
    }
  };

  const selectOption = (option: SortOption) => {
    if (option.value !== value) onChange(option.value);
    close(true);
  };

  return (
    <div className="lkdv-sort-anchor">
      <style dangerouslySetInnerHTML={{ __html: SORT_MENU_CSS }} />
      <button
        ref={buttonRef}
        type="button"
        className={
          isModified ? 'lkdv-sort-btn is-on' : 'lkdv-sort-btn'
        }
        data-modified={isModified ? 'true' : 'false'}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        title={label}
        data-testid="cv2-sort-button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          event.preventDefault();
          if (!disabled) setOpen(true);
        }}
      >
        {SORT_ICON}
      </button>

      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          className="lkdv-sort-menu"
          role="menu"
          aria-label={label}
          data-testid="cv2-sort-menu"
          tabIndex={-1}
          onKeyDown={handleMenuKeyDown}
        >
          <span className="lkdv-sort-menu-title" aria-hidden="true">
            Trier par
          </span>
          {options.map((option, index) => {
            const checked = option.value === value;
            return (
              <button
                key={option.value}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                type="button"
                className="lkdv-sort-item"
                role="menuitemradio"
                aria-checked={checked}
                tabIndex={-1}
                onClick={() => selectOption(option)}
              >
                <span className="lkdv-sort-item-label">{option.label}</span>
                {checked ? CHECK_ICON : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/**
 * CSS auto-injecté (même motif que `DRAWER_SHELL_CSS` dans DrawerShell) :
 * aucun hexadécimal, aucune courbe littérale, uniquement des jetons.
 * La coque ajoute `has-sort` (ou `lkdv-has-sort`) à la mini-capsule de
 * 30 px pour lui laisser la place du bouton (46 px).
 */
export const SORT_MENU_CSS = `
.lkdv-has-sort,.lkdv-lens-tabs.has-sort,.lkdv-lens-float.has-sort{right:46px!important;}
.lkdv-sort-anchor{position:relative;z-index:15;display:flex;align-items:center;justify-content:flex-end;flex:none;}
.lkdv-sort-btn{position:relative;width:30px;height:30px;padding:0;border:0;border-radius:50%;display:grid;place-items:center;box-sizing:border-box;background:var(--lg-bar-bg);-webkit-backdrop-filter:var(--lg-bar-blur);backdrop-filter:var(--lg-bar-blur);box-shadow:var(--lg-bar-shadow);color:var(--lg-ink);cursor:pointer;transition:transform .12s var(--ease-spring),color .2s ease;flex:none;}
.lkdv-sort-btn::after{content:"";position:absolute;inset:-7px;border-radius:50%;}
.lkdv-sort-btn svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;pointer-events:none;}
.lkdv-sort-btn:active{transform:scale(.92);}
.lkdv-sort-btn[aria-expanded="true"]{background:var(--lg-thumb-bg);box-shadow:var(--lg-thumb-shadow);color:var(--lg-on);}
.lkdv-sort-btn[data-modified="true"]::before{content:"";position:absolute;top:3px;right:3px;width:6px;height:6px;border-radius:50%;background:var(--lg-on);box-shadow:0 0 0 1.5px var(--lkv-surface-card);}
.lkdv-sort-btn:focus-visible{outline:0;box-shadow:inset 0 0 0 2px var(--lg-on),inset 0 0 0 4px var(--lkv-text-inverted);}
.lkdv-sort-btn[disabled]{opacity:var(--opacity-disabled);pointer-events:none;}
.lkdv-sort-menu{position:absolute;right:0;bottom:calc(100% + 10px);z-index:16;min-width:196px;padding:6px;border-radius:20px;display:flex;flex-direction:column;gap:2px;background:var(--cv2-menu-bg);-webkit-backdrop-filter:blur(var(--cv2-menu-blur)) saturate(1.8);backdrop-filter:blur(var(--cv2-menu-blur)) saturate(1.8);box-shadow:var(--cv2-menu-shadow),inset 0 0 0 .5px var(--cv2-menu-border);transform-origin:bottom right;animation:lkdv-sort-in .28s var(--ease-spring) both;box-sizing:border-box;}
.lkdv-sort-menu-title{padding:6px 10px 4px;font:600 10.5px/1.2 var(--font-sans);letter-spacing:.06em;text-transform:uppercase;color:var(--lkv-text-secondary);}
.lkdv-sort-item{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:44px;padding:0 12px;border:0;border-radius:14px;background:none;font:500 14px/1.2 var(--font-sans);color:var(--lkv-text-primary);text-align:left;cursor:pointer;width:100%;box-sizing:border-box;}
.lkdv-sort-item svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;color:var(--lkv-forest-900);}
.lkdv-sort-item[aria-checked="true"]{background:var(--lkv-secondary-subtle);color:var(--lkv-forest-900);font-weight:600;box-shadow:inset 0 0 0 1px var(--cv2-soft-line);}
.lkdv-sort-item:focus-visible{outline:2px solid var(--lkv-secondary);outline-offset:-2px;border-radius:14px;}
@media(hover:hover){.lkdv-sort-item:hover{background:var(--sage-50);}}
@keyframes lkdv-sort-in{from{opacity:0;transform:scale(.88) translateY(6px);}to{opacity:1;transform:none;}}
@media(prefers-reduced-motion:reduce){.lkdv-sort-menu{animation:none;}.lkdv-sort-btn{transition:none;}}
@media(prefers-reduced-transparency:reduce){.lkdv-sort-btn{background:var(--lkv-surface-card)!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;}.lkdv-sort-menu{background:var(--lkv-surface-card)!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;}}
`;

export default SortMenuButton;
