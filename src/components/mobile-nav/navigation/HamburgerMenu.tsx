'use client';

import { useEffect, type Dispatch, type SetStateAction } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { EASE_DECELERATE } from '@/lib/animations/constants';
import LkvIcon from '@/components/ui/LkvIcon';
import { HUB_ALERTES_HREF } from '@/features/hub/registry/hubSectionRegistry';
import { zIndex } from '@/lib/ui/zIndex';

function HamburgerMenu({
  menuOpen,
  setMenuOpen,
  messagerieBadge,
  cartCount,
}: {
  menuOpen: boolean;
  setMenuOpen: Dispatch<SetStateAction<boolean>>;
  messagerieBadge?: number;
  cartCount: number;
}) {
  const { triggerHaptic } = useHapticFeedback();

  // Fermeture clavier du menu (Échap) — cohérent avec les autres overlays.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen, setMenuOpen]);

  return (
    <div style={{ position: 'relative' }}>
      <motion.button
        type="button"
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          triggerHaptic('selection');
          setMenuOpen(!menuOpen);
        }}
        aria-label="Menu actions"
        aria-haspopup="true"
        aria-expanded={menuOpen}
        className="glass-circle-btn"
        style={{
          width: '44px',
          height: '44px',
          cursor: 'pointer',
        }}
      >
        <LkvIcon name="menu" size={18} color="var(--lkv-primary)" />
      </motion.button>
      <AnimatePresence>
        {menuOpen && (
          <>
            <div
              onClick={() => setMenuOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: zIndex.sheet,
              }}
              aria-hidden="true"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 8 }}
              transition={{ duration: 0.16, ease: EASE_DECELERATE }}
              style={{
                position: 'absolute',
                right: 0,
                bottom: 'calc(100% + 8px)',
                zIndex: zIndex.sheet,
                background: 'rgba(255, 255, 255, 0.45)',
                backdropFilter: 'blur(var(--glass-blur-md)) saturate(var(--glass-sat))',
                WebkitBackdropFilter: 'blur(var(--glass-blur-md)) saturate(var(--glass-sat))',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.5)',
                boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.7)',
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                minWidth: '135px',
              }}
            >
              {/* Messages */}
              <Link
                href="/messagerie"
                onClick={() => {
                  triggerHaptic('light');
                  setMenuOpen(false);
                }}
                aria-label="Messages"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  minHeight: '44px',
                  borderRadius: '10px',
                  background: 'rgba(23, 64, 44, 0.06)',
                  textDecoration: 'none',
                  color: 'var(--lkv-primary)',
                  fontSize: '13px',
                  fontWeight: 600,
                  position: 'relative',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--lkv-primary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
                Messages
                {!!messagerieBadge && (
                  <span style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: 'var(--lkv-secondary)',
                    color: 'var(--lkv-text-inverted)',
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: '999px',
                    fontFamily: 'monospace',
                  }}>
                    {messagerieBadge > 9 ? '9+' : messagerieBadge}
                  </span>
                )}
              </Link>

              {/* Notifications — hub alertes (D4, allègement H5, href registre R13) */}
              <Link
                href={HUB_ALERTES_HREF}
                onClick={() => {
                  triggerHaptic('light');
                  setMenuOpen(false);
                }}
                aria-label="Notifications"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  minHeight: '44px',
                  borderRadius: '10px',
                  background: 'rgba(23, 64, 44, 0.06)',
                  textDecoration: 'none',
                  color: 'var(--lkv-primary)',
                  fontSize: '13px',
                  fontWeight: 600,
                  position: 'relative',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--lkv-primary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                </svg>
                Alertes
                <span style={{ position: 'absolute', top: '10px', right: '10px', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--lkv-secondary)' }} aria-hidden="true" />
              </Link>
              {/* Cart */}
              <Link
                href="/panier"
                onClick={() => {
                  triggerHaptic('light');
                  setMenuOpen(false);
                }}
                aria-label="Panier"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  minHeight: '44px',
                  borderRadius: '10px',
                  background: 'rgba(23, 64, 44, 0.06)',
                  textDecoration: 'none',
                  color: 'var(--lkv-primary)',
                  fontSize: '13px',
                  fontWeight: 600,
                  position: 'relative',
                }}
              >
                <LkvIcon name="bag" size={16} color="var(--lkv-primary)" />
                Panier
                {cartCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: 'var(--lkv-secondary)',
                    color: 'var(--lkv-text-inverted)',
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: '999px',
                    fontFamily: 'monospace',
                  }}>
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </Link>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default HamburgerMenu;
