'use client';

let sharedAudioCtx: AudioContext | null = null;

function playSoftChime(freqHz = 660, durationMs = 110): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      void sharedAudioCtx.resume();
    }
    const osc = sharedAudioCtx.createOscillator();
    const gain = sharedAudioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freqHz, sharedAudioCtx.currentTime);
    gain.gain.setValueAtTime(0.08, sharedAudioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      sharedAudioCtx.currentTime + durationMs / 1000,
    );
    osc.connect(gain);
    gain.connect(sharedAudioCtx.destination);
    osc.start();
    osc.stop(sharedAudioCtx.currentTime + durationMs / 1000);
  } catch {
    // Ignore audio context restriction
  }
}

/**
 * Déverrouille et prononce un repère vocal court en français (compatible iOS WKWebView/Safari)
 * accompagné d'un léger signal sonore Web Audio.
 */
export function speakExplorerCue(text: string, opts?: { muted?: boolean; chimeHz?: number }): void {
  if (typeof window === 'undefined' || opts?.muted) return;
  playSoftChime(opts?.chimeHz ?? 660, 110);
  try {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'fr-FR';
    utter.rate = 1.02;
    utter.volume = 1.0;
    const voices = synth.getVoices?.() ?? [];
    const frVoice = voices.find((v) => v.lang?.toLowerCase().startsWith('fr'));
    if (frVoice) utter.voice = frVoice;
    synth.speak(utter);
  } catch {
    // Fallback chime already played
  }
}
