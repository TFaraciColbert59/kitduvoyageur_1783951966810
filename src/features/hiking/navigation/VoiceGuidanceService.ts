export interface IVoiceGuidanceService {
  speakInstruction(message: string): void;
  mute(): void;
  unmute(): void;
  isMuted(): boolean;
  isSupported(): boolean;
}

export class VoiceGuidanceService implements IVoiceGuidanceService {
  private muted: boolean = false;
  private lastSpokenMessage: string = '';
  private lastSpokenTimeMs: number = 0;
  private minIntervalMs: number = 10000; // Throttle voice messages to 10s minimum

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  public speakInstruction(message: string): void {
    if (this.muted || !this.isSupported()) return;

    const now = Date.now();
    // Avoid repeating exact same message within 10 seconds
    if (message === this.lastSpokenMessage && now - this.lastSpokenTimeMs < this.minIntervalMs) {
      return;
    }

    try {
      const synth = window.speechSynthesis;
      synth.cancel(); // Cancel any ongoing speech

      const utterance = new SpeechSynthesisUtterance(message);
      utterance.lang = 'fr-FR';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      synth.speak(utterance);
      this.lastSpokenMessage = message;
      this.lastSpokenTimeMs = now;
    } catch (err) {
      console.warn('[VoiceGuidanceService] Speech error:', err);
    }
  }

  public mute(): void {
    this.muted = true;
    if (this.isSupported()) {
      window.speechSynthesis.cancel();
    }
  }

  public unmute(): void {
    this.muted = false;
  }

  public isMuted(): boolean {
    return this.muted;
  }
}
