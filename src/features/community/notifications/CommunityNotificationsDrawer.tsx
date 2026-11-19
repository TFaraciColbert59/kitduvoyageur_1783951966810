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
      className="lkdv-communaute-v2 lkdv-cv2-layer"
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
          <style dangerouslySetInnerHTML={{ __html: `${DRAWER_SHELL_CSS}\n${COMPTE_CSS}` }} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default CommunityNotificationsDrawer;
