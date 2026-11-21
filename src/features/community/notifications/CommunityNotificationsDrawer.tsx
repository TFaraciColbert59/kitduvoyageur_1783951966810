'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { User } from '@supabase/supabase-js';
import { Bell } from 'lucide-react';
import {
  DRAWER_SHELL_CSS,
  DrawerShell,
  type DrawerTab,
} from '@/components/ui/drawer/DrawerShell';
import { DrawerAuthRequired } from '@/components/compte/drawer/shell/DrawerAuthRequired';
import { COMPTE_CSS, NOTIFICATION_FILTERS } from '@/components/compte/drawer/compte/CompteDrawer';
import { NotificationsPane } from '@/components/compte/drawer/compte/NotificationsPane';

export interface CommunityNotificationsDrawerProps {
  open: boolean;
  onClose: () => void;
  user: (User & { is_anonymous?: boolean }) | null;
}

/**
 * Tiroir Notifications ouvert directement depuis la cloche de /communaute :
 * même contenu et mêmes filtres que le tiroir Notifications de /compte,
 * dans la coque compacte à 50 % max de la hauteur de l'écran.
 */
export function CommunityNotificationsDrawer({
  open,
  onClose,
  user,
}: CommunityNotificationsDrawerProps) {
  const [filter, setFilter] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const isAuthenticated = Boolean(user?.id && !user.is_anonymous);
  const tabs: DrawerTab[] = [
    {
      id: 'notifications',
      label: 'Notifications',
      icon: <Bell size={18} aria-hidden="true" />,
      render: () => <NotificationsPane filter={filter} />,
    },
  ];

  return createPortal(
    <div
      className="lkdv-communaute-v2 lkdv-cv2-layer lkdv-notif-standalone"
      style={{ pointerEvents: 'auto' }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="lkdv-cv2-wrap"
        data-search-compact="true"
        data-state="open"
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
      >
        <div className="lkdv-cv2-sheet">
          <div className="lkdv-cv2-handle-bar">
            <button
              type="button"
              className="lkdv-cv2-handle"
              aria-label="Fermer les notifications"
              onClick={onClose}
            />
          </div>
          {isAuthenticated ? (
            <div className="lkdv-compte-root">
              <DrawerShell
                tabs={tabs}
                activeIndex={0}
                onIndexChange={() => {}}
                secondary={{
                  items: NOTIFICATION_FILTERS,
                  active: filter,
                  onChange: setFilter,
                  label: 'Filtres des notifications',
                }}
              />
            </div>
          ) : (
            <div className="lkdv-drawer-shell">
              <DrawerAuthRequired title="Connecte-toi pour accéder à tes notifications" />
            </div>
          )}
          <style
            dangerouslySetInnerHTML={{
              __html: `
.lkdv-notif-standalone.lkdv-cv2-layer {
  position: fixed;
  inset: 0;
  z-index: 600;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(11, 31, 23, 0.34);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}
.lkdv-notif-standalone .lkdv-cv2-wrap {
  width: min(100%, 520px);
  max-height: min(62dvh, 560px);
  display: flex;
  flex-direction: column;
  padding: 0 6px 6px;
}
.lkdv-notif-standalone .lkdv-cv2-sheet {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: min(60dvh, 540px);
  border-radius: 26px;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(242, 247, 238, 0.96) 45%, rgba(255, 255, 255, 0.98));
  box-shadow: 0 -18px 50px rgba(10, 20, 14, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.95);
  border: 0.5px solid rgba(23, 43, 36, 0.14);
}
.lkdv-notif-standalone .lkdv-cv2-handle-bar {
  display: flex;
  justify-content: center;
  padding: 10px 0 4px;
  flex: none;
}
.lkdv-notif-standalone .lkdv-cv2-handle {
  width: 36px;
  height: 4px;
  border-radius: 999px;
  border: 0;
  background: rgba(23, 43, 36, 0.22);
  cursor: pointer;
}
.lkdv-notif-standalone .lkdv-compte-root {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}
${DRAWER_SHELL_CSS}
${COMPTE_CSS}`,
            }}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default CommunityNotificationsDrawer;
