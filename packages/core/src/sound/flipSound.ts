import { FLIP_CLIP } from './clip';

/** Default playback volume when the reader does not set one. */
const DEFAULT_VOLUME = 0.5;

type AudioContextCtor = typeof AudioContext;

function audioContextCtor(): AudioContextCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext;
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** Decode a `data:...;base64,...` URI to bytes, for feeding decodeAudioData. */
function dataUriToBytes(dataUri: string): ArrayBuffer | undefined {
  if (typeof atob !== 'function') return undefined;
  const comma = dataUri.indexOf(',');
  if (comma < 0) return undefined;
  const binary = atob(dataUri.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export interface FlipSoundOptions {
  /** A clip URL that overrides the bundled default (fetched at runtime). */
  url?: string;
  /** Playback volume, 0..1. Default 0.5. */
  volume?: number;
}

/**
 * Plays a short sound on each page turn.
 *
 * Everything here is best-effort: a browser that gates audio behind a gesture, has no Web Audio, or
 * cannot decode the clip simply stays silent. A page flip must never throw or stall because of
 * sound, so every path is guarded and failures are swallowed.
 *
 * Web Audio (not `<audio>`) so rapid flips overlap cleanly — each turn plays a fresh buffer source
 * through one shared gain node (volume + mute).
 */
export class FlipSound {
  #ctorCache: AudioContextCtor | undefined;
  #ctx: AudioContext | null = null;
  #gain: GainNode | null = null;
  #buffer: AudioBuffer | null = null;
  #decoding: Promise<void> | null = null;
  #volume: number;
  #muted = false;
  #url: string | undefined;

  constructor(options: FlipSoundOptions = {}) {
    this.#ctorCache = audioContextCtor();
    this.#volume = clamp01(options.volume ?? DEFAULT_VOLUME);
    this.#url = options.url;
  }

  /** Whether this environment can play at all — no context constructor means never. */
  get available(): boolean {
    return this.#ctorCache !== undefined && (Boolean(this.#url) || FLIP_CLIP.length > 0);
  }

  /**
   * Play the clip once. Best-effort: silent if audio is unavailable, muted, still gesture-locked,
   * or the clip has not decoded yet (the first flip may miss while it decodes; the rest play).
   */
  play(): void {
    if (this.#muted || !this.available) return;
    // Create/resume the context synchronously here, inside the flip's own gesture frame, so the
    // browser unlocks audio. Decoding is async and may lag the very first flip; later flips are hot.
    const ctx = this.#context();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    void this.#decode().then(() => {
      if (!this.#ctx || !this.#buffer || !this.#gain || this.#muted) return;
      try {
        const source = this.#ctx.createBufferSource();
        source.buffer = this.#buffer;
        source.connect(this.#gain);
        source.start();
      } catch {
        // Context closed mid-play, or otherwise unavailable: stay silent.
      }
    });
  }

  setMuted(muted: boolean): void {
    this.#muted = muted;
    if (this.#gain) this.#gain.gain.value = muted ? 0 : this.#volume;
  }

  isMuted(): boolean {
    return this.#muted;
  }

  destroy(): void {
    try {
      void this.#ctx?.close();
    } catch {
      // Already closed or closing.
    }
    this.#ctx = null;
    this.#gain = null;
    this.#buffer = null;
  }

  #context(): AudioContext | null {
    if (this.#ctx) return this.#ctx;
    if (!this.#ctorCache) return null;
    try {
      const ctx = new this.#ctorCache();
      const gain = ctx.createGain();
      gain.gain.value = this.#muted ? 0 : this.#volume;
      gain.connect(ctx.destination);
      this.#ctx = ctx;
      this.#gain = gain;
    } catch {
      this.#ctx = null;
    }
    return this.#ctx;
  }

  /** Decode the clip to an AudioBuffer once; later calls await the first attempt. */
  #decode(): Promise<void> {
    if (this.#decoding) return this.#decoding;
    this.#decoding = this.#loadBuffer().catch(() => {
      // Fetch/decode failed → stay silent; do not retry on every flip.
    });
    return this.#decoding;
  }

  async #loadBuffer(): Promise<void> {
    const ctx = this.#context();
    if (!ctx) return;
    let bytes: ArrayBuffer | undefined;
    if (this.#url) {
      const res = await fetch(this.#url);
      bytes = await res.arrayBuffer();
    } else if (FLIP_CLIP) {
      bytes = dataUriToBytes(FLIP_CLIP);
    }
    if (!bytes) return;
    // slice(0): some engines detach the source ArrayBuffer during decode.
    this.#buffer = await ctx.decodeAudioData(bytes.slice(0));
  }
}
