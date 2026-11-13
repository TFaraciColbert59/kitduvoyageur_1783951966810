// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SpeechSynthesisAdapter } from '@/features/navigation';
import { AudioGuidanceControls } from '../AudioGuidanceControls';
import { LiveActivityPreview } from '../LiveActivityPreview';
import {
  AUDIO_PREFERENCES,
  IOS_CAPABILITY,
  makeLockPayload,
} from './fixtures';

afterEach(cleanup);

function makeSpeech(overrides: Partial<SpeechSynthesisAdapter> = {}): SpeechSynthesisAdapter {
  return {
    isSupported: () => true,
    speak: vi.fn(),
    cancel: vi.fn(),
    ...overrides,
  };
}

function AudioHarness({ speech }: { speech?: SpeechSynthesisAdapter | null }) {
  const [preferences, setPreferences] = React.useState(AUDIO_PREFERENCES);
  return (
    <AudioGuidanceControls
      preferences={preferences}
      sport="rando"
      speech={speech}
      onChange={setPreferences}
    />
  );
}

describe('AudioGuidanceControls (K4.02 / K4.08 / S1.07 / S3.11)', () => {
  it('active et coupe les instructions virage par virage', () => {
    render(<AudioHarness speech={makeSpeech()} />);

    const toggle = screen.getByRole('switch', { name: /Instructions virage par virage/ });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });

  it('change de sortie audio et d’intervalle d’effort', () => {
    render(<AudioHarness speech={makeSpeech()} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Muet' }));
    expect(screen.getByRole('radio', { name: 'Muet' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getAllByText('Muet').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('radio', { name: '10 min' }));
    expect(screen.getByRole('radio', { name: '10 min' }).getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  it('active les annonces d’effort et le split automatique', () => {
    render(<AudioHarness speech={makeSpeech()} />);

    const effort = screen.getByRole('switch', { name: /Activer les annonces d’effort/ });
    expect(effort.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(effort);
    expect(effort.getAttribute('aria-checked')).toBe('true');

    const split = screen.getByRole('switch', { name: /À chaque split/ });
    fireEvent.click(split);
    expect(split.getAttribute('aria-checked')).toBe('false');
  });

  it('envoie une phrase de test à l’adaptateur TTS injecté', () => {
    const speech = makeSpeech();
    render(<AudioHarness speech={speech} />);

    fireEvent.click(screen.getByRole('button', { name: /Tester la voix/ }));

    expect(speech.speak).toHaveBeenCalledWith(
      'Guidage vocal prêt. Suivez le parcours en toute sécurité.',
      expect.objectContaining({ lang: 'fr-FR', rate: 1, pitch: 1 }),
    );
    expect(screen.getByText('Test envoyé à la synthèse vocale.')).toBeTruthy();
  });

  it('désactive le test quand la synthèse vocale n’est pas disponible', () => {
    render(<AudioHarness speech={makeSpeech({ isSupported: () => false })} />);
    expect(
      screen.getByRole('button', { name: 'Synthèse vocale indisponible' }),
    ).toHaveProperty('disabled', true);
  });

  it('règle le débit et la langue de la voix', () => {
    render(<AudioHarness speech={makeSpeech()} />);

    fireEvent.change(screen.getByRole('slider', { name: 'Débit de la voix' }), {
      target: { value: '1.4' },
    });
    expect(screen.getByText('1.4×')).toBeTruthy();

    fireEvent.change(screen.getByRole('combobox', { name: 'Langue de la synthèse vocale' }), {
      target: { value: 'en-GB' },
    });
    expect(
      (screen.getByRole('combobox', { name: 'Langue de la synthèse vocale' }) as HTMLSelectElement)
        .value,
    ).toBe('en-GB');
  });
});

describe('LiveActivityPreview (K4.12 / S1.06)', () => {
  it('rend l’aperçu iPhone, la Dynamic Island et la prochaine instruction', () => {
    render(
      <LiveActivityPreview payload={makeLockPayload()} capability={IOS_CAPABILITY} />,
    );

    expect(screen.getByText('LKDV · Navigation')).toBeTruthy();
    expect(screen.getByRole('group', { name: /Aperçu iPhone/ })).toBeTruthy();
    expect(screen.getAllByText(/Tourner à gauche/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/8\.40 km/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('120 m').length).toBeGreaterThan(0);
  });

  it('remonte les actions pause, tour et muet', () => {
    const onAction = vi.fn();
    render(
      <LiveActivityPreview
        payload={makeLockPayload()}
        capability={IOS_CAPABILITY}
        onAction={onAction}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Pause/ }));
    expect(onAction).toHaveBeenCalledWith('pause');

    fireEvent.click(screen.getByRole('button', { name: /Tour/ }));
    expect(onAction).toHaveBeenCalledWith('lap');

    fireEvent.click(screen.getByRole('button', { name: /Muet/ }));
    expect(onAction).toHaveBeenCalledWith('mute');
  });

  it('propose de reprendre une séance en pause', () => {
    const onAction = vi.fn();
    render(
      <LiveActivityPreview
        payload={makeLockPayload({ paused: true })}
        capability={IOS_CAPABILITY}
        onAction={onAction}
      />,
    );

    expect(screen.getAllByText('En pause').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Reprendre/ }));
    expect(onAction).toHaveBeenCalledWith('resume');
  });

  it('bascule vers la notification continue Android', () => {
    const onAction = vi.fn();
    const payload = makeLockPayload();
    render(
      <LiveActivityPreview payload={payload} capability={IOS_CAPABILITY} onAction={onAction} />,
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Android' }));
    expect(screen.getByText(payload.androidNotification.title)).toBeTruthy();
    expect(screen.getByText(payload.androidNotification.subtitle)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Tour' }));
    expect(onAction).toHaveBeenCalledWith('lap');
  });

  it('affiche le bandeau hors trace et l’état de pause', () => {
    render(
      <LiveActivityPreview
        payload={makeLockPayload({ offRoute: true, offRouteM: 80 })}
        capability={IOS_CAPABILITY}
      />,
    );

    expect(screen.getAllByText('Hors trace').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Hors itinéraire · 80 m/).length).toBeGreaterThan(0);
  });

  it('explique l’indisponibilité native sans créer de notification', () => {
    render(
      <LiveActivityPreview
        payload={makeLockPayload()}
        capability={{
          platform: 'ios',
          supported: false,
          liveActivityAvailable: false,
          dynamicIslandAvailable: false,
          ongoingNotificationAvailable: false,
          reason: 'Surface native écran verrouillé non disponible.',
        }}
      />,
    );

    expect(screen.getByText('Surface native écran verrouillé non disponible.')).toBeTruthy();
    expect(screen.getByText(/Dynamic Island indisponible/)).toBeTruthy();
    expect(screen.getByText(/Aperçu visuel uniquement/)).toBeTruthy();
  });
});
