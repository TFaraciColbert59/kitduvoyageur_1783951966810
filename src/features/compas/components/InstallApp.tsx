'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n/context';
import { installMode } from '../offline/pwaInstall';

interface PromptEvent extends Event {
  prompt: () => Promise<void>;
}

/**
 * Application web installable (PLAN-100 phase 8, ⚖️ : pas de store payant). Une ligne, un
 * bouton : l'installation ne part que sur le geste de la personne. Rien si déjà installée ou
 * si le navigateur ne sait pas installer.
 */
export function InstallApp() {
  const { t } = useTranslation();
  const [event, setEvent] = useState<PromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [ua, setUa] = useState('');

  useEffect(() => {
    setUa(navigator.userAgent);
    const nav = navigator as Navigator & { standalone?: boolean };
    setStandalone(
      (typeof window.matchMedia === 'function' &&
        window.matchMedia('(display-mode: standalone)').matches) ||
        nav.standalone === true
    );
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as PromptEvent);
    };
    const onInstalled = () => setStandalone(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const mode = installMode({ userAgent: ua, standalone, hasPromptEvent: event !== null });
  if (mode === 'installed' || mode === 'none') return null;
  if (mode === 'ios-manual') return <p className="cp-popv__note">{t('compas.screen.installIos')}</p>;
  return (
    <p className="cp-popv__note">
      <button
        type="button"
        onClick={() => {
          void event?.prompt().finally(() => setEvent(null));
        }}
        style={{ minHeight: 44, background: 'none', border: 0, padding: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}
      >
        {t('compas.screen.installButton')}
      </button>
    </p>
  );
}
