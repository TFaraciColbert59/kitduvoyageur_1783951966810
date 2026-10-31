'use client';

import {
  hasNativeChoices,
  hasNativeDatePicker,
  presentNativeChoices,
  presentNativeDate,
  type NativeChoicesRequest,
} from '@/lib/native/ui';

export interface ChoiceOption {
  id: string;
  title: string;
  subtitle?: string;
  disabled?: boolean;
}

export interface ChoiceRequest {
  title: string;
  options: ChoiceOption[];
  selectedId?: string;
  timeoutMs?: number; // default 5000 ms
}

export interface DateRequest {
  title: string;
  value?: string; // YYYY-MM-DD
  timeoutMs?: number; // default 5000 ms
}

/**
 * Fallback modal Web pour la sélection de choix.
 * Conforme Apple HIG & tokens LKDV.
 */
export function defaultWebChoiceModal(request: ChoiceRequest): Promise<string | null> {
  if (typeof document === 'undefined') {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'lkdv-choice-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', request.title);

    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '99999',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      backgroundColor: 'rgba(11, 31, 23, 0.45)',
      backdropFilter: 'blur(8px)',
      padding: '16px',
      boxSizing: 'border-box',
    });

    const card = document.createElement('div');
    card.className = 'lkdv-choice-modal-card';
    Object.assign(card.style, {
      width: '100%',
      maxWidth: '420px',
      maxHeight: '80vh',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      backgroundColor: 'var(--hub-surface-card, #FFFFFF)',
      borderRadius: '24px',
      padding: '16px',
      boxShadow: '0 10px 30px rgba(11, 31, 23, 0.24)',
      boxSizing: 'border-box',
      overflow: 'hidden',
    });

    const title = document.createElement('h3');
    title.textContent = request.title;
    Object.assign(title.style, {
      margin: '0 0 8px 0',
      fontSize: '17px',
      fontWeight: '600',
      color: 'var(--hub-primary, #17402C)',
      textAlign: 'center',
    });
    card.appendChild(title);

    const listContainer = document.createElement('div');
    Object.assign(listContainer.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      overflowY: 'auto',
      maxHeight: '50vh',
    });

    const cleanup = (result: string | null) => {
      window.removeEventListener('keydown', onKeyDown);
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      resolve(result);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cleanup(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);

    for (const opt of request.options) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-choice-id', opt.id);
      btn.disabled = Boolean(opt.disabled);

      const isSelected = opt.id === request.selectedId;

      Object.assign(btn.style, {
        minHeight: '44px',
        padding: '10px 14px',
        borderRadius: '14px',
        border: '1px solid var(--hub-border, rgba(23, 43, 36, 0.12))',
        backgroundColor: isSelected
          ? 'var(--hub-primary-subtle, #D3EBD9)'
          : 'var(--hub-surface, #F5F7F3)',
        color: 'var(--hub-text-primary, #172B24)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        textAlign: 'left',
        cursor: opt.disabled ? 'not-allowed' : 'pointer',
        opacity: opt.disabled ? '0.5' : '1',
      });

      const optTitle = document.createElement('span');
      optTitle.textContent = opt.title;
      optTitle.style.fontWeight = isSelected ? '600' : '500';
      btn.appendChild(optTitle);

      if (opt.subtitle) {
        const sub = document.createElement('span');
        sub.textContent = opt.subtitle;
        Object.assign(sub.style, {
          fontSize: '12px',
          color: 'var(--hub-text-muted, #46584D)',
        });
        btn.appendChild(sub);
      }

      btn.onclick = () => {
        if (!opt.disabled) cleanup(opt.id);
      };

      listContainer.appendChild(btn);
    }
    card.appendChild(listContainer);

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Annuler';
    cancelBtn.setAttribute('data-choice-cancel', 'true');
    Object.assign(cancelBtn.style, {
      minHeight: '44px',
      marginTop: '8px',
      padding: '10px 14px',
      borderRadius: '14px',
      border: 'none',
      backgroundColor: 'transparent',
      color: 'var(--hub-text-secondary, #56665D)',
      fontWeight: '600',
      cursor: 'pointer',
      textAlign: 'center',
    });
    cancelBtn.onclick = () => cleanup(null);
    card.appendChild(cancelBtn);

    overlay.onclick = (e) => {
      if (e.target === overlay) cleanup(null);
    };

    overlay.appendChild(card);
    document.body.appendChild(overlay);
  });
}

/**
 * Fallback modal Web pour la sélection de date.
 */
export function defaultWebDateModal(request: DateRequest): Promise<string | null> {
  if (typeof document === 'undefined') {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'lkdv-date-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', request.title);

    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '99999',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(11, 31, 23, 0.45)',
      backdropFilter: 'blur(8px)',
      padding: '16px',
      boxSizing: 'border-box',
    });

    const card = document.createElement('div');
    Object.assign(card.style, {
      width: '100%',
      maxWidth: '340px',
      backgroundColor: 'var(--hub-surface-card, #FFFFFF)',
      borderRadius: '24px',
      padding: '20px',
      boxShadow: '0 10px 30px rgba(11, 31, 23, 0.24)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    });

    const title = document.createElement('h3');
    title.textContent = request.title;
    Object.assign(title.style, {
      margin: '0',
      fontSize: '17px',
      fontWeight: '600',
      color: 'var(--hub-primary, #17402C)',
      textAlign: 'center',
    });
    card.appendChild(title);

    const input = document.createElement('input');
    input.type = 'date';
    input.value = request.value || new Date().toISOString().split('T')[0];
    Object.assign(input.style, {
      minHeight: '44px',
      padding: '8px 12px',
      borderRadius: '12px',
      border: '1px solid var(--hub-border, rgba(23, 43, 36, 0.22))',
      fontSize: '15px',
      color: 'var(--hub-text-primary, #172B24)',
      textAlign: 'center',
    });
    card.appendChild(input);

    const actions = document.createElement('div');
    Object.assign(actions.style, {
      display: 'flex',
      gap: '8px',
      marginTop: '4px',
    });

    const cleanup = (result: string | null) => {
      window.removeEventListener('keydown', onKeyDown);
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      resolve(result);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cleanup(null);
    };
    window.addEventListener('keydown', onKeyDown);

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Annuler';
    Object.assign(cancelBtn.style, {
      flex: '1',
      minHeight: '44px',
      borderRadius: '12px',
      border: 'none',
      backgroundColor: 'var(--hub-surface, #F5F7F3)',
      color: 'var(--hub-text-secondary, #56665D)',
      fontWeight: '600',
      cursor: 'pointer',
    });
    cancelBtn.onclick = () => cleanup(null);

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.textContent = 'Confirmer';
    Object.assign(confirmBtn.style, {
      flex: '1',
      minHeight: '44px',
      borderRadius: '12px',
      border: 'none',
      backgroundColor: 'var(--hub-primary, #17402C)',
      color: '#FFFFFF',
      fontWeight: '600',
      cursor: 'pointer',
    });
    confirmBtn.onclick = () => cleanup(input.value || null);

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    card.appendChild(actions);

    overlay.onclick = (e) => {
      if (e.target === overlay) cleanup(null);
    };

    overlay.appendChild(card);
    document.body.appendChild(overlay);
  });
}

/**
 * Présente des choix avec pont natif robuste et retombée web automatique.
 * Ne renvoie JAMAIS undefined à l'appelant.
 */
export async function presentResilientChoices(
  request: ChoiceRequest,
  customFallback?: (req: ChoiceRequest) => Promise<string | null>
): Promise<string | null> {
  const timeoutMs = request.timeoutMs ?? 5000;
  const fallback = customFallback ?? defaultWebChoiceModal;

  try {
    const hasNative = await hasNativeChoices();
    if (hasNative) {
      const nativeReq: NativeChoicesRequest = {
        title: request.title,
        options: request.options.map((o) => ({
          id: o.id,
          title: o.title,
          subtitle: o.subtitle,
          disabled: o.disabled,
        })),
        selectedId: request.selectedId,
      };

      const timeoutPromise = new Promise<undefined>((resolve) =>
        setTimeout(() => resolve(undefined), timeoutMs)
      );

      const nativeResult = await Promise.race([
        presentNativeChoices(nativeReq),
        timeoutPromise,
      ]);

      if (nativeResult !== undefined) {
        return nativeResult; // string (choix) ou null (fermeture volontaire de la feuille)
      }
    }
  } catch {
    // En cas d'exception du bridge, bascule directe vers le fallback web
  }

  return fallback(request);
}

/**
 * Présente un sélecteur de date avec pont natif et retombée web.
 * Ne renvoie JAMAIS undefined à l'appelant.
 */
export async function presentResilientDate(
  request: DateRequest,
  customFallback?: (req: DateRequest) => Promise<string | null>
): Promise<string | null> {
  const timeoutMs = request.timeoutMs ?? 5000;
  const fallback = customFallback ?? defaultWebDateModal;

  try {
    const hasNative = await hasNativeDatePicker();
    if (hasNative) {
      const timeoutPromise = new Promise<undefined>((resolve) =>
        setTimeout(() => resolve(undefined), timeoutMs)
      );

      const nativeResult = await Promise.race([
        presentNativeDate(request.title, request.value ?? ''),
        timeoutPromise,
      ]);

      if (nativeResult !== undefined) {
        return nativeResult;
      }
    }
  } catch {
    // Erreur de bridge ignorée, bascule web
  }

  return fallback(request);
}
