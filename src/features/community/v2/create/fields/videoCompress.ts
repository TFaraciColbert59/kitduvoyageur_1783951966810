'use client';

/**
 * Compression vidéo côté client (Story#15) — ré-encodage par lecture réelle
 * (`HTMLVideoElement.captureStream` → `MediaRecorder`), sans dépendance.
 *
 * Principes :
 * - **jamais bloquant** : sans `MediaRecorder`/`captureStream`, sans sortie MP4
 *   (lisible partout, iOS compris), sur refus de lecture automatique, sur erreur
 *   ou si le résultat n'est pas nettement plus léger, le fichier d'origine part
 *   tel quel ;
 * - seuls les fichiers > `VIDEO_COMPRESS_MIN_BYTES` sont ré-encodés (un court
 *   extrait déjà léger n'a rien à gagner) ;
 * - la durée de l'encodage est celle de la vidéo (lecture en temps réel) : la
 *   progression suit `currentTime / duration` et alimente la vignette.
 */

export const VIDEO_COMPRESS_MIN_BYTES = 6 * 1024 * 1024;
/** Débit visé (≈ 720p de qualité correcte pour une story de 60 s). */
export const VIDEO_TARGET_BITS_PER_SECOND = 2_500_000;
/** Un résultat n'est gardé que s'il gagne au moins 15 % de poids. */
export const VIDEO_MIN_SAVING = 0.85;

/** Sorties acceptées, dans l'ordre : seul le MP4 H.264 est lisible partout. */
export const VIDEO_OUTPUT_MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4;codecs=avc1',
  'video/mp4',
] as const;

export interface VideoCompressionEnvV2 {
  MediaRecorder?: {
    new (stream: MediaStream, options?: MediaRecorderOptions): MediaRecorder;
    isTypeSupported(type: string): boolean;
  };
  /** `HTMLVideoElement.prototype.captureStream` disponible ? */
  canCaptureStream: boolean;
}

export function currentVideoCompressionEnv(): VideoCompressionEnvV2 {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { canCaptureStream: false };
  }
  const proto = typeof HTMLVideoElement !== 'undefined' ? HTMLVideoElement.prototype : null;
  const capture =
    proto != null &&
    ('captureStream' in proto || 'mozCaptureStream' in proto);
  return {
    MediaRecorder: typeof MediaRecorder === 'undefined' ? undefined : MediaRecorder,
    canCaptureStream: Boolean(capture),
  };
}

/** Premier type MP4 que le navigateur sait enregistrer, sinon `null`. */
export function pickVideoOutputMime(env: VideoCompressionEnvV2): string | null {
  const Recorder = env.MediaRecorder;
  if (!Recorder || typeof Recorder.isTypeSupported !== 'function') return null;
  for (const candidate of VIDEO_OUTPUT_MIME_CANDIDATES) {
    try {
      if (Recorder.isTypeSupported(candidate)) return candidate;
    } catch {
      /* type refusé : on passe au suivant */
    }
  }
  return null;
}

export type VideoCompressionDecision =
  | { compress: true; mime: string }
  | { compress: false; reason: 'not-video' | 'small' | 'unsupported' };

/** Décision pure : faut-il, et peut-on, ré-encoder ce fichier ? */
export function decideVideoCompression(
  file: Pick<File, 'type' | 'size'>,
  env: VideoCompressionEnvV2,
): VideoCompressionDecision {
  if (!file.type.startsWith('video/')) return { compress: false, reason: 'not-video' };
  if (file.size <= VIDEO_COMPRESS_MIN_BYTES) return { compress: false, reason: 'small' };
  if (!env.canCaptureStream) return { compress: false, reason: 'unsupported' };
  const mime = pickVideoOutputMime(env);
  return mime ? { compress: true, mime } : { compress: false, reason: 'unsupported' };
}

/** Garde le ré-encodage seulement s'il allège nettement le fichier. */
export function keepCompressedVideo(originalBytes: number, compressedBytes: number): boolean {
  return compressedBytes > 0 && compressedBytes <= originalBytes * VIDEO_MIN_SAVING;
}

interface CapturableVideo extends HTMLVideoElement {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
  webkitAudioDecodedByteCount?: number;
  mozHasAudio?: boolean;
  audioTracks?: { length: number };
}

/** La source portait-elle du son ? (heuristique par moteur, après lecture). */
export function sourceHadAudio(video: CapturableVideo): boolean {
  return (
    (video.webkitAudioDecodedByteCount ?? 0) > 0 ||
    video.mozHasAudio === true ||
    (video.audioTracks?.length ?? 0) > 0
  );
}

/**
 * Le ré-encodage ne doit jamais faire perdre le son : si la source en avait et
 * que le flux enregistré n'a aucune piste audio, l'original part tel quel.
 */
export function audioPreserved(sourceHadSound: boolean, recordedAudioTracks: number): boolean {
  return !sourceHadSound || recordedAudioTracks > 0;
}

export interface CompressVideoOptions {
  onProgress?: (fraction: number) => void;
  env?: VideoCompressionEnvV2;
  /** Début/fin d'extrait en millisecondes (le rognage reste fait à la lecture). */
  signal?: AbortSignal;
}

/**
 * Ré-encode `file` en MP4 plus léger ; renvoie le fichier d'origine dans tous
 * les cas où le ré-encodage n'est pas possible ou pas rentable.
 */
export async function compressVideoV2(file: File, options: CompressVideoOptions = {}): Promise<File> {
  const env = options.env ?? currentVideoCompressionEnv();
  const decision = decideVideoCompression(file, env);
  if (!decision.compress || !env.MediaRecorder) return file;

  const url = URL.createObjectURL(file);
  const video = document.createElement('video') as CapturableVideo;
  video.preload = 'auto';
  video.playsInline = true;
  // Muet : rien ne sonne pendant l'envoi ; la piste audio reste capturée par
  // les moteurs qui produisent du MP4 (vérifié ci-dessous).
  video.muted = true;
  video.src = url;
  video.style.cssText = 'position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
  document.body.appendChild(video);

  const cleanup = () => {
    try {
      video.pause();
    } catch {
      /* déjà arrêtée */
    }
    video.removeAttribute('src');
    video.load();
    video.remove();
    URL.revokeObjectURL(url);
  };

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('metadata'));
    });
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (duration <= 0 || duration > 61) return file;
    const capture = video.captureStream ?? video.mozCaptureStream;
    if (!capture) return file;
    const stream = capture.call(video);
    const recorder = new env.MediaRecorder(stream, {
      mimeType: decision.mime,
      videoBitsPerSecond: VIDEO_TARGET_BITS_PER_SECOND,
    });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    };
    const finished = new Promise<void>((resolve, reject) => {
      recorder.onstop = () => resolve();
      recorder.onerror = () => reject(new Error('recorder'));
    });
    const onAbort = () => {
      if (recorder.state !== 'inactive') recorder.stop();
    };
    options.signal?.addEventListener('abort', onAbort, { once: true });

    const ended = new Promise<void>((resolve) => {
      video.onended = () => resolve();
    });
    recorder.start(1000);
    // La lecture exige un geste récent ; un refus (autoplay) laisse l'original.
    await video.play();
    const ticker = window.setInterval(() => {
      options.onProgress?.(Math.min(1, video.currentTime / duration));
    }, 250);
    await ended;
    window.clearInterval(ticker);
    if (recorder.state !== 'inactive') recorder.stop();
    await finished;
    options.signal?.removeEventListener('abort', onAbort);
    if (options.signal?.aborted) return file;
    options.onProgress?.(1);
    if (!audioPreserved(sourceHadAudio(video), stream.getAudioTracks().length)) return file;

    const blob = new Blob(chunks, { type: decision.mime.split(';')[0] });
    if (!keepCompressedVideo(file.size, blob.size)) return file;
    const base = file.name.replace(/\.[a-z0-9]+$/i, '') || 'story';
    return new File([blob], `${base}.mp4`, { type: 'video/mp4' });
  } catch {
    return file;
  } finally {
    cleanup();
  }
}
