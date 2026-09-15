import {
  buildSpreads,
  shouldSinglePage,
  type Direction,
  type Spread,
  type SpreadMode,
} from './engine/spread';
import { Virtualizer } from './engine/virtualizer';
import { Emitter, type ZineEventMap } from './engine/emitter';
import { FlipMachine } from './engine/stateMachine';
import { PointerRecognizer, PinchRecognizer, bindGestures, type GestureEnd } from './engine/input';
import {
  bindDeepLink,
  claimHash,
  hashWithPage,
  pageFromHash,
  releaseHash,
  type DeepLinkHandle,
} from './engine/deeplink';
import {
  CURL_TYPES,
  DEFAULT_CURL,
  IMPORTABLE_CURLS,
  type CurlSpec,
  type CurlType,
} from './geometry/curls/types';
import { selectRenderer, type RendererOption } from './renderer/select';
import type { FlipDirection, PageContent, Renderer, SpreadContent } from './renderer/types';
import type { DownloadInfo, LoadProgress, OutlineItem, Source } from './source/types';
import { composeSource } from './source/compose';
import type { ContextMenuOptions, ControlsOptions } from './controls/types';
import type { LoaderHandle } from './loading/loading';
import type { FlipSound } from './sound/flipSound';

/** Grab-zone size as a fraction of the smaller container dimension. */
const CORNER_FRACTION = 0.25;

/** Wheel-zoom sensitivity: scale multiplies by exp(-deltaY * this) per wheel event. */
const WHEEL_ZOOM_SENSITIVITY = 0.0015;

/** Pointer movement (px) beyond which a press becomes a drag rather than a tap. */
const DRAG_THRESHOLD = 6;

/** Window (ms) a single click waits to rule out a double-click before flipping. Also the window
 *  within which the library pairs two clicks into its own double-click (see #bindDoubleClickZoom). */
const DOUBLE_CLICK_MS = 250;

/** How far (px) the second click of a pair may land from the first and still count as the same
 *  spot. Forgiving enough for a wobble, tight enough that two different zones don't pair. */
const DOUBLE_CLICK_MOVE = 24;

/** Grace period after a flip lands during which a paired double-click in a *dead* edge zone (the
 *  first/last spread, where the turn can't happen) is read as the tail of a rapid flipping streak
 *  and swallowed rather than zooming. Two streak clicks pair within DOUBLE_CLICK_MS of each other,
 *  so two of them span this window; a deliberate zoom comes after the reader pauses on the end
 *  page, well outside it. */
const FLIP_STREAK_MS = 2 * DOUBLE_CLICK_MS;

/** A lone page fills the container, so it sweeps the full width where a spread leaf only covers
 *  its half. `flipDuration` is the spread timing; lone pages stretch it slightly so twice the
 *  travel still reads at a comparable speed instead of whipping across. */
const LONE_PAGE_FLIP_SCALE = 1.2;

/** Characters of surrounding text shown on either side of a search match. */
const EXCERPT_PAD = 32;

/** Quiet period before re-rasterizing at a new zoom, so a pinch does not rasterize every frame. */
const ZOOM_TILE_DELAY = 60;

/** Ceiling on the zoomed page raster. Memory grows with the square of this, so a letter page at
 *  4x would run past 100 MB; 2.5x keeps a deep zoom far sharper than fit-to-screen for a
 *  fraction of that. */
const MAX_PAGE_UPGRADE = 2.5;

/** Raster texels we want per CSS px for crisp text (roughly retina density). A raster matched 1:1
 *  to CSS px looks soft: glyph antialiasing is baked at exactly the on-screen size and then
 *  bilinear-sampled under a fractional transform, with nothing to downsample. Rendering ~2x and
 *  letting the GPU minify supersamples the edges. A retina display already paints its raster at
 *  ~2x CSS px, so this floor is scaled by 1/dpr and only lifts low-dpr screens. */
const TEXT_SUPERSAMPLE = 1.5;

/** Flip time under `prefers-reduced-motion`. Short enough not to read as animation, long enough
 *  to show which way the page went — an instant swap leaves the reader guessing. */
const REDUCED_MOTION_DURATION = 120;

/** Eased fold pose (0..1) at which the page number is announced, while the fold keeps animating to
 *  its full duration. The eases decelerate into the finish, so by this pose the turn already reads
 *  as landed; announcing here updates the number on time without shortening the visible flip. This
 *  is a pure timing lead for the number: it does not touch the animation clock or the end pose. */
const PAGE_LEAD = 0.85;

/** Lone-page turns dissolve rather than land on a facing half; announce a touch earlier than
 *  a spread so the number updates as the under-page takes over, not after the fade tail. */
const PAGE_LEAD_LONE = 0.82;

/** How far the corner peek hint lifts the leading page (fold progress 0..1) before settling back —
 *  enough to read as a liftable page, well short of committing a turn. */
const PEEK_PROGRESS = 0.12;

/** Duration of each leg (out, then back) of the corner peek, in ms. */
const PEEK_LEG_MS = 360;

/** How far the whole spread slides toward the edge on a dead boundary tap, in px, before it springs
 *  back — enough to read as "nothing past here", well short of looking like a turn. */
const EDGE_NUDGE_PX = 28;

/** Duration of the boundary rubber-band nudge (out and back together), in ms. */
const EDGE_NUDGE_MS = 260;

/** How long the reader may sit on the opening spread without turning a page before the peek replays
 *  once as a nudge. Long enough not to interrupt someone who is simply reading the first page. */
const IDLE_NUDGE_MS = 7000;

/** How long the first-zoom "drag to move" caption stays up before fading on its own. */
const CAPTION_MS = 2200;

/** localStorage key for learned gestures under `hints.persist`. Shared across books on a site so a
 *  gesture learned on one is not re-taught on the next. */
const HINTS_STORAGE_KEY = 'zine:hints-learned';

/** localStorage key for the reader's mute choice under `sound.persist`. Shared across books on a
 *  site so a reader who silenced (or enabled) flip sound once is remembered everywhere. */
const SOUND_MUTED_STORAGE_KEY = 'zine:sound-muted';

/** Which gestures the reader has demonstrated, so the matching discoverability hint stays quiet. */
interface Learned {
  turn: boolean;
  zoom: boolean;
  pan: boolean;
}

/** One page that matched a {@link Zine.search} query. */
export interface SearchHit {
  /** Zero-based page index; pass straight to `flipTo`. */
  page: number;
  /** The match with a little text either side, ellipsised where it was cut. */
  excerpt: string;
}

/** Pull a readable snippet around a match, collapsing the whitespace PDFs are full of. */
function excerptAround(text: string, at: number, length: number): string {
  const start = Math.max(0, at - EXCERPT_PAD);
  const end = Math.min(text.length, at + length + EXCERPT_PAD);
  const slice = text.slice(start, end).replace(/\s+/g, ' ').trim();
  return `${start > 0 ? '…' : ''}${slice}${end < text.length ? '…' : ''}`;
}

interface DragState {
  direction: FlipDirection;
  targetIndex: number;
  toPage: number;
  toContent: SpreadContent;
  width: number;
  t: number;
}

export interface ZoomOptions {
  /** Whether zooming is allowed at all; default true. */
  enabled?: boolean;
  /** Maximum zoom scale; default 4. */
  max?: number;
  /** Zoom on Ctrl/⌘ + wheel (also how trackpad pinch arrives on desktop); default true. */
  wheel?: boolean;
  /** Zoom levels cycled by double-click (wraps to the first); `false` disables. Default [1, 2, 4]. */
  doubleClick?: number[] | false;
  /**
   * Listen for double-click zoom inside the click-to-flip zones. Default: off in 'edge' mode
   * (edges flip instantly, no delay), on in 'half' mode. Turning it on in 'edge' mode makes
   * clicks wait out `clickFlipDelay` so a double-click can preempt them with a zoom.
   */
  doubleClickInFlipZone?: boolean;
}

export interface ZineOptions {
  /** Content source (e.g. an ImageSource). Required. */
  source: Source;
  /** Renderer selection; default 'auto'. */
  renderer?: RendererOption;
  /**
   * Page-curl model for the WebGL2 renderer. Default `'cone'`.
   *
   * `'cone'` and `'simple'` are bundled and can be named directly. The others are imported and
   * passed as models, so a book that never uses them never carries their math:
   *
   * ```ts
   * import { silk } from '@zinejs/core/curls';
   * new Zine(el, { source, curl: silk });
   * ```
   *
   * Any object of the same shape works, so a custom curl needs no registration.
   */
  curl?: CurlSpec;
  /** Fixed container width in px; omit to let the container/CSS drive the size. */
  width?: number;
  /** Fixed container height in px; omit to let the container/CSS drive the size. */
  height?: number;
  /** Reading direction; default 'ltr'. */
  direction?: Direction;
  /** How pages group into spreads: 'double' | 'single' | 'cover' | 'book'. Default 'cover'. */
  spreadMode?: SpreadMode;
  /** Image URL prepended as a lone front cover (adds a page). */
  frontCover?: string;
  /** Image URL appended as a lone back cover (adds a page). */
  backCover?: string;
  /** Replace source pages with image URLs, keyed by 0-based source index (negative = from the end). */
  pages?: Record<number, string>;
  /** Page to open on; default 0. */
  startPage?: number;
  /** Flip animation duration in ms; default 500. */
  flipDuration?: number;
  /** How a tap/click turns pages: near an edge ('edge'), by page half ('half'), or 'off'. Default 'edge'. */
  clickToFlip?: 'edge' | 'half' | 'off';
  /** Edge-zone size in px per side, used when clickToFlip is 'edge'. Default 64. */
  clickZoneSize?: number;
  /**
   * On a mouse, change the cursor over the book to hint what a press would do: `pointer` where a
   * click turns the page, `zoom-in` where a double-click zooms (including the edge peel band, so a
   * sweep stays calm), `grab` over the whole page once zoomed (a drag pans), and `grabbing` while a
   * peel or pan is actually in flight. Default true. Set false when a changing cursor would be noise
   * in the embedding design. No effect on touch.
   */
  cursorHints?: boolean;
  /**
   * Subtle, one-shot discoverability hints shown on the book itself (so they reach touch readers,
   * unlike {@link cursorHints}): the leading page corner peeks and settles on first open, nudges
   * once more if the reader sits idle without turning a page, a small "drag to move" caption appears
   * the first time they zoom in, and (on a mouse) a "double-click or Ctrl/⌘-scroll to zoom" caption
   * appears if a lone click lands in a dead zone where only a double-click would do anything. Each
   * hint stops for good the moment the reader performs the gesture it teaches. Honors
   * `prefers-reduced-motion` (the motion cues are skipped). Default true. Pass an object to keep what
   * the reader has learned across visits: `{ persist: true }` records it in localStorage so a
   * returning reader is not re-taught (default is in-memory, per page load).
   */
  hints?: boolean | { enabled?: boolean; persist?: boolean };
  /**
   * Play a short sound on each page turn. Off by default — web audio is unexpected, so it is
   * strictly opt-in. `true` uses the bundled clip at the default volume; an object overrides it:
   * `url` points at your own clip (fetched at runtime), `volume` is 0..1, and `muted: true` offers
   * the sound but starts it silent so the reader turns it on themselves (via the `mute` control),
   * and `persist: true` remembers the reader's mute choice across visits in localStorage (otherwise
   * it resets each load). Playback is best-effort and never throws: a browser that gates audio behind
   * a gesture, lacks Web Audio, or cannot decode the clip just stays silent. Whenever sound is
   * enabled — audible or muted — a `mute` control appears in the toolbar and right-click menu.
   */
  sound?: boolean | { url?: string; volume?: number; muted?: boolean; persist?: boolean };
  /**
   * Delay (ms) a click waits before flipping, so a double-click can preempt it with a zoom.
   * Omit for auto: 0 when double-click zoom is inactive, 250 when it's active.
   */
  clickFlipDelay?: number;
  /** Zoom behavior. */
  zoom?: ZoomOptions;
  /** Container widths below this (px) switch to one page per spread; default 640. */
  singlePageThreshold?: number;
  /**
   * Whether a narrow container may override `spreadMode` and show one page at a time. Default
   * true.
   *
   * Set false to hold the configured mode at every width — a two-page spread stays two pages on
   * a phone, however small. (`singlePageThreshold: 0` has the same effect; this says it out
   * loud, and can be changed at runtime with {@link Zine.setResponsiveSpread}.)
   */
  responsiveSpread?: boolean;
  /**
   * The built-in toolbar. Shown by default; pass `false` to render none, or an object to choose
   * its position and which controls appear.
   */
  controls?: boolean | ControlsOptions;
  /**
   * The built-in loading indicator, shown while a source that reports download progress (a PDF
   * from a URL) fetches and prepares its first spread. On by default; pass `false` to render none
   * and drive your own from the `progress` event and the `ready` promise. Retheme the default with
   * the `--zine-loading-bg`, `--zine-loading-fg`, `--zine-loading-accent`, and `--zine-loading-track`
   * CSS variables.
   */
  loading?: boolean;
  /**
   * Keep the current page in the URL hash (`#page=12`), so a link opens where the reader was and
   * back/forward move through the book. Default true.
   *
   * Only a `page` key is read or written — anything else in the hash is left alone — and updates
   * use `replaceState`, so turning pages does not fill the back button. Pass `false` if your app
   * owns the hash.
   */
  deepLink?: boolean;
  /**
   * Suppress the browser's right-click menu over the book. Default false.
   *
   * A mild deterrent for published documents, not protection: the pages are still in the DOM and
   * reachable by anyone who wants them. It also takes away Inspect and "Open image in new tab"
   * for everyone, so it is off unless asked for.
   *
   * Mutually exclusive with {@link contextMenu}: one replaces the native menu, the other only
   * removes it, so enabling both is a contradiction and throws.
   */
  disableContextMenu?: boolean;
  /**
   * A right-click menu of reading controls (zoom, page turns, fullscreen, print, download, share),
   * opened at the cursor over the book. On by default. Over a canvas the native menu offers only
   * the generic page actions (Back, Reload, View source), so replacing it with the book's own
   * controls is the better trade; pass `false` to keep the browser's menu.
   *
   * Reuses the toolbar's icons and actions, so the same controls appear whether reached from the
   * toolbar or a right-click, and it works even with `controls: false` — a bare book can still
   * offer one. `true` uses the default set; an object with `items` replaces the layout. Mouse
   * affordance only; touch never raises it.
   *
   * Turned off automatically when {@link disableContextMenu} is set (that option removes the native
   * menu with nothing in its place); setting both explicitly throws.
   */
  contextMenu?: boolean | ContextMenuOptions;
  /**
   * Control ids to hide from both surfaces at once: off the toolbar (bar and overflow menu) and out
   * of the right-click menu. `['print', 'download']` removes those two everywhere, wherever they are
   * nested, without having to edit `controls.items` and `contextMenu.items` separately.
   *
   * A blunt cross-cutting filter: it only removes, and it applies to whatever layout each surface
   * ends up with (default or custom). To rearrange or add controls, set the per-surface `items`
   * instead.
   */
  hideControls?: readonly string[];
}

/**
 * The public flipbook. Composes the engine (spreads, virtualizer, events), a
 * lazily-selected renderer, and a content source. Construction is synchronous
 * but setup is async — await `ready` (or listen for the `ready` event) before
 * driving it.
 */
export class Zine {
  #container: HTMLElement;
  #source: Source;
  #emitter = new Emitter<ZineEventMap>();
  #virtualizer = new Virtualizer(2);
  #machine = new FlipMachine();
  #direction: Direction;
  #spreadMode: SpreadMode;
  /** The mode the book was built with, so toggling away from one page can return to it — a
   *  `cover` book comes back as `cover`, keeping its lone first page, not as plain `double`. */
  #configuredMode: SpreadMode;
  #curl: CurlSpec;
  #anchorY = 1; // where the last tap/drag grabbed (0=top, 1=bottom); drives anchored curls
  #clickToFlip: 'edge' | 'half' | 'off';
  #clickZoneSize: number;
  #cursorHints: boolean;
  /** Last mouse position over the container in client px, so the cursor can be re-derived after a
   *  page turn, zoom, or resize changes what a press there would do — without the pointer moving. */
  #pointerClient: { x: number; y: number } | null = null;
  #unbindCursor: (() => void) | null = null;
  #hintsEnabled: boolean;
  #hintsPersist: boolean;
  /** Page-flip sound. Off unless `sound` is set; the controller and its clip load lazily (dynamic
   *  import) only then, so a silent book pays no audio bytes. Muting is remembered even before the
   *  controller finishes loading, via #soundMuted. */
  #soundEnabled: boolean;
  #soundOptions: { url?: string; volume?: number };
  #sound: FlipSound | null = null;
  #soundMuted = false;
  /** Remember the reader's mute choice across visits (localStorage) under `sound.persist`. */
  #soundPersist = false;
  /** Guards the one-time lazy import of the sound chunk. Deferred until sound is actually audible,
   *  so a book that starts muted pays nothing until the reader unmutes. */
  #soundLoadStarted = false;
  /** What the reader has demonstrated they already know, so a hint teaching it stays quiet. Set by
   *  the gesture itself (a turn, a zoom, a pan); persisted to localStorage when `hints.persist`. */
  #learned: Learned = { turn: false, zoom: false, pan: false };
  /** The one-shot idle nudge timer (armed on ready, cleared by any real gesture). */
  #idleTimer: ReturnType<typeof setTimeout> | null = null;
  /** Tags the peek's own rAF loop so a real flip (or teardown) can cancel a peek mid-play without
   *  the stale frame repainting a half-folded page. Distinct from #activeAnim, which is flip-only. */
  #peekAnim: object | null = null;
  /** Tags the boundary rubber-band's rAF loop, so a real flip/drag/zoom (or teardown) cancels a nudge
   *  in flight without a stale frame leaving the spread shifted off-center. Shares #raf, like #peekAnim. */
  #nudgeAnim: object | null = null;
  /** The lazily-built hint caption element (null until a caption shows it). */
  #captionEl: HTMLElement | null = null;
  #captionTimer: ReturnType<typeof setTimeout> | null = null;
  /** Delays the "double-click to zoom" caption past the pairing window, so a real double-click zooms
   *  (which teaches zoom) instead of flashing the hint first. Cleared if the click pairs or zoom is learned. */
  #zoomHintTimer: ReturnType<typeof setTimeout> | null = null;
  /** The zoom caption teaches at most once a session; a reader who ignores it is not nagged on every
   *  dead click. (The peek and pan captions are one-shot for the same reason.) */
  #zoomHintShown = false;
  /** pointerType of the last press, so the zoom caption stays mouse-only: touch has no "double-click"
   *  and double-tap/pinch are already well known (this mirrors why cursorHints is mouse-only). */
  #lastPointerType = '';
  #honorDoubleClickInFlipZone: boolean;
  #clickFlipDelayValue: number;
  #singlePageThreshold: number;
  #singlePage = false;
  /** Last layout announced via `spreadChanged`, so a rebuild that changes nothing stays quiet. */
  #effectiveModeShown: SpreadMode | null = null;
  #narrow = false; // responsive: container currently below singlePageThreshold
  #responsiveSpread: boolean;
  #lastAspect: number | null = null; // last container aspect-ratio written (avoids redundant style writes)
  #startPageOption: number | undefined;
  #deepLinkEnabled: boolean;
  #disableContextMenu: boolean;
  #deepLink: DeepLinkHandle | null = null;
  #unsubscribeDeepLink: (() => void) | null = null;
  #spreads: Spread[] = [];
  #current = 0;
  #currentPage = 0;
  #currentContent: SpreadContent = { left: null, right: null };
  #flipDuration: number;
  #zoomEnabled: boolean;
  #wheelZoom: boolean;
  #doubleClickLevels: number[] | null;
  #maxZoom: number;
  #resizeObserver: ResizeObserver | null = null;
  #updateScheduled = false;
  #scale = 1;
  #tx = 0;
  #ty = 0;
  #renderer: Renderer | null = null;
  #fellBack = false;
  #destroyed = false;
  #raf: number | null = null;
  #drag: DragState | null = null;
  #pendingGrab: { direction: FlipDirection; targetIndex: number; toPage: number; width: number } | null = null;
  #press: { x: number; y: number } | null = null;
  #pendingClickTimer: ReturnType<typeof setTimeout> | null = null;
  // Latest flip intent requested while one was already animating; replayed on settle so
  // clicks/keys during a turn aren't dropped and continuous flipping keeps advancing.
  #queuedFlip: (() => void) | null = null;
  // The fold animation currently on screen, so a new flip request can land it instantly
  // (snap to its end pose + commit) and start immediately instead of waiting it out.
  #activeAnim: { toT: number; direction: FlipDirection; onDone: () => void } | null = null;
  // Bumped per flip so an async #runFlip that resumes after being superseded can bail.
  #flipGeneration = 0;
  #pan: { baseTx: number; baseTy: number } | null = null;
  #pinching = false;
  #pinchBaseScale = 1;
  #reducedMotion = false;
  #liveRegion: HTMLElement | null = null;
  #unbindInput: (() => void) | null = null;
  #unbindWheel: (() => void) | null = null;
  #unbindContextMenu: (() => void) | null = null;
  #unbindDblClick: (() => void) | null = null;
  /** First click of a possible library-detected double-click, and when/where it landed. Kept
   *  because the browser's own `dblclick` misfires on rapid streaks (the counter resets). */
  #lastClick: { t: number; x: number; y: number } | null = null;
  /** When the last flip committed (performance.now()). A dead-edge double-click landing soon after
   *  is the tail of a flipping streak, not a zoom request; see #zoomAt and FLIP_STREAK_MS. */
  #lastFlipAt = Number.NEGATIVE_INFINITY;
  #a11yCleanup: (() => void) | null = null;
  /** Resolved once and reused; see {@link getOutline}. */
  #outline: Promise<OutlineItem[]> | null = null;
  /** Pages whose content improved while a flip was running, to repaint once it settles. */
  #pendingUpgrades = new Set<number>();
  #controlsOption: boolean | ControlsOptions;
  #controlsCleanup: (() => void) | null = null;
  #contextMenuOption: boolean | ContextMenuOptions;
  #contextMenuCleanup: (() => void) | null = null;
  /** Control ids hidden from every surface by {@link ZineOptions.hideControls}. Empty when unset. */
  #hiddenControls: ReadonlySet<string>;
  #loadingOption: boolean;
  #loader: LoaderHandle | null = null;
  #lastProgress: LoadProgress | null = null;
  /** 'download' while bytes arrive, 'preparing' while the first spread rasterizes, 'done' after
   *  it paints. Guards a late-arriving loader chunk from mounting once the book is already up. */
  #loaderPhase: 'download' | 'preparing' | 'done' = 'download';
  /** Resolution multiplier the current spread is rasterized at; 1 while not zoomed. */
  #zoomedAt = 1;
  /** Guards against an out-of-date tile landing after the view has already moved on. */
  #tileGeneration = 0;
  #tileTimer: ReturnType<typeof setTimeout> | null = null;
  #ready: Promise<void>;

  /** Stable seek API: drive the fold to a fixed progress without animating (visual regression). */
  readonly debug = {
    setFlipProgress: (t: number, direction: FlipDirection): void => {
      this.#renderer?.setFlipProgress(t, direction);
    },
  };

  constructor(container: HTMLElement, options: ZineOptions) {
    validateOptions(container, options);
    this.#container = container;
    if (options.width !== undefined) container.style.width = `${options.width}px`;
    if (options.height !== undefined) container.style.height = `${options.height}px`;
    this.#source = composeSource(options.source, {
      frontCover: options.frontCover,
      backCover: options.backCover,
      pages: options.pages,
    });
    const direction = options.direction ?? 'ltr';
    this.#direction = direction;
    // Set before the spread model is built: that is where a page in the URL is honoured.
    // Claimed before the spread model is built, which is where the hash is read: a second book
    // on the same page must not open on the first one's page.
    this.#deepLinkEnabled = (options.deepLink ?? true) && claimHash();
    this.#disableContextMenu = options.disableContextMenu ?? false;
    this.#spreadMode = options.spreadMode ?? 'cover';
    this.#configuredMode = this.#spreadMode;
    this.#curl = options.curl ?? DEFAULT_CURL;
    this.#clickToFlip = options.clickToFlip ?? 'edge';
    this.#clickZoneSize = options.clickZoneSize ?? 64;
    this.#cursorHints = options.cursorHints ?? true;
    const hints = options.hints ?? true;
    this.#hintsEnabled = hints === true || (hints !== false && (hints.enabled ?? true));
    this.#hintsPersist = hints !== true && hints !== false && (hints.persist ?? false);
    if (this.#hintsPersist) this.#loadLearned();
    const sound = options.sound ?? false;
    this.#soundEnabled = sound !== false;
    this.#soundOptions = sound === true || sound === false ? {} : sound;
    // `{ muted: true }` offers the sound but starts it silent: the controller loads, the mute
    // control shows, and the reader unmutes to turn it on.
    this.#soundMuted = typeof sound === 'object' && sound !== null ? (sound.muted ?? false) : false;
    this.#soundPersist = typeof sound === 'object' && sound !== null ? (sound.persist ?? false) : false;
    // A remembered choice from a previous visit overrides the configured default.
    if (this.#soundEnabled && this.#soundPersist) this.#loadSoundMuted();
    this.#singlePageThreshold = options.singlePageThreshold ?? 640;
    this.#responsiveSpread = options.responsiveSpread ?? true;
    this.#controlsOption = options.controls ?? true;
    // On by default, but a book that asked to suppress the native menu with nothing in its place
    // (disableContextMenu) means it: don't hand it our menu unasked. Setting both explicitly is a
    // contradiction and throws in validateOptions.
    this.#contextMenuOption = options.contextMenu ?? (options.disableContextMenu ? false : true);
    this.#hiddenControls = new Set(options.hideControls ?? []);
    this.#loadingOption = options.loading ?? true;
    this.#startPageOption = options.startPage;
    // Sync sources (a known page count) build spreads now — so bad pageCount/startPage
    // throw immediately from `new Zine`. Async sources (an `open()`) defer to #init.
    if (typeof this.#source.open !== 'function') {
      this.#buildSpreadModel();
    }
    this.#flipDuration = options.flipDuration ?? 800;
    this.#zoomEnabled = options.zoom?.enabled ?? true;
    this.#wheelZoom = options.zoom?.wheel ?? true;
    const dbl = options.zoom?.doubleClick;
    const levels = dbl === false ? [] : [...(dbl ?? [1, 2, 4])].sort((a, b) => a - b);
    this.#doubleClickLevels = levels.length > 0 ? levels : null;
    this.#maxZoom = options.zoom?.max ?? 4;

    // Arbitrate click-to-flip vs double-click zoom inside the flip zones.
    // Listen for double-click zoom in flip zones: default off in 'edge', on in 'half'.
    // clickFlipDelay === 0 hard-disables it. When honored, a delay lets a click wait
    // out a possible double-click; auto default 250 ms, overridable.
    const doubleClickZoomActive = this.#zoomEnabled && this.#doubleClickLevels !== null;
    const listenInFlipZone = options.zoom?.doubleClickInFlipZone ?? (this.#clickToFlip === 'half');
    this.#honorDoubleClickInFlipZone =
      this.#clickToFlip !== 'off' &&
      doubleClickZoomActive &&
      listenInFlipZone &&
      options.clickFlipDelay !== 0;
    this.#clickFlipDelayValue = this.#honorDoubleClickInFlipZone
      ? (options.clickFlipDelay ?? DOUBLE_CLICK_MS)
      : 0;

    this.#ready = this.#init(options.renderer ?? 'auto');
  }

  /** Resolves once the renderer is mounted and the first spread is painted. */
  get ready(): Promise<void> {
    return this.#ready;
  }

  getPageCount(): number {
    return this.#source.pageCount;
  }

  getPage(): number {
    return this.#currentPage;
  }

  /** The element this flipbook was mounted into. */
  get container(): HTMLElement {
    return this.#container;
  }

  /**
   * Where the book is actually painted inside the container, in container pixels: the
   * aspect-fitted, centred region, which is shorter (or narrower) than the container whenever the
   * two aspect-ratios do not match. A side rail uses it to stand exactly as tall as the page rather
   * than the whole container. Null before the first paint, when there is nothing to measure yet.
   */
  getPageBox(): { x: number; y: number; width: number; height: number } | null {
    return this.#renderer?.measure().book ?? null;
  }

  /**
   * How pages are currently grouped, one entry per spread — the same model the renderer paints,
   * so it already reflects `spreadMode` and the responsive single-page fallback. Useful for
   * building a page list or thumbnail rail that matches the book.
   */
  getSpreads(): readonly Spread[] {
    return this.#spreads;
  }

  /** The spread index currently on screen; indexes into {@link getSpreads}. */
  getSpreadIndex(): number {
    return this.#current;
  }

  /** Reading direction, which mirrors each spread's left/right sides. */
  getDirection(): Direction {
    return this.#direction;
  }

  /** How pages are grouped: the configured mode, not what a narrow container may be forcing. */
  getSpreadMode(): SpreadMode {
    return this.#spreadMode;
  }

  /** Whether the book is showing one page at a time, for whatever reason. */
  isSinglePage(): boolean {
    return this.#singlePage;
  }

  /**
   * Regroup the pages, keeping the reader on the page they are looking at.
   *
   * A narrow container may still override this with one page at a time; see
   * {@link setResponsiveSpread}.
   */
  setSpreadMode(mode: SpreadMode): void {
    if (mode === this.#spreadMode) return;
    this.#spreadMode = mode;
    // The narrow measurement was taken under the layout we are leaving, and a book showing one
    // page is narrower than the same book showing two. Holding on to it would let a container
    // that only shrank *because* of one-page mode veto the way back out. Drop it and let the
    // next measurement decide afresh.
    this.#narrow = false;
    this.#rebuildSpreads();
    void this.#renderCurrent();
  }

  /**
   * Switch between one page and two, and back again.
   *
   * Returning to two pages restores the mode the book was built with, so a `cover` book gets its
   * lone first page back rather than becoming a plain `double`.
   */
  toggleSpreadMode(): void {
    this.setSpreadMode(
      this.#spreadMode === 'single'
        ? this.#configuredMode === 'single'
          ? 'double' // built as single: there is no other mode to return to
          : this.#configuredMode
        : 'single',
    );
  }

  /** Whether a narrow container is allowed to override `spreadMode` with one page at a time. */
  getResponsiveSpread(): boolean {
    return this.#responsiveSpread;
  }

  /**
   * Whether the book is showing one page at a time *because the container is narrow*, rather
   * than because it was asked to. False when `responsiveSpread` is off.
   *
   * A book already set to `single` is not being overridden, however narrow it is: asking for one
   * page makes the book itself narrower, so reporting that as an override would strand the reader
   * in a layout they could no longer switch out of.
   */
  isResponsiveSingle(): boolean {
    return this.#narrow && this.#spreadMode !== 'single';
  }

  /**
   * Allow or forbid the narrow-container override, and re-lay out at once.
   *
   * Turning it off holds the configured `spreadMode` at every width; turning it back on
   * re-measures, so a book on a narrow screen collapses to single again straight away.
   */
  setResponsiveSpread(enabled: boolean): void {
    if (enabled === this.#responsiveSpread) return;
    this.#responsiveSpread = enabled;
    if (!enabled) {
      if (!this.#narrow) return; // nothing was being overridden
      this.#narrow = false;
      this.#rebuildSpreads();
    } else {
      const width = this.#renderer?.measure().containerWidth;
      if (width === undefined) return;
      this.#narrow = false; // let #applySinglePage see a real change and rebuild
      this.#applySinglePage(width);
    }
    void this.#renderCurrent();
  }

  /**
   * Resolve one page's raster, for drawing a thumbnail or exporting. Returns null if the page
   * cannot be decoded — the failure is reported through `sourceError` rather than thrown, as it
   * is for the pages the renderer paints.
   */
  getPageImage(index: number): Promise<PageContent | null> {
    return this.#getPage(index);
  }

  /** Whether there is a spread after the current one (false on the last). */
  canFlipNext(): boolean {
    return this.#current + 1 < this.#spreads.length;
  }

  /** Whether there is a spread before the current one (false on the first). */
  canFlipPrev(): boolean {
    return this.#current > 0;
  }

  /** The ceiling `setZoom` clamps to. */
  getMaxZoom(): number {
    return this.#maxZoom;
  }

  /** Whether this book's source can produce text — false for image books. */
  canSearch(): boolean {
    return typeof this.#source.getText === 'function';
  }

  /** Whether the original document can be downloaded — true for a PDF from a URL or bytes. */
  canDownload(): boolean {
    return typeof this.#source.getDownload === 'function';
  }

  /**
   * Whether the book is a document rather than a set of loose images — true for a PDF, false for
   * an `ImageSource`. Document-shaped features (the page rail, the outline) key off this.
   *
   * Inferred from the source implementing document-only capabilities, so a custom source opts in
   * simply by implementing them.
   */
  isDocument(): boolean {
    return typeof this.#source.getOutline === 'function' || typeof this.#source.getText === 'function';
  }

  /**
   * Whether this book can be printed: the source must have an original document, and the browser
   * must render PDFs inline. {@link print} loads the file into an offscreen iframe and drives it
   * with `window.print()`, which needs a built-in PDF viewer; Android Chrome has none, so the
   * frame never lays out and the print silently does nothing. `pdfViewerEnabled` reports exactly
   * that capability, so hide the control when it is explicitly false. It is only hidden on that
   * explicit false — a browser too old to report the property (undefined) keeps the button.
   */
  canPrint(): boolean {
    if (typeof this.#source.getDownload !== 'function') return false;
    const nav = this.#container.ownerDocument?.defaultView?.navigator;
    return nav?.pdfViewerEnabled !== false;
  }

  /**
   * Print the document.
   *
   * The original file is handed to the browser in an offscreen frame rather than printing the
   * host page: printing the page would capture the toolbar and whatever single spread happens to
   * be on screen, while the browser paginates a PDF properly on its own. Resolves false when
   * there is no original to print — an image book, or a caller-owned pdf.js document.
   */
  async print(): Promise<boolean> {
    const info = await this.getSourceFile();
    const doc = this.#container.ownerDocument;
    if (!info || !doc) return false;

    // A cross-origin PDF loads into the frame but the frame is then cross-origin, so calling
    // print() on its window throws and the dialog never opens. Pull it into a same-origin blob so
    // the frame is scriptable — the same fetch the download path uses.
    const { url, revoke } = await this.#sameOriginFile(info, doc);

    const frame = doc.createElement('iframe');
    // Offscreen rather than display:none: a hidden frame does not always lay out its document,
    // and an unlaid-out frame has nothing to print.
    frame.style.cssText =
      'position:fixed;right:0;bottom:0;width:1px;height:1px;opacity:0;border:0;';
    frame.setAttribute('aria-hidden', 'true');
    frame.src = url;

    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (ok: boolean): void => {
        if (settled) return;
        settled = true;
        // Outlive the print dialog, which is modal and synchronous in some browsers; removing
        // the frame while it is open cancels the job.
        setTimeout(() => {
          frame.remove();
          if (revoke) URL.revokeObjectURL(url);
        }, 60_000);
        resolve(ok);
      };
      frame.addEventListener('load', () => {
        try {
          const win = frame.contentWindow;
          if (!win) return finish(false);
          win.focus();
          win.print();
          finish(true);
        } catch {
          finish(false); // a cross-origin PDF cannot be driven from here
        }
      });
      frame.addEventListener('error', () => finish(false));
      doc.body.appendChild(frame);
    });
  }

  /** Whether the source can supply a table of contents. True for PDFs; the document may still
   *  turn out to have no outline, in which case {@link getOutline} resolves empty. */
  canOutline(): boolean {
    return typeof this.#source.getOutline === 'function';
  }

  /**
   * The document's table of contents, or an empty list when it has none.
   *
   * Memoized: an outline does not change for the life of the document, and resolving one means
   * following every entry's destination to a page. The toolbar asks for it up front to decide
   * whether to offer the outline panel at all, and the panel itself then gets it for free.
   */
  getOutline(): Promise<OutlineItem[]> {
    if (!this.#outline) {
      const getOutline = this.#source.getOutline;
      this.#outline =
        typeof getOutline === 'function'
          ? Promise.resolve(getOutline.call(this.#source)).catch(() => [])
          : Promise.resolve([]);
    }
    return this.#outline;
  }

  /**
   * Save the original document. Resolves to false when the source has nothing to hand over
   * (an image book, or a PDF opened from a caller-owned pdf.js document).
   */
  /**
   * Where the original document lives, if the source has one — a PDF's URL or a blob of its
   * bytes. Null for an image book, or a PDF opened from a caller-owned pdf.js document.
   *
   * Saving and printing both start here: the original is better than anything reassembled from
   * page rasters, and the browser already knows how to paginate it.
   */
  async getSourceFile(): Promise<DownloadInfo | null> {
    const getDownload = this.#source.getDownload;
    if (typeof getDownload !== 'function') return null;
    return (await getDownload.call(this.#source)) ?? null;
  }

  async download(): Promise<boolean> {
    const info = await this.getSourceFile();
    if (!info) return false;
    const doc = this.#container.ownerDocument;
    if (!doc) return false;
    // The `download` attribute is honoured only for same-origin (and blob/data) URLs; for a
    // cross-origin one the browser ignores it and just navigates to the file, opening the PDF in
    // a tab instead of saving it. Pulling the file into a same-origin blob forces the save with
    // its filename.
    const { url, revoke } = await this.#sameOriginFile(info, doc);
    const link = doc.createElement('a');
    link.href = url;
    link.download = info.filename;
    link.rel = 'noopener';
    doc.body.appendChild(link);
    link.click();
    link.remove();
    // An object URL is ours to clean up; give the click a tick to start first.
    if (revoke) setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  }

  /**
   * A same-origin URL for the source file, so an `<a download>` saves it and a print frame can be
   * scripted. A file that is already same-origin, or a blob we made ourselves (`revoke`), is
   * returned unchanged; a cross-origin one is fetched into a blob. The server must allow CORS,
   * which it already does — the viewer fetched the same PDF to render it. On a fetch failure the
   * raw URL is returned (opens in a tab, no worse than before).
   */
  async #sameOriginFile(info: DownloadInfo, doc: Document): Promise<{ url: string; revoke: boolean }> {
    if (info.revoke || !this.#isCrossOrigin(info.url, doc)) {
      return { url: info.url, revoke: info.revoke ?? false };
    }
    try {
      const blob = await (await fetch(info.url)).blob();
      return { url: URL.createObjectURL(blob), revoke: true };
    } catch {
      return { url: info.url, revoke: false };
    }
  }

  /** Whether `url` resolves to a different origin than the page, so an `<a download>` would be
   *  ignored for it. A relative or same-origin URL, or one that fails to parse, counts as same. */
  #isCrossOrigin(url: string, doc: Document): boolean {
    const here = doc.defaultView?.location?.href;
    if (!here) return false;
    try {
      return new URL(url, here).origin !== new URL(here).origin;
    } catch {
      return false;
    }
  }

  /**
   * Find `query` in the book's text, case-insensitively.
   *
   * Pages are read on demand and cached by the source, so the first search over a long document
   * costs one text extraction per page and later ones are cheap. Returns at most one hit per
   * page, in page order. Always empty when {@link canSearch} is false.
   */
  async search(query: string, options: { limit?: number } = {}): Promise<SearchHit[]> {
    const getText = this.#source.getText;
    const needle = query.trim().toLowerCase();
    if (typeof getText !== 'function' || needle === '') return [];
    const limit = options.limit ?? 50;
    const hits: SearchHit[] = [];
    for (let page = 0; page < this.#source.pageCount && hits.length < limit; page++) {
      let text: string;
      try {
        text = await getText.call(this.#source, page);
      } catch (error) {
        this.#emitter.emit('sourceError', { index: page, error });
        continue;
      }
      const at = text.toLowerCase().indexOf(needle);
      if (at < 0) continue;
      hits.push({ page, excerpt: excerptAround(text, at, needle.length) });
    }
    return hits;
  }

  flipNext(): void {
    this.#stepFlip(1);
  }

  flipPrev(): void {
    this.#stepFlip(-1);
  }

  /** Turn one spread in `step`'s direction, counted from wherever the book lands. Interrupting
   *  commits the running turn first, so this steps on from there — repeat taps keep advancing,
   *  and a reversal goes to the neighbour of the spread that just landed. */
  #stepFlip(step: 1 | -1): void {
    this.#requestFlip(() => this.#startFlip(this.#current + step));
  }

  flipTo(page: number): void {
    const target = clamp(page, 0, Math.max(0, this.#source.pageCount - 1));
    this.#requestFlip(() => this.#startFlip(this.#spreadIndexForPage(target)));
  }

  /** Run a flip now. If a fold is animating, land it instantly first so the new turn starts
   *  immediately on this click (thunks read `#current` lazily, so it steps on from where the
   *  interrupted turn landed). A drag in flight can't be interrupted this way, so its request
   *  is queued and replayed on settle instead. */
  #requestFlip(run: () => void): void {
    if (this.#machine.state === 'idle') {
      run();
    } else if (this.#activeAnim) {
      // This request supersedes anything still waiting: landing the current turn commits it,
      // and that commit drains the queue. Without clearing it first, an older tap would fire
      // from inside the commit and take the book somewhere the reader has since changed their
      // mind about — a reversal would be undone by the forward tap it was meant to replace.
      this.#queuedFlip = null;
      this.#finishActiveAnim(); // lands the current turn → machine back to idle
      run();
    } else {
      this.#queuedFlip = run; // dragging: no animation to cut short, so wait for release
    }
  }

  /** Snap the in-flight fold to its end pose and commit it now, cancelling its RAF loop. */
  #finishActiveAnim(): void {
    const anim = this.#activeAnim;
    if (!anim) return;
    this.#activeAnim = null;
    if (this.#raf !== null) {
      cancelAnimationFrame(this.#raf);
      this.#raf = null;
    }
    this.#renderer?.setFlipProgress(anim.toT, anim.direction);
    anim.onDone();
  }

  /** After an animation settles, fire whatever flip was requested mid-turn. */
  #drainQueuedFlip(): void {
    const queued = this.#queuedFlip;
    if (!queued) {
      // Nothing further to turn to, so this is where the book comes to rest: a good moment to
      // apply any page content that improved while it was moving.
      this.#flushPendingUpgrades();
      return;
    }
    this.#queuedFlip = null;
    queued();
  }

  getZoom(): number {
    return this.#scale;
  }

  /** Zoom to `scale` (clamped to [1, zoom.max]), keeping `center` (container-local) fixed. */
  setZoom(scale: number, center?: { x: number; y: number }): void {
    if (!this.#renderer || !this.#zoomEnabled) return;
    this.#cancelPeek(); // a zoom takes over the view; don't leave a peek folding under it
    this.#cancelNudge(); // and don't let a boundary rubber-band fight the zoom's own transform
    const s2 = clamp(scale, 1, this.#maxZoom);
    const m = this.#renderer.measure();
    // Default to the middle of the pages, not of the container: on a lone page those differ, and
    // zooming toward the container centre would drift the page off toward the gutter.
    const box = m.screenAt?.(this.#scale);
    const focal = center ??
      (box
        ? { x: box.x + this.#tx + box.width / 2, y: box.y + this.#ty + box.height / 2 }
        : null) ?? { x: m.containerWidth / 2, y: m.containerHeight / 2 };
    const s1 = this.#scale;
    // Solve for the translate that keeps the focal screen point fixed as s1→s2.
    let tx = s2 === 1 ? 0 : focal.x - (s2 / s1) * (focal.x - this.#tx);
    let ty = s2 === 1 ? 0 : focal.y - (s2 / s1) * (focal.y - this.#ty);
    [tx, ty] = this.#clampPan(tx, ty, s2, m.containerWidth, m.containerHeight);
    this.#scale = s2;
    this.#tx = tx;
    this.#ty = ty;
    this.#renderer.setViewTransform(s2, tx, ty);
    // Crossing in/out of zoom flips who owns vertical panning: browser scroll at rest, us when zoomed.
    if ((s1 > 1) !== (s2 > 1)) this.#applyTouchAction();
    this.#refreshZoomTiles();
    this.#updateCursor(); // crossing in/out of zoom swaps the flip hint for the zoom hint
    // First zoom in: teach panning, since a zoomed page has no visual cue that it can be dragged.
    if (s1 <= 1 && s2 > 1) {
      this.#markLearned('zoom');
      this.#showPanCaption();
    }
    this.#emitter.emit('zoomChanged', { scale: s2 });
  }

  resetZoom(): void {
    this.setZoom(1);
  }

  /** Whether page-flip sound is enabled for this book (the `sound` option was set). */
  isSoundEnabled(): boolean {
    return this.#soundEnabled;
  }

  /** Whether flip sound is currently muted. Always false when sound is not enabled. */
  isSoundMuted(): boolean {
    return this.#soundEnabled && this.#soundMuted;
  }

  /** Mute or unmute the flip sound. Remembered even if the sound controller is still loading, and
   *  a no-op when `sound` was never enabled. */
  setSoundMuted(muted: boolean): void {
    if (!this.#soundEnabled) return;
    this.#soundMuted = muted;
    this.#sound?.setMuted(muted);
    if (this.#soundPersist) this.#saveSoundMuted(muted);
    // Unmuting a book that started muted is the first time the clip is actually needed: load now.
    if (!muted) void this.#loadSound();
  }

  /** Read the reader's remembered mute choice (persist mode), overriding the configured default.
   *  Storage can throw in private mode or a sandboxed iframe — fall back to the default silently. */
  #loadSoundMuted(): void {
    try {
      const raw = localStorage.getItem(SOUND_MUTED_STORAGE_KEY);
      if (raw === 'true' || raw === 'false') this.#soundMuted = raw === 'true';
    } catch {
      // No stored choice; keep the configured default.
    }
  }

  #saveSoundMuted(muted: boolean): void {
    try {
      localStorage.setItem(SOUND_MUTED_STORAGE_KEY, String(muted));
    } catch {
      // Persisting is best-effort; the in-memory state still holds this session.
    }
  }

  /** Hand the browser the gestures we don't use, so a flipbook filling the viewport doesn't trap
   *  the page. At rest we only claim horizontal turns, so vertical panning (page scroll) stays the
   *  browser's — `pan-y`. Zoomed in, one finger pans the image in both axes, so we take it all. */
  #applyTouchAction(): void {
    this.#container.style.touchAction = this.#scale > 1 ? 'none' : 'pan-y';
  }

  #clampPan(tx: number, ty: number, scale: number, w: number, h: number): [number, number] {
    // Bound the pan by where the pages actually are, not by the container. A lone page (a cover,
    // or the back of a book-mode spread) is painted in the middle half, and letterboxing insets
    // the book on any container whose aspect differs; clamping to the container would let the
    // reader drag the page off to one side and stare at the space beside it.
    //
    // `screen` is where the renderer says the pages are under the *current* view, so the offset
    // between it and the translate that produced it converts a wanted translate into a page
    // position. The renderers place a lone page differently (one shifts outside the view scale,
    // one inside), which is why this asks rather than deriving it.
    // Land on whole device pixels. A fractional offset makes every screen pixel a different
    // bilinear blend of the same texels, so as the page slides the strokes of each glyph thicken
    // and thin: the text appears to shimmer and change weight rather than simply move.
    const dpr = typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1;
    // `|| 0` normalises -0, which Object.is and strict deep-equality treat as distinct from 0.
    const snap = (v: number): number => Math.round(v * dpr) / dpr || 0;

    // Asked for `scale` rather than read from the current view, because setZoom clamps before it
    // commits and would otherwise be bounded by the scale it is leaving.
    // Falls back to the container, which is what the pages fill on a renderer that does not
    // report a box: keeps a bare Renderer implementation clamped rather than free to pan away.
    const box = this.#renderer?.measure().screenAt?.(scale) ?? {
      x: 0,
      y: 0,
      width: w * scale,
      height: h * scale,
    };
    const [minX, maxX] = axisPanRange(box.x, box.width, w);
    const [minY, maxY] = axisPanRange(box.y, box.height, h);
    return [snap(clamp(tx, minX, maxX)), snap(clamp(ty, minY, maxY))];
  }

  on<K extends keyof ZineEventMap>(
    event: K,
    listener: (payload: ZineEventMap[K]) => void,
  ): () => void {
    return this.#emitter.on(event, listener);
  }

  destroy(): void {
    this.#destroyed = true;
    if (this.#raf !== null) cancelAnimationFrame(this.#raf);
    this.#activeAnim = null;
    this.#queuedFlip = null;
    this.#clearPendingClickFlip();
    this.#clearIdleNudge();
    this.#cancelPeek();
    this.#cancelNudge();
    this.#clearZoomHint();
    this.#hideCaption();
    this.#sound?.destroy();
    this.#sound = null;
    this.#resizeObserver?.disconnect();
    this.#deepLink?.stop();
    this.#deepLink = null;
    this.#unsubscribeDeepLink?.();
    if (this.#deepLinkEnabled) releaseHash(); // a later book may own it now
    this.#controlsCleanup?.();
    this.#contextMenuCleanup?.();
    this.#dismissLoader();
    this.#a11yCleanup?.();
    this.#unbindWheel?.();
    this.#unbindDblClick?.();
    this.#unbindContextMenu?.();
    this.#unbindCursor?.();
    this.#unbindInput?.();
    if (this.#tileTimer !== null) clearTimeout(this.#tileTimer);
    this.#tileGeneration++; // strand any raster still resolving
    this.#renderer?.destroy();
    this.#renderer = null;
    this.#source.destroy();
    this.#emitter.clear();
  }

  #startFlip(targetIndex: number): void {
    if (targetIndex < 0 || targetIndex >= this.#spreads.length || targetIndex === this.#current) {
      return;
    }
    this.#cancelPeek(); // a real turn is starting; drop any peek folding the same leaf
    this.#cancelNudge(); // and any boundary rubber-band still springing
    // `flip` is legal only from idle; otherwise a flip/drag is already in flight.
    if (this.#machine.send('flip') === null) return;

    const direction: FlipDirection = targetIndex > this.#current ? 'forward' : 'backward';
    const toPage = this.#leadPage(targetIndex);
    // State is already locked (send('flip') above), so re-entrant flips are rejected
    // even though staging the destination content below is async.
    this.#emitter.emit('flipStart', { from: this.#currentPage, to: toPage });
    this.#playFlipSound(); // an animated turn (click/swipe/arrow/API) is committed once it starts
    // Claimed here, synchronously, so this flip owns the run before #runFlip's first await.
    // Bumping inside #runFlip instead let a superseded flip's continuation claim the newest
    // generation and cancel the flip that replaced it.
    void this.#runFlip(targetIndex, direction, toPage, ++this.#flipGeneration);
  }

  async #runFlip(
    targetIndex: number,
    direction: FlipDirection,
    toPage: number,
    generation: number,
  ): Promise<void> {
    // Staging the destination is async, so this can resume after a later flip has already
    // superseded it (interrupting mid-turn does exactly that). Without this check the stale
    // continuation would begin animating its own, now-abandoned target and commit it, undoing
    // the turn the reader actually asked for.
    const toSpread = this.#spreads[targetIndex];
    const toContent: SpreadContent = toSpread
      ? await this.#resolveContent(toSpread)
      : { left: null, right: null };
    if (generation !== this.#flipGeneration) return;
    this.#renderer?.beginFlip(this.#currentContent, toContent, direction, {
      fill: this.#singlePage,
      curl: this.#effectiveCurl(),
      anchor: { y: this.#anchorY },
    });
    this.#animateProgress(
      0,
      1,
      direction,
      () => this.#commit(targetIndex, toPage, toContent),
      () => this.#announcePage(toPage),
    );
  }

  /** Animate the fold from `fromT` to `toT`, easing per-frame, then run `onDone`. */
  #animateProgress(
    fromT: number,
    toT: number,
    direction: FlipDirection,
    onDone: () => void,
    onLead?: () => void,
  ): void {
    const duration = this.#effectiveDuration() * Math.abs(toT - fromT);
    if (duration <= 0) {
      // Reduced motion (or zero-duration): swap without the curl sweep. onDone announces the
      // page itself, so there is no separate lead to fire.
      this.#renderer?.setFlipProgress(toT, direction);
      onDone();
      return;
    }
    // Remembered so a mid-turn flip request can #finishActiveAnim() to land it at once.
    // Object identity also tags this run: if #finishActiveAnim (or a new flip) replaces it,
    // a stale frame that still fires bails instead of re-committing or rescheduling itself.
    const anim = { toT, direction, onDone };
    this.#activeAnim = anim;
    const start = performance.now();
    let ledPage = false;
    const step = (now: number): void => {
      if (this.#activeAnim !== anim) return; // superseded/interrupted → this frame is void
      // Easing lives here; flipProgressToPose stays linear so seeks are deterministic.
      // Same ease for lone and spread so single-page turns feel like the same flipbook, not a
      // stretched dissolve. Curl geometry holds the landed pose through the decelerating tail.
      const raw = Math.min(1, (now - start) / duration);
      const eased = easeInOutQuad(raw);
      // The ease decelerates hard into the end, so once the pose crosses the lead threshold the
      // fold already reads as landed. Announce the page number there — once — while the fold plays
      // on to its full duration: the number leads the near-still tail without shortening the flip.
      if (onLead && !ledPage) {
        const lead = this.#singlePage ? PAGE_LEAD_LONE : PAGE_LEAD;
        if (eased >= lead) {
          ledPage = true;
          onLead();
        }
      }
      // `raw < 1` (not `raw >= 1`) so a finished — or NaN, under a rAF stub that omits the
      // timestamp — clock still lands rather than looping forever.
      if (raw < 1) {
        this.#renderer?.setFlipProgress(fromT + (toT - fromT) * eased, direction);
        this.#raf = requestAnimationFrame(step);
      } else {
        this.#renderer?.setFlipProgress(toT, direction);
        this.#raf = null;
        this.#activeAnim = null;
        onDone();
      }
    };
    this.#raf = requestAnimationFrame(step);
  }

  /** The page-facing half of a landing: current page, a11y text, and `pageChanged`. Fired from the
   *  animation lead a little before the fold finishes so the number updates on time, then guarded
   *  so the end-of-flip #commit does not repeat it. A jump with no animation just calls it inline. */
  #announcePage(toPage: number): void {
    if (this.#currentPage === toPage) return; // already led this turn (or nothing moved)
    this.#currentPage = toPage;
    this.#announce();
    this.#emitter.emit('pageChanged', { page: toPage });
  }

  #commit(targetIndex: number, toPage: number, toContent: SpreadContent): void {
    const spread = this.#spreads[targetIndex];
    this.#current = targetIndex;
    this.#currentContent = toContent;
    // renderSpread paints the landed spread and clears the turning leaf.
    if (spread) this.#paintSpread(spread, toContent);
    this.#prefetchWindow();
    this.#machine.send('settle');
    // Stamp the landing so a dead-edge double-click that arrives on its heels reads as the tail of
    // a flipping streak rather than a zoom (see #zoomAt).
    this.#lastFlipAt = performance.now();
    // No-op if the animation already led the number; otherwise (reduced motion, a canceled lead,
    // or an interrupt landing before the threshold) this is where it lands.
    this.#announcePage(toPage);
    this.#markLearned('turn'); // a page has turned — the peek/idle-nudge have taught their lesson
    this.#updateCursor(); // the new spread may have reached an end, killing a flip zone under the pointer
    this.#emitter.emit('flipEnd', { page: toPage });
    this.#drainQueuedFlip();
  }

  #leadPage(spreadIndex: number): number {
    const spread = this.#spreads[spreadIndex];
    if (!spread) return this.#currentPage;
    const pages = [spread.left, spread.right].filter((p): p is number => p !== null);
    return pages.length > 0 ? Math.min(...pages) : this.#currentPage;
  }

  #onDragStart(clientX: number, clientY: number): void {
    if (this.#pinching || !this.#renderer) return;
    this.#cancelNudge(); // a new press reclaims the view from a boundary rubber-band still springing
    this.#clearPendingClickFlip(); // a new press cancels a click-flip still waiting out its window
    // Zoomed in → a drag pans; at scale 1 → a corner drag flips (§9 mode switch).
    if (this.#scale > 1) {
      if (this.#machine.send('panStart') === null) return;
      this.#pan = { baseTx: this.#tx, baseTy: this.#ty };
      return;
    }
    const b = this.#contentRect();
    const point = this.#toBookPoint(clientX, clientY);
    // Recorded before the busy check below: a tap landing mid-flip is still a real tap, and
    // on release it decides which way to turn. Leaving the previous press in place made that
    // release repeat the last flip's direction instead of honouring the side just tapped.
    this.#press = point; // remembered for tap classification / click-to-flip zone
    // Grabbable along the whole outer band of each side edge, not just the corners: a drag
    // from the vertical middle should peel and follow the finger too, the way a corner does.
    // The fold then anchors at the grabbed height, so mid-edge grabs curl from the middle.
    const edgeBand = Math.min(b.width, b.height) * CORNER_FRACTION;
    const insidePage = point.x >= 0 && point.x <= b.width && point.y >= 0 && point.y <= b.height;
    const nearSideEdge = point.x <= edgeBand || point.x >= b.width - edgeBand;
    const wantsGrab = insidePage && nearSideEdge;
    // A fold may already be mid-flight when this press lands.
    if (this.#machine.state !== 'idle') {
      // Only an edge grab that can land the running turn takes it over. A live finger drag has
      // no animation to cut short (#activeAnim null), and a non-grab press (centre tap, or an
      // edge *tap* handled on release) must leave the animation to play out — so both bail here.
      // A flip's async content-staging also has #activeAnim null, so that window bails too.
      if (!this.#activeAnim || !wantsGrab) {
        this.#pendingGrab = null;
        return;
      }
      // Commit the running turn now so this grab peels straight on from where the book lands,
      // exactly the way repeated taps interrupt-and-advance. #current updates before we target.
      this.#finishActiveAnim();
    }
    if (!wantsGrab) {
      return; // not near a side edge — no drag; a tap here may still click-to-flip on release
    }
    this.#anchorY = clamp(point.y / b.height, 0, 1); // fold anchors at the grabbed point
    // Arm a potential drag; it only becomes a real flip once the pointer moves
    // (so an edge *tap* never fires a spurious flipStart). The right edge
    // turns the page forward in LTR; RTL mirrors it.
    const rightSide = point.x > b.width / 2;
    const forward = this.#direction === 'rtl' ? !rightSide : rightSide;
    const targetIndex = this.#current + (forward ? 1 : -1);
    if (targetIndex < 0 || targetIndex >= this.#spreads.length) return;
    this.#pendingGrab = {
      direction: forward ? 'forward' : 'backward',
      targetIndex,
      toPage: this.#leadPage(targetIndex),
      width: b.width,
    };
  }

  /** Turn an armed corner press into a live drag flip once the pointer has moved. */
  #promoteGrab(): void {
    const grab = this.#pendingGrab;
    if (!grab) return;
    this.#pendingGrab = null;
    if (this.#machine.send('grab') === null) return;
    this.#drag = {
      direction: grab.direction,
      targetIndex: grab.targetIndex,
      toPage: grab.toPage,
      toContent: { left: null, right: null },
      width: grab.width,
      t: 0,
    };
    this.#emitter.emit('flipStart', { from: this.#currentPage, to: grab.toPage });
    void this.#stageDrag(grab.targetIndex, grab.direction);
  }

  async #stageDrag(targetIndex: number, direction: FlipDirection): Promise<void> {
    const toSpread = this.#spreads[targetIndex];
    const toContent: SpreadContent = toSpread
      ? await this.#resolveContent(toSpread)
      : { left: null, right: null };
    // The drag may have ended (or retargeted) while content was resolving.
    if (this.#drag?.targetIndex !== targetIndex) return;
    this.#drag.toContent = toContent;
    this.#renderer?.beginFlip(this.#currentContent, toContent, direction, {
      fill: this.#singlePage,
      curl: this.#effectiveCurl(),
      anchor: { y: this.#anchorY },
    });
    this.#renderer?.setFlipProgress(this.#drag.t, direction);
  }

  #onDragMove(dx: number, dy: number): void {
    if (this.#pinching) return;
    if (this.#pan) {
      if (!this.#renderer) return;
      const m = this.#renderer.measure();
      const [tx, ty] = this.#clampPan(
        this.#pan.baseTx + dx,
        this.#pan.baseTy + dy,
        this.#scale,
        m.containerWidth,
        m.containerHeight,
      );
      this.#tx = tx;
      this.#ty = ty;
      this.#renderer.setViewTransform(this.#scale, tx, ty);
      this.#refreshZoomTiles();
      this.#markLearned('pan'); // the reader is panning — the caption has served its purpose
      this.#hideCaption();
      return;
    }
    // An armed corner press becomes a real flip once it moves past the threshold.
    if (this.#pendingGrab && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      this.#promoteGrab();
    }
    const drag = this.#drag;
    if (!drag) return;
    const signed = drag.direction === 'forward' ? -dx : dx;
    drag.t = clamp(signed / drag.width, 0, 1);
    this.#renderer?.setFlipProgress(drag.t, drag.direction);
  }

  #onDragEnd(gesture: GestureEnd): void {
    if (this.#pinching) return;
    if (this.#pan) {
      this.#pan = null;
      this.#machine.send('panEnd');
      this.#updateCursor(); // pan over → re-derive the resting hint (no move fires on release)
      return;
    }
    const drag = this.#drag;
    if (!drag) {
      // Never became a grab (the press was not on a side edge, so no live peel armed). A fast
      // horizontal flick from anywhere still turns the page; otherwise it was a tap.
      this.#pendingGrab = null;
      if (!this.#swipeFlip(gesture)) this.#maybeClickFlip(gesture);
      return;
    }
    this.#drag = null;
    this.#machine.send('release');

    // A flick at release throws the page, and its direction is the release velocity (vx), not the
    // net displacement: you can peel a page well past halfway and then flick it back toward the
    // edge to let go — the mobile counterpart of dragging back to cancel on desktop. An onward
    // throw commits even from short of halfway; a back-throw cancels even from past it. Position
    // (drag.t) decides only when the release is not a horizontal flick.
    const horizFlick = gesture.swipe && Math.abs(gesture.vx) > Math.abs(gesture.vy);
    const onward = drag.direction === 'forward' ? gesture.vx < 0 : gesture.vx > 0;
    const flungOnward = horizFlick && onward;
    const flungBack = horizFlick && !onward;
    if (flungOnward || (drag.t >= 0.5 && !flungBack)) {
      this.#playFlipSound(); // the drag committed to a turn (flung on, or released past halfway)
      this.#animateProgress(
        drag.t,
        1,
        drag.direction,
        () => this.#commit(drag.targetIndex, drag.toPage, drag.toContent),
        () => this.#announcePage(drag.toPage),
      );
    } else {
      this.#animateProgress(drag.t, 0, drag.direction, () => this.#cancelFlip());
    }
  }

  /** A fast horizontal flick that started away from the side edges (so no live peel was armed):
   *  turn the page in the flick's direction. Returns whether it consumed the gesture, so the caller
   *  skips click-to-flip. Zoomed in the same gesture pans, so this only applies at scale 1. */
  #swipeFlip(gesture: GestureEnd): boolean {
    if (this.#scale > 1) return false;
    // A flick, and predominantly horizontal — a vertical flick (page scroll intent) is not a turn.
    if (!gesture.swipe || Math.abs(gesture.dx) <= Math.abs(gesture.dy)) return false;
    // In LTR a leftward flick (dx < 0) turns forward; RTL and the reading direction mirror it.
    const forward = this.#direction === 'rtl' ? gesture.dx > 0 : gesture.dx < 0;
    const direction: FlipDirection = forward ? 'forward' : 'backward';
    if (!this.#canFlip(direction)) {
      this.#playEdgeNudge(direction); // swiped past the end: rubber-band toward the edge
      return false;
    }
    const step = forward ? 1 : -1;
    this.#requestFlip(() => this.#startFlip(this.#current + step));
    return true;
  }

  #maybeClickFlip(gesture: GestureEnd): void {
    if (this.#clickToFlip === 'off' || this.#scale > 1 || !this.#press) return;
    // A tap barely moves; anything more was a drag we already ignored.
    if (Math.abs(gesture.dx) > DRAG_THRESHOLD || Math.abs(gesture.dy) > DRAG_THRESHOLD) return;
    const direction = this.#clickFlipDirection(this.#press);
    if (!direction) return;
    if (!this.#canFlip(direction)) {
      this.#playEdgeNudge(direction); // nowhere to turn: rubber-band toward the edge instead
      return;
    }
    // Anchor the fold at the tapped height (cone/leaf/flick curl from where you tap).
    this.#anchorY = clamp(this.#press.y / this.#contentRect().height, 0, 1);
    // Read `#current` lazily: interrupting commits the running turn first, so this steps on
    // from wherever the book actually landed — one spread back from there is the neighbour
    // the reader is looking at, not the spread they tapped on two turns ago.
    const step = direction === 'forward' ? 1 : -1;
    const flip = (): void => this.#startFlip(this.#current + step);
    this.#clearPendingClickFlip();
    if (this.#clickFlipDelayValue <= 0) {
      // No double-click competing here → flip right away (or queue if mid-turn).
      this.#requestFlip(flip);
      return;
    }
    // Wait out the window; a double-click (zoom) cancels this.
    this.#pendingClickTimer = setTimeout(() => {
      this.#pendingClickTimer = null;
      this.#requestFlip(flip);
    }, this.#clickFlipDelayValue);
  }

  /** Where the current spread is actually drawn (lone pages centered), as the renderer reports
   *  it — the region taps/drags map into. Falls back to book, then the full container. */
  #contentRect(): { x: number; y: number; width: number; height: number } {
    const m = this.#renderer!.measure();
    return m.content ?? m.book ?? { x: 0, y: 0, width: m.containerWidth, height: m.containerHeight };
  }

  /** A viewport point in book-local px: relative to the drawn page, not the container. The two
   *  differ whenever the book is letterboxed, so every hit test against a zone or corner has to
   *  come through here — measuring from the container edge puts the zones off by the bar width. */
  #toBookPoint(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.#container.getBoundingClientRect();
    const b = this.#contentRect();
    return { x: clientX - rect.left - b.x, y: clientY - rect.top - b.y };
  }

  /** Which way a tap at `point` (book-local, via {@link #toBookPoint}) turns the page, or null
   *  for a dead zone. */
  #clickFlipDirection(point: { x: number; y: number }): FlipDirection | null {
    if (!this.#renderer) return null;
    const bookWidth = this.#contentRect().width;
    let side: 'left' | 'right' | null;
    if (this.#clickToFlip === 'half') {
      side = point.x > bookWidth / 2 ? 'right' : 'left';
    } else if (point.x <= this.#clickZoneSize) {
      side = 'left';
    } else if (point.x >= bookWidth - this.#clickZoneSize) {
      side = 'right';
    } else {
      side = null; // center dead zone in 'edge' mode
    }
    if (!side) return null;
    const forwardSide = this.#direction === 'rtl' ? 'left' : 'right';
    return side === forwardSide ? 'forward' : 'backward';
  }

  /** Whether a flip in `direction` has somewhere to land: false at the first spread going back
   *  and the last spread going forward. A flip zone that fails this is dead, so a double-click
   *  there should zoom rather than defer to a turn that can never happen. */
  #canFlip(direction: FlipDirection): boolean {
    const target = this.#current + (direction === 'forward' ? 1 : -1);
    return target >= 0 && target < this.#spreads.length;
  }

  /** Watch the pointer at rest and hint what a press there would do through the cursor (mouse only;
   *  touch never fires these). A separate listener from the gesture recognizer so it can be removed
   *  on its own; both read the same `pointermove` stream. */
  #bindCursorHints(): void {
    const move = (e: Event): void => {
      const p = e as PointerEvent;
      this.#pointerClient = { x: p.clientX, y: p.clientY };
      this.#updateCursor();
    };
    const leave = (): void => {
      this.#pointerClient = null;
      this.#updateCursor();
    };
    this.#container.addEventListener('pointermove', move);
    this.#container.addEventListener('pointerleave', leave);
    this.#unbindCursor = (): void => {
      this.#container.removeEventListener('pointermove', move);
      this.#container.removeEventListener('pointerleave', leave);
    };
  }

  /** Re-derive the cursor from the last pointer position. Called both on movement and after a page
   *  turn, zoom, or resize changes what a press at the same spot would do without the mouse moving. */
  #updateCursor(): void {
    if (!this.#cursorHints || !this.#renderer) return;
    let cursor = '';
    if (this.#drag || this.#pan) {
      cursor = 'grabbing'; // a peel or pan is in flight — the hand has hold of the page
    } else if (this.#pointerClient) {
      cursor = this.#cursorFor(this.#pointerClient.x, this.#pointerClient.y);
    }
    this.#container.style.cursor = cursor;
  }

  /**
   * The cursor for a resting pointer at client (x, y): a hint for what a press would do, read from
   * the same zone classifiers the gestures use. Returns '' (the default arrow) off the drawn page
   * or where a press does nothing.
   *
   * Zoomed in, the whole page pans, so one steady 'grab' covers it — no flicker as the reader moves,
   * and it never lies about a double-click that would zoom back out (grab, not a stale zoom-in). At
   * rest there are two hints: 'pointer' over a live click-to-flip zone, and 'zoom-in' everywhere else
   * a double-click would zoom (including the edge peel band, so a sweep across the page stays calm).
   * A drag peels regardless; it just is not called out with its own resting cursor.
   */
  #cursorFor(clientX: number, clientY: number): string {
    if (!this.#renderer) return '';
    const b = this.#contentRect();
    const p = this.#toBookPoint(clientX, clientY);
    if (p.x < 0 || p.y < 0 || p.x > b.width || p.y > b.height) return ''; // a letterbox bar
    // Zoomed in the page pans everywhere: a drag is the standing gesture, so hint it with grab.
    if (this.#scale > 1) return 'grab';
    // At rest a click turns the page in the flip zones...
    const flipDir = this.#clickFlipDirection(p);
    if (flipDir && this.#canFlip(flipDir)) return 'pointer';
    // ...and elsewhere a double-click zooms in (from rest the next configured level is always up).
    if (this.#zoomEnabled && this.#doubleClickLevels !== null) return 'zoom-in';
    return '';
  }

  // --- Discoverability hints (corner peek, idle nudge, first-zoom caption) ---

  /** Read the learned flags from localStorage (persist mode). Storage can throw in private mode or a
   *  sandboxed iframe, and a corrupt value is not worth crashing over — either way, learn nothing. */
  #loadLearned(): void {
    try {
      const raw = localStorage.getItem(HINTS_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<Learned>;
      this.#learned = {
        turn: saved.turn === true,
        zoom: saved.zoom === true,
        pan: saved.pan === true,
      };
    } catch {
      // No stored history; the reader is simply taught fresh.
    }
  }

  /** Record that the reader has performed a gesture, so the hint teaching it stays quiet from now on
   *  (and across visits under persist). Idempotent; tears down whatever that signal silences. */
  #markLearned(signal: 'turn' | 'zoom' | 'pan'): void {
    if (this.#learned[signal]) return;
    this.#learned[signal] = true;
    if (signal === 'turn') this.#clearIdleNudge(); // no more peeks once a page has been turned
    if (signal === 'zoom') this.#clearZoomHint(); // reader zoomed; a pending zoom caption is moot
    if (this.#hintsPersist) {
      try {
        localStorage.setItem(HINTS_STORAGE_KEY, JSON.stringify(this.#learned));
      } catch {
        // Persisting is best-effort; the in-memory flag still silences the hint this session.
      }
    }
  }

  /** Arm the one-shot idle nudge: if the reader turns no page within IDLE_NUDGE_MS, replay the peek
   *  once. Any real turn clears the timer first (see #markLearned('turn')). */
  #armIdleNudge(): void {
    if (!this.#hintsEnabled || this.#reducedMotion || this.#learned.turn) return;
    this.#clearIdleNudge();
    this.#idleTimer = setTimeout(() => {
      this.#idleTimer = null;
      this.#playPeek();
    }, IDLE_NUDGE_MS);
  }

  #clearIdleNudge(): void {
    if (this.#idleTimer !== null) {
      clearTimeout(this.#idleTimer);
      this.#idleTimer = null;
    }
  }

  /**
   * The corner peek: lift the leading page's outer edge to PEEK_PROGRESS and settle it back, once,
   * without committing a turn. A wordless "this page turns" cue that reaches touch and mouse alike.
   *
   * Its own rAF loop, not #animateProgress — that one is wired to #commit and the flip generation.
   * Tagged by #peekAnim so a real flip (or destroy) cancels a peek in flight; the leaf is repainted
   * flat at the end so nothing is left half-folded.
   */
  async #playPeek(): Promise<void> {
    if (
      !this.#hintsEnabled ||
      this.#reducedMotion ||
      this.#learned.turn ||
      !this.#renderer ||
      typeof requestAnimationFrame !== 'function' || // no way to animate; skip the cosmetic cue
      this.#machine.state !== 'idle' // a real flip/drag/pan owns the leaf; don't fight it
    ) {
      return;
    }
    const targetIndex = this.#current + 1;
    const toSpread = this.#spreads[targetIndex];
    if (!toSpread) return; // nothing ahead to peek toward (single spread, or already at the end)
    const toContent = await this.#resolveContent(toSpread);
    // Guard the async gap: a turn, a zoom, a teardown, or a second peek may have intervened.
    if (this.#destroyed || this.#learned.turn || this.#machine.state !== 'idle' || this.#peekAnim) {
      return;
    }
    // Anchor the fold at the bottom-outer corner, the natural place a thumb lifts a page.
    this.#anchorY = 1;
    this.#renderer.beginFlip(this.#currentContent, toContent, 'forward', {
      fill: this.#singlePage,
      curl: this.#effectiveCurl(),
      anchor: { y: this.#anchorY },
    });
    const token = {};
    this.#peekAnim = token;
    const start = performance.now();
    const total = PEEK_LEG_MS * 2;
    // Read the clock from performance.now(), not the rAF timestamp arg: it is what drives the two
    // legs, and it keeps the loop working under a rAF stub that omits the timestamp.
    const step = (): void => {
      if (this.#peekAnim !== token) return; // superseded/cancelled → this frame is void
      const raw = Math.min(1, (performance.now() - start) / total);
      // Out to PEEK_PROGRESS by the midpoint, back to 0 by the end; a soft sine so it eases at both
      // the lift and the settle rather than snapping.
      const t = PEEK_PROGRESS * Math.sin(raw * Math.PI);
      this.#renderer?.setFlipProgress(Math.max(0, t), 'forward');
      if (raw < 1) {
        this.#raf = requestAnimationFrame(step);
      } else {
        this.#raf = null;
        this.#peekAnim = null;
        this.#repaintRestingSpread(); // clear the turning leaf, back to a flat spread
      }
    };
    this.#raf = requestAnimationFrame(step);
  }

  /** Stop a peek mid-play (a real gesture is taking over) and leave the spread flat. */
  #cancelPeek(): void {
    if (!this.#peekAnim) return;
    this.#peekAnim = null;
    if (this.#raf !== null) {
      cancelAnimationFrame(this.#raf);
      this.#raf = null;
    }
    this.#repaintRestingSpread();
  }

  /** Repaint the current spread flat (no turning leaf), used to land a finished/cancelled peek. */
  #repaintRestingSpread(): void {
    const spread = this.#spreads[this.#current];
    if (spread && this.#machine.state === 'idle') this.#paintSpread(spread, this.#currentContent);
  }

  /**
   * The boundary rubber-band: on a tap/swipe that would turn the page but has nowhere to land (the
   * last spread going forward, the first going back), slide the whole spread a little toward that
   * edge and spring it back. A wordless "this is the end" that reads on touch and mouse alike.
   *
   * A view-transform animation (setViewTransform), not a fold — there is no next page to curl toward
   * at a boundary. Its own rAF loop, tagged by #nudgeAnim so a real gesture cancels it mid-spring.
   */
  #playEdgeNudge(direction: FlipDirection): void {
    if (
      !this.#renderer ||
      typeof requestAnimationFrame !== 'function' || // no way to animate; skip the cosmetic cue
      this.#reducedMotion ||
      this.#machine.state !== 'idle' || // a flip/drag owns the view; don't fight it
      this.#scale > 1 || // zoomed: the transform is the reader's pan, not ours to move
      this.#nudgeAnim // one nudge at a time
    ) {
      return;
    }
    // Slide toward the edge the reader tried to reach: forward turns off the right in LTR, so the
    // spread travels left (negative x); RTL and backward mirror it.
    const forward = direction === 'forward';
    const toRightEdge = this.#direction === 'rtl' ? !forward : forward;
    const sign = toRightEdge ? -1 : 1;
    const token = {};
    this.#nudgeAnim = token;
    const start = performance.now();
    const step = (): void => {
      if (this.#nudgeAnim !== token) return; // superseded/cancelled → this frame is void
      const raw = Math.min(1, (performance.now() - start) / EDGE_NUDGE_MS);
      // Out to EDGE_NUDGE_PX at the midpoint, back to 0 by the end — a soft sine springs at both ends.
      const offset = EDGE_NUDGE_PX * Math.sin(raw * Math.PI);
      this.#renderer?.setViewTransform(1, sign * offset, 0);
      if (raw < 1) {
        this.#raf = requestAnimationFrame(step);
      } else {
        this.#raf = null;
        this.#nudgeAnim = null;
        this.#renderer?.setViewTransform(1, 0, 0); // land exactly on center
      }
    };
    this.#raf = requestAnimationFrame(step);
  }

  /** Stop a boundary nudge mid-spring (a real gesture is taking over) and reset the view to center. */
  #cancelNudge(): void {
    if (!this.#nudgeAnim) return;
    this.#nudgeAnim = null;
    if (this.#raf !== null) {
      cancelAnimationFrame(this.#raf);
      this.#raf = null;
    }
    this.#renderer?.setViewTransform(1, 0, 0);
  }

  /** Show the one-time "drag to move" caption over the book on the first zoom. Self-contained inline
   *  styles: the controls stylesheet is absent when `controls: false`, and this hint must still work.
   *  A dark toast pill with light text reads on any page background and either theme. */
  #showPanCaption(): void {
    if (this.#learned.pan) return;
    this.#showCaption('Drag to move'); // panning has no visual analog, so this one hint uses words
  }

  /** Show a transient caption pill over the book, replacing any caption already up. Self-contained
   *  inline styles: the controls stylesheet is absent when `controls: false`, and a hint must still
   *  work. Guarded by #hintsEnabled so `hints: false` shows nothing. */
  #showCaption(text: string): void {
    if (!this.#hintsEnabled) return;
    const doc = this.#container.ownerDocument;
    if (!doc || typeof this.#container.appendChild !== 'function') return;
    this.#hideCaption(); // one pill at a time; drop any caption (and its timer) already showing
    const el = doc.createElement('div');
    el.className = 'zine-hint-caption';
    el.setAttribute('aria-hidden', 'true'); // decorative; screen readers get the gesture via a11y text
    el.textContent = text;
    el.style.cssText =
      'position:absolute;left:50%;bottom:16px;transform:translateX(-50%);z-index:3;' +
      'pointer-events:none;padding:6px 12px;border-radius:999px;font:500 13px/1.2 system-ui,sans-serif;' +
      'color:#fff;background:rgba(24,24,27,0.82);box-shadow:0 1px 4px rgba(0,0,0,0.35);' +
      'white-space:nowrap;opacity:0;';
    const canAnimate = !this.#reducedMotion && typeof requestAnimationFrame === 'function';
    if (canAnimate) el.style.transition = 'opacity 200ms ease';
    this.#container.appendChild(el);
    this.#captionEl = el;
    if (canAnimate) {
      // Next frame so the initial opacity:0 is committed before the transition to 1.
      requestAnimationFrame(() => {
        if (this.#captionEl === el) el.style.opacity = '1';
      });
    } else {
      el.style.opacity = '1'; // no fade available — just show it
    }
    this.#captionTimer = setTimeout(() => this.#hideCaption(), CAPTION_MS);
  }

  /** Remove the caption (on the gesture it taught, its timeout, or teardown). */
  #hideCaption(): void {
    if (this.#captionTimer !== null) {
      clearTimeout(this.#captionTimer);
      this.#captionTimer = null;
    }
    this.#captionEl?.remove();
    this.#captionEl = null;
  }

  /** After a lone click lands where only a double-click would do anything (a dead zone at rest),
   *  wait out the pairing window; if no second click pairs, the reader tried to act and nothing
   *  happened — hint how to zoom. Mouse-only (touch has no double-click), once a session, and never
   *  once zoom is learned. A real double-click clears this (it zooms, which teaches zoom directly). */
  #maybeArmZoomHint(clientX: number, clientY: number): void {
    if (!this.#hintsEnabled || this.#learned.zoom || this.#zoomHintShown) return;
    if (this.#lastPointerType !== 'mouse') return;
    // Only where a single click did nothing but a double-click would zoom (dead zone, scale 1, zoom
    // on). #cursorFor already folds in letterbox, flip-zone, and scale arbitration.
    if (this.#cursorFor(clientX, clientY) !== 'zoom-in') return;
    // Not on the tail of a rapid flipping streak — those dead-zone clicks are turning, not zooming.
    if (this.#machine.state === 'animating' || performance.now() - this.#lastFlipAt <= FLIP_STREAK_MS) {
      return;
    }
    this.#clearZoomHint();
    this.#zoomHintTimer = setTimeout(() => {
      this.#zoomHintTimer = null;
      if (this.#learned.zoom || this.#zoomHintShown) return; // a zoom landed while we waited
      this.#zoomHintShown = true;
      this.#showCaption(this.#zoomHintText());
    }, DOUBLE_CLICK_MS);
  }

  /** The zoom caption's text, naming whichever zoom gestures are actually enabled. Double-click is
   *  always one (this fires only where a double-click would zoom); Ctrl/⌘-scroll is added when wheel
   *  zoom is on, with the platform's modifier. */
  #zoomHintText(): string {
    const parts: string[] = [];
    if (this.#doubleClickLevels !== null) parts.push('Double-click');
    if (this.#wheelZoom) {
      const nav = this.#container.ownerDocument?.defaultView?.navigator;
      const mac = /Mac|iPhone|iPad/.test(nav?.platform ?? '');
      parts.push(`${mac ? '⌘' : 'Ctrl'}-scroll`);
    }
    return `${parts.join(' or ')} to zoom`;
  }

  #clearZoomHint(): void {
    if (this.#zoomHintTimer !== null) {
      clearTimeout(this.#zoomHintTimer);
      this.#zoomHintTimer = null;
    }
  }

  #clearPendingClickFlip(): void {
    if (this.#pendingClickTimer !== null) {
      clearTimeout(this.#pendingClickTimer);
      this.#pendingClickTimer = null;
    }
  }

  #cancelFlip(): void {
    const spread = this.#spreads[this.#current];
    if (spread) this.#paintSpread(spread, this.#currentContent);
    this.#machine.send('settle');
    this.#updateCursor(); // the snapped-back spread may have changed the hint under a resting pointer
    this.#emitter.emit('flipEnd', { page: this.#currentPage });
    this.#drainQueuedFlip();
  }

  #onPinchStart(): void {
    // A second finger abandons any single-pointer gesture in flight.
    this.#pendingGrab = null;
    this.#clearPendingClickFlip();
    if (this.#drag) {
      this.#drag = null;
      this.#machine.send('release');
      this.#machine.send('settle');
      const spread = this.#spreads[this.#current];
      if (spread) this.#paintSpread(spread, this.#currentContent);
    } else if (this.#pan) {
      this.#pan = null;
      this.#machine.send('panEnd');
    }
    this.#pinching = true;
    this.#pinchBaseScale = this.#scale;
  }

  #onPinchMove(centerX: number, centerY: number, scale: number): void {
    if (!this.#pinching) return;
    const rect = this.#container.getBoundingClientRect();
    this.setZoom(this.#pinchBaseScale * scale, { x: centerX - rect.left, y: centerY - rect.top });
  }

  #onPinchEnd(): void {
    this.#pinching = false;
  }

  /** Swallow the right-click menu over the book, when the consumer asked for that. */
  #bindContextMenu(): void {
    if (!this.#disableContextMenu) return;
    const onContextMenu = (event: Event): void => event.preventDefault();
    this.#container.addEventListener('contextmenu', onContextMenu);
    this.#unbindContextMenu = () =>
      this.#container.removeEventListener('contextmenu', onContextMenu);
  }

  #bindWheelZoom(): void {
    const onWheel = (event: WheelEvent): void => {
      // Ctrl/⌘ + wheel only — this is also what a desktop trackpad pinch emits.
      if (!this.#wheelZoom || !this.#zoomEnabled || !(event.ctrlKey || event.metaKey)) return;
      // Override the browser's native page zoom.
      event.preventDefault();
      const rect = this.#container.getBoundingClientRect();
      const factor = Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY);
      this.setZoom(this.#scale * factor, {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };
    this.#container.addEventListener('wheel', onWheel as EventListener, { passive: false });
    this.#unbindWheel = () =>
      this.#container.removeEventListener('wheel', onWheel as EventListener);
  }

  #bindDoubleClickZoom(): void {
    // The library pairs clicks itself rather than trusting the browser's `dblclick`. The native
    // event drops out on rapid streaks — four fast clicks in one spot fire only a single
    // `dblclick`, because the browser resets its click counter mid-streak (often when the first
    // zoom shifts the target under the pointer). Detecting pairs from raw `click` events makes
    // every second click of a streak zoom (or cycle), so continuous clicks keep toggling.
    // Click carries no pointerType; capture it from the preceding pointerdown so the zoom hint can
    // stay mouse-only (touch has no double-click).
    const onDown = (event: PointerEvent): void => {
      this.#lastPointerType = event.pointerType;
    };
    const onClick = (event: MouseEvent): void => {
      const levels = this.#doubleClickLevels;
      if (!this.#zoomEnabled || levels === null || !this.#renderer) return;
      const t = performance.now();
      const prev = this.#lastClick;
      const paired =
        prev !== null &&
        t - prev.t <= DOUBLE_CLICK_MS &&
        Math.hypot(event.clientX - prev.x, event.clientY - prev.y) <= DOUBLE_CLICK_MOVE;
      if (!paired) {
        // First click of a potential pair: remember it and wait for a second.
        this.#lastClick = { t, x: event.clientX, y: event.clientY };
        // A lone click in a dead zone is a reader who tried something and got nothing: hint how to
        // zoom, unless the second click of a pair arrives first (a real zoom teaches it directly).
        this.#maybeArmZoomHint(event.clientX, event.clientY);
        return;
      }
      // Second click within the window → a double-click. Consume it so the next click starts a
      // fresh pair rather than chaining a third click into another zoom.
      this.#lastClick = null;
      this.#clearZoomHint(); // this pair is a real double-click; drop the pending lone-click hint
      this.#zoomAt(event.clientX, event.clientY, levels);
    };
    this.#container.addEventListener('pointerdown', onDown as EventListener);
    this.#container.addEventListener('click', onClick as EventListener);
    this.#unbindDblClick = () => {
      this.#container.removeEventListener('pointerdown', onDown as EventListener);
      this.#container.removeEventListener('click', onClick as EventListener);
    };
  }

  /** Cycle to the next configured zoom level, keeping the clicked point fixed. Honors the
   *  flip-zone arbitration at scale 1 so an edge double-click still turns the page there, and
   *  suppresses zoom on the tail of a rapid flipping streak (see below). */
  #zoomAt(clientX: number, clientY: number, levels: number[]): void {
    // At scale 1 a double-click inside a live flip zone belongs to click-to-flip, not zoom,
    // unless we're honoring double-click zoom there.
    if (this.#scale <= 1 && this.#clickToFlip !== 'off' && !this.#honorDoubleClickInFlipZone) {
      const local = this.#toBookPoint(clientX, clientY);
      const dir = this.#clickFlipDirection(local);
      // Yield to a zone that can actually turn: click-to-flip owns it, not zoom.
      if (dir !== null && this.#canFlip(dir)) return;
      // Otherwise — a dead edge at the book's ends, or the centre dead zone. That normally zooms,
      // but if the reader is mid-streak (a flip still folding, or one that just landed) the pair is
      // the tail of rapid flipping, not a zoom: swallow it. This is the cover/lone-page glitch —
      // the flip zone sits mid-screen there, so the first click turns the page and the second lands
      // in the centre of the spread it flipped to. A deliberate zoom comes once the reader pauses,
      // past the streak window.
      if (this.#machine.state === 'animating' || performance.now() - this.#lastFlipAt <= FLIP_STREAK_MS) {
        return;
      }
    }
    // A double-click means the single-click flip we may have queued was really a zoom.
    this.#clearPendingClickFlip();
    // Next configured level above the current scale, else wrap to the first.
    const next = levels.find((l) => l > this.#scale + 1e-6) ?? levels[0] ?? this.#scale;
    const rect = this.#container.getBoundingClientRect();
    this.setZoom(next, { x: clientX - rect.left, y: clientY - rect.top });
  }

  async #init(rendererOption: RendererOption): Promise<void> {
    // Load the renderer chunk while opening an async source (e.g. a PDF) in parallel.
    const rendererPromise = selectRenderer(rendererOption);
    // Report the download to the progress event and the built-in loader; register before open()
    // so the very first bytes are seen.
    this.#source.onProgress?.((p) => this.#onLoadProgress(p));
    if (typeof this.#source.open === 'function') {
      void this.#mountLoader(); // an async source has a wait worth indicating; sync ones do not
      try {
        await this.#source.open();
        this.#buildSpreadModel(); // page count known now; validates + builds spreads
      } catch (error) {
        this.#dismissLoader(); // tear the overlay down before `ready` rejects
        throw error;
      }
      this.#setLoaderPhase('preparing'); // bytes are in; the wait is now rasterizing
    }
    this.#source.prefetch([this.#currentPage]);

    const selected = await rendererPromise;
    const renderer = await this.#mountWithFallback(selected);
    this.#renderer = renderer;

    // Re-render the current spread when a source upgrades one of its pages in place.
    this.#source.onPageUpdate?.((index) => this.#onPageUpdate(index));

    // Now that we can measure, apply single-page mode if the container is narrow.
    this.#applySinglePage(renderer.measure().containerWidth);

    const pointer = new PointerRecognizer({
      onStart: (g) => this.#onDragStart(g.x, g.y),
      onMove: (g) => this.#onDragMove(g.dx, g.dy),
      onEnd: (g) => this.#onDragEnd(g),
    });
    const pinch = new PinchRecognizer({
      onPinchStart: () => this.#onPinchStart(),
      onPinchMove: (g) => this.#onPinchMove(g.centerX, g.centerY, g.scale),
      onPinchEnd: () => this.#onPinchEnd(),
    });
    this.#unbindInput = bindGestures(this.#container, { pointer, pinch });
    // We now own horizontal gestures; hand vertical panning (page scroll) back to the browser.
    this.#applyTouchAction();
    this.#bindWheelZoom();
    this.#bindDoubleClickZoom();
    this.#bindContextMenu();
    this.#bindCursorHints();
    this.#setupReducedMotion();
    this.#a11yCleanup = this.#setupA11y();

    await this.#renderCurrent();
    this.#dismissLoader(); // the first spread is painted; drop the overlay before the toolbar mounts
    this.#observeResize();
    this.#prefetchWindow();
    this.#announce();
    this.#bindDeepLink();
    await this.#mountControls();
    void this.#loadSound();
    this.#emitter.emit('ready');
    // The book is live: peek the leading corner once, then watch for an idle reader.
    void this.#playPeek();
    this.#armIdleNudge();
  }

  /**
   * Lazily import and build the flip-sound controller, once, when sound is enabled and audible — so
   * a silent book (`sound: false`, or `{ muted: true }` never unmuted) never pulls in the audio code
   * or the bundled clip. Called on ready for an audible book and again when the reader unmutes.
   * Best-effort: a failed import is ignored.
   */
  async #loadSound(): Promise<void> {
    if (!this.#soundEnabled || this.#soundMuted || this.#soundLoadStarted || this.#destroyed) return;
    this.#soundLoadStarted = true;
    try {
      const { FlipSound } = await import('./sound/flipSound');
      if (this.#destroyed) return; // torn down while the chunk loaded
      this.#sound = new FlipSound(this.#soundOptions);
      this.#sound.setMuted(this.#soundMuted); // honor a mute toggled while the chunk arrived
    } catch {
      // No audio code available: the book just stays silent.
    }
  }

  /** Play the flip sound, if enabled and ready. Called only where a turn is actually committed. */
  #playFlipSound(): void {
    this.#sound?.play();
  }

  /** Forward a download-progress tick to the public event and the built-in loader. */
  #onLoadProgress(progress: LoadProgress): void {
    this.#lastProgress = progress;
    this.#emitter.emit('progress', progress);
    this.#loader?.update(progress);
  }

  /**
   * Fetch the loader chunk and show the overlay, unless disabled or the book is already up.
   *
   * Lazy, so `loading: false` (or a source that never reports progress) never downloads it.
   * Failure is swallowed: a loader that cannot load should cost the reader a spinner, not the book.
   */
  async #mountLoader(): Promise<void> {
    if (this.#loadingOption === false || this.#destroyed) return;
    const container = this.#container;
    if (!container.ownerDocument || typeof container.appendChild !== 'function') return;
    try {
      const { mountLoading } = await import('./loading/loading');
      // The spread may have painted while the chunk was in flight; do not pop an overlay over it.
      if (this.#loaderPhase === 'done' || this.#destroyed) return;
      this.#loader = mountLoading(container);
      if (this.#lastProgress) this.#loader.update(this.#lastProgress);
      if (this.#loaderPhase === 'preparing') this.#loader.preparing();
    } catch {
      // No overlay; the book itself is unaffected.
    }
  }

  #setLoaderPhase(phase: 'preparing'): void {
    if (this.#loaderPhase === 'done') return;
    this.#loaderPhase = phase;
    this.#loader?.preparing();
  }

  #dismissLoader(): void {
    this.#loaderPhase = 'done';
    this.#loader?.destroy();
    this.#loader = null;
  }

  /** Mount `renderer`; if it can't initialize (e.g. no WebGL2 context) fall back to CSS. */
  async #mountWithFallback(renderer: Renderer): Promise<Renderer> {
    try {
      await renderer.mount(this.#container);
      renderer.onFatal?.(() => {
        void this.#fallbackToCss();
      });
      return renderer;
    } catch {
      renderer.destroy();
      const css = await selectRenderer('css');
      await css.mount(this.#container);
      this.#fellBack = true;
      this.#emitter.emit('rendererFallback', { from: 'webgl2', to: 'css' });
      return css;
    }
  }

  /** Runtime fallback: a live renderer signaled an unrecoverable failure (§8.4). */
  async #fallbackToCss(): Promise<void> {
    if (this.#fellBack || this.#destroyed) return;
    this.#fellBack = true;
    this.#renderer?.destroy();
    this.#renderer = null;
    const css = await selectRenderer('css');
    if (this.#destroyed) {
      css.destroy();
      return;
    }
    await css.mount(this.#container);
    this.#renderer = css;
    this.#applySinglePage(css.measure().containerWidth);
    await this.#renderCurrent();
    this.#emitter.emit('rendererFallback', { from: 'webgl2', to: 'css' });
  }

  #setupReducedMotion(): void {
    if (typeof matchMedia !== 'function') return;
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    this.#reducedMotion = query.matches;
    query.addEventListener?.('change', (e) => {
      this.#reducedMotion = e.matches;
    });
  }

  /**
   * Build the toolbar and the right-click menu, whichever are wanted, if the container is real DOM.
   *
   * The chunk is fetched lazily so a book with neither feature never downloads it. Both share the
   * one chunk, so a book with `controls: false` but `contextMenu` on still gets the right-click menu
   * without a toolbar. Failure is swallowed on purpose: controls that cannot load should cost the
   * reader the controls, not the whole flipbook — `#init` has no error handling of its own, so a
   * throw here would reject `ready`.
   */
  async #mountControls(): Promise<void> {
    const wantsToolbar = this.#controlsOption !== false;
    const wantsContextMenu = this.#contextMenuOption !== false;
    if ((!wantsToolbar && !wantsContextMenu) || this.#destroyed) return;
    const container = this.#container;
    if (!container.ownerDocument || typeof container.appendChild !== 'function') return;
    try {
      const { mountControls, mountContextMenu } = await import('./controls/controls');
      if (this.#destroyed) return; // destroyed while the chunk was in flight
      if (this.#controlsOption !== false) {
        const options = this.#controlsOption === true ? {} : this.#controlsOption;
        this.#controlsCleanup = mountControls(this, container, options, this.#hiddenControls);
      }
      if (this.#contextMenuOption !== false) {
        const options = this.#contextMenuOption === true ? {} : this.#contextMenuOption;
        this.#contextMenuCleanup = mountContextMenu(this, container, options, this.#hiddenControls);
      }
    } catch {
      // No controls; the book itself is unaffected.
    }
  }

  /** Mirror the page in the URL, and follow the URL when it changes. */
  #bindDeepLink(): void {
    if (!this.#deepLinkEnabled || typeof globalThis.location === 'undefined') return;
    const win = globalThis as unknown as Window;
    this.#deepLink = bindDeepLink(win, (page) => {
      // Only act on a hash the reader changed — following a link, or pressing Back. A hash we
      // wrote ourselves describes where the book already is.
      if (page !== this.#currentPage) this.flipTo(page);
    });
    this.#deepLink.push(this.#currentPage);
    this.#unsubscribeDeepLink = this.#emitter.on('pageChanged', ({ page }) => {
      this.#deepLink?.push(page);
    });
  }

  /** The URL that opens this book at `page` (defaults to the current one). */
  pageLink(page: number = this.#currentPage): string {
    const href = globalThis.location?.href ?? '';
    if (!href) return '';
    const url = new URL(href);
    url.hash = hashWithPage(url.hash, clamp(page, 0, Math.max(0, this.#source.pageCount - 1)));
    return url.toString();
  }

  /** Wire keyboard nav + an aria-live page announcer. Skips non-DOM containers. */
  #setupA11y(): (() => void) | null {
    const container = this.#container;
    const doc = container.ownerDocument;
    if (!doc || typeof container.setAttribute !== 'function') return null;

    if (!container.hasAttribute('tabindex')) container.tabIndex = 0;
    container.setAttribute('aria-roledescription', 'flipbook');
    const onKey = (e: KeyboardEvent): void => this.#onKeyDown(e);
    container.addEventListener('keydown', onKey);

    const live = doc.createElement('div');
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'true');
    live.style.cssText =
      'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;';
    container.appendChild(live);
    this.#liveRegion = live;

    return () => {
      container.removeEventListener('keydown', onKey);
      live.remove();
      this.#liveRegion = null;
    };
  }

  #onKeyDown(event: KeyboardEvent): void {
    const forwardKey = this.#direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowLeft':
        if (event.key === forwardKey) this.flipNext();
        else this.flipPrev();
        event.preventDefault();
        break;
      case 'Home':
        this.flipTo(0);
        event.preventDefault();
        break;
      case 'End':
        this.flipTo(this.#source.pageCount - 1);
        event.preventDefault();
        break;
      default:
        break;
    }
  }

  #announce(): void {
    if (this.#liveRegion) {
      this.#liveRegion.textContent = `Page ${this.#currentPage + 1} of ${this.#source.pageCount}`;
    }
  }

  #effectiveDuration(): number {
    // Reduced motion still turns the page, just briefly and flat (see #effectiveCurl): a page
    // that teleports gives the reader no sense of which way the book moved.
    if (this.#reducedMotion) return REDUCED_MOTION_DURATION;
    return this.#flipDuration * (this.#singlePage ? LONE_PAGE_FLIP_SCALE : 1);
  }

  /** The curl to turn with: reduced motion flattens the sheet, whatever the book asked for. */
  #effectiveCurl(): CurlSpec {
    return this.#reducedMotion ? 'simple' : this.#curl;
  }

  /** Re-measure and re-render; call after the container resizes. */
  update(): void {
    if (!this.#renderer || this.#machine.state !== 'idle') return;
    this.#applySinglePage(this.#renderer.measure().containerWidth);
    void this.#renderCurrent();
    this.#updateCursor(); // the drawn box (and its zones) may have moved under a resting pointer
  }

  /** The layout to actually use: the responsive narrow fallback forces 'single'. */
  #effectiveMode(): SpreadMode {
    return this.#narrow || this.#spreadMode === 'single' ? 'single' : this.#spreadMode;
  }

  #applySinglePage(containerWidth: number): void {
    const narrow =
      this.#responsiveSpread && shouldSinglePage(containerWidth, this.#singlePageThreshold);
    if (narrow === this.#narrow) return;
    this.#narrow = narrow;
    this.#rebuildSpreads();
  }

  /** Regroup the pages after something changes the layout, keeping the reader on the page they
   *  were looking at even though its spread index may have moved. */
  #rebuildSpreads(): void {
    const mode = this.#effectiveMode();
    const changed = mode !== this.#effectiveModeShown;
    this.#effectiveModeShown = mode;
    this.#singlePage = mode === 'single';
    this.#spreads = buildSpreads(this.#source.pageCount, { direction: this.#direction, mode });
    this.#current = this.#spreadIndexForPage(this.#currentPage);
    // The book's proportions change with the layout, so consumers sizing around it need to know.
    if (changed) this.#emitter.emit('spreadChanged', { mode, singlePage: this.#singlePage });
  }

  async #renderCurrent(): Promise<void> {
    const spread = this.#spreads[this.#current];
    if (!spread || !this.#renderer) return;
    this.#currentContent = await this.#resolveContent(spread);
    this.#paintSpread(spread, this.#currentContent);
  }

  #paintSpread(spread: Spread, content: SpreadContent): void {
    this.#renderer?.renderSpread(spread, content, { fill: this.#singlePage });
    this.#applyContainerAspect();
    // These pages were resolved at fit-to-screen; if the reader is zoomed, ask for them sharper.
    this.#zoomedAt = 1;
    this.#refreshZoomTiles();
  }

  /** Match the container's aspect-ratio to the book so it fits with no letterbox bars.
   *  Non-destructive: `aspect-ratio` only drives whichever dimension the consumer leaves
   *  auto (fit-width when they set a width), and is ignored if both are fixed. */
  #applyContainerAspect(): void {
    const b = this.#renderer?.measure().book;
    if (!b || b.width <= 0 || b.height <= 0) return;
    const ratio = b.width / b.height;
    // Tolerance, not exact equality: writing `aspect-ratio` resizes the container, whose ResizeObserver
    // re-measures a book box off by a sub-pixel and would rewrite a marginally different ratio, an
    // endless resize/measure/write feedback loop (cheap for images, but re-rasterizes a PDF each turn,
    // freezing the tab). Ignoring changes below ~0.5% lets it settle after the first write.
    if (this.#lastAspect !== null && Math.abs(ratio - this.#lastAspect) < 0.005) return;
    this.#lastAspect = ratio;
    this.#container.style.aspectRatio = ratio.toFixed(4);
  }

  /**
   * A source upgraded a page's content (e.g. a progressive PDF swapping in the crisp render).
   *
   * Repainting mid-flip would disturb the animation, so an upgrade that lands during one is
   * noted and applied on settle instead of dropped. Dropping it left the page stuck at low
   * resolution for good: the upgrade fires once, and jumping straight to a page — from a search
   * hit, the page field, the outline — is exactly when it tends to arrive.
   */
  #onPageUpdate(index: number): void {
    if (this.#machine.state !== 'idle') {
      this.#pendingUpgrades.add(index);
      return;
    }
    const spread = this.#spreads[this.#current];
    if (!spread || !(spread.left === index || spread.right === index)) return;
    // While the reader is zoomed, the upgrade touched the fit raster underneath the sharp tile, not
    // what they see. A fit #renderCurrent would flash the page soft before the tiles rebuilt; refresh
    // the tiles instead (a no-op when they are already at the viewed scale).
    if (this.#scale > 1) {
      this.#refreshZoomTiles();
      return;
    }
    void this.#renderCurrent();
  }

  /**
   * Ask the source for a crisp render of whatever is visible, and lay it over the magnified page.
   *
   * Zooming is only a view transform, so without this the reader is magnifying the pixels of a
   * raster made to fit the screen. A vector source can do better; one backed by a fixed-resolution
   * original cannot, and says so by handing back a whole page, which is dropped.
   *
   * Debounced, and hidden while the view moves. A tile is crisp for one view only, so during a
   * pan it is stale by definition; showing it anyway puts two versions of the same text on screen
   * at once. Hiding leaves the reader with the uniformly magnified page an image book already
   * shows, which is smooth because there is nothing to disagree with it. The tile returns once
   * the view settles.
   */
  /**
   * Re-rasterize the visible pages at the magnification being viewed, and hand them to the
   * renderer as ordinary page content.
   *
   * Zoom is a view transform, so the renderer magnifies a raster made to fit the screen and text
   * goes soft. Giving it a sharper raster for the same page fixes that at the root: panning stays
   * a pure view transform over crisp pixels, which is why an image book pans smoothly and why an
   * overlay painted only between gestures never could.
   *
   * Debounced, since rasterizing a PDF page is far too slow to do per frame.
   */
  #refreshZoomTiles(): void {
    if (this.#tileTimer !== null) clearTimeout(this.#tileTimer);
    const wanted = this.#upgradeScale();
    if (wanted === this.#zoomedAt) return; // already showing this resolution
    if (wanted === 1) {
      this.#tileGeneration++; // abandon anything in flight: it is no longer wanted
      this.#zoomedAt = 1;
      void this.#renderCurrent(); // back to the fit-to-screen raster
      return;
    }
    this.#tileTimer = setTimeout(() => {
      this.#tileTimer = null;
      void this.#renderZoomTiles();
    }, ZOOM_TILE_DELAY);
  }

  /**
   * How many device pixels the visible page is painted across, over how many its fit-resolution
   * raster has (the neediest page of the spread). > 1 means the raster is stretched to cover the
   * display and text is soft; < 1 means the raster already has pixels to spare (a high-res image on
   * a low-dpr screen), which must be allowed so a crispness floor doesn't wastefully re-request it.
   *
   * A single-page spread gives one page the width two shared, so a fit raster sized for the double
   * layout is stretched over ~2x the space; this is the magnification the upgrade pass must undo.
   */
  #fitFactor(): number {
    const m = this.#renderer?.measure();
    const box = m?.content ?? m?.book;
    if (!box || box.width <= 0) return 1;
    const c = this.#currentContent;
    const painted = (c.left ? 1 : 0) + (c.right ? 1 : 0);
    if (painted === 0) return 1;
    // Both halves of a spread are equal width, so the per-page painted width is the box over the
    // number of pages in it (1 for a lone page, whose `content` box is already the centered half).
    const paintedPageCss = box.width / painted;
    const dpr = typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1;
    let f = 0;
    for (const p of [c.left, c.right]) {
      if (!p || p.width <= 0) continue;
      // #renderZoomTiles swaps an upgraded (larger) raster into #currentContent and records its
      // multiplier in #zoomedAt; dividing it back out recovers the invariant fit-resolution width,
      // so a re-measure of an already-sharp page reports the same factor instead of flip-flopping
      // between fit and sharp.
      const intrinsic = p.width / this.#zoomedAt;
      f = Math.max(f, (paintedPageCss * dpr) / intrinsic);
    }
    return f === 0 ? 1 : f;
  }

  /**
   * The resolution multiplier to rasterize the visible pages at.
   *
   * Three demands compound onto the fit raster. `#fitFactor` covers a page painted larger than its
   * raster (device px). Zoom magnifies it further. And a text-crispness floor lifts the raster to
   * ~2x CSS px even when it already covers the display 1:1, because a 1:1 raster reads soft; the
   * floor is scaled by 1/dpr so a retina screen (already ~2x) is left alone and pays no memory.
   * Capped because a page costs the square of this in memory: at 4x a letter page is over 100 MB,
   * which would dwarf the source's whole cache.
   */
  #upgradeScale(): number {
    const dpr = typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1;
    const crispnessFloor = Math.max(1, TEXT_SUPERSAMPLE / dpr);
    const zoom = this.#scale <= 1 ? 1 : this.#scale;
    const raw = this.#fitFactor() * Math.max(zoom, crispnessFloor);
    if (raw <= 1 + 1e-3) return 1;
    return Math.min(Math.ceil(raw * 2) / 2, MAX_PAGE_UPGRADE);
  }

  async #renderZoomTiles(): Promise<void> {
    const spread = this.#spreads[this.#current];
    if (!this.#renderer || !spread) return;
    const scale = this.#upgradeScale();
    if (scale === 1 || scale === this.#zoomedAt) return;
    // An upgrade repaints through renderSpread, which clears the renderer's turning leaf. If a flip
    // is animating (rapid edge clicks queue a settle-time upgrade whose debounce fires mid-next-turn)
    // painting now would wipe the curl and the leaf would snap flat. Skip: the flip's own settle
    // repaints and re-requests this once the book is idle, the defer rule #onPageUpdate follows too.
    // Checked here, before the slow rasterize, so a turn in progress costs nothing.
    if (this.#machine.state !== 'idle') return;

    const generation = ++this.#tileGeneration;
    const whole = { x: 0, y: 0, width: 1, height: 1 };
    const pages = await Promise.all(
      [spread.left, spread.right].map(async (index) => {
        if (index === null) return null;
        try {
          return await this.#source.get(index, {
            scale,
            region: whole,
            maxSize: this.#renderer?.maxTextureSize,
          });
        } catch (error) {
          // An upgrade is an enhancement: the readable, softer page stays on screen.
          this.#emitter.emit('sourceError', { index, error });
          return null;
        }
      }),
    );
    // Rasterizing is slow and the reader may have moved on, zoomed elsewhere, or begun a flip while
    // it resolved (the slow-source race the entry check cannot catch). Any of those and this raster
    // is stale; drop it and let the settle re-request.
    if (
      generation !== this.#tileGeneration ||
      this.#upgradeScale() !== scale ||
      this.#machine.state !== 'idle'
    ) {
      return;
    }
    // A side whose upgrade threw comes back null; keep the readable fit raster already on screen
    // rather than blanking that half (the upgrade is an enhancement, per the get() catch above).
    const left = pages[0] ?? this.#currentContent.left;
    const right = pages[1] ?? this.#currentContent.right;
    // Nothing sharper came back: a source with a fixed-resolution original hands over the raster
    // already on screen, and repainting it would be pure churn.
    if (left === this.#currentContent.left && right === this.#currentContent.right) return;

    this.#zoomedAt = scale;
    this.#currentContent = { left, right };
    this.#renderer.renderSpread(spread, this.#currentContent, { fill: this.#singlePage });
  }

  /** Apply any upgrade that arrived mid-flip, now that the book has settled. */
  #flushPendingUpgrades(): void {
    if (this.#pendingUpgrades.size === 0) return;
    const spread = this.#spreads[this.#current];
    const onScreen =
      spread !== undefined &&
      [spread.left, spread.right].some((p) => p !== null && this.#pendingUpgrades.has(p));
    this.#pendingUpgrades.clear();
    if (!onScreen) return;
    // Same rule as #onPageUpdate: while the reader is zoomed, a fit #renderCurrent would flash the
    // page soft before the tiles rebuilt. Refresh the tiles instead. Gated on the live zoom scale,
    // not #zoomedAt: the #commit that leads here just repainted at fit and reset #zoomedAt to 1.
    if (this.#scale > 1) this.#refreshZoomTiles();
    else void this.#renderCurrent();
  }

  #observeResize(): void {
    if (typeof ResizeObserver === 'undefined') return;
    this.#resizeObserver = new ResizeObserver(() => this.#scheduleUpdate());
    this.#resizeObserver.observe(this.#container);
  }

  #scheduleUpdate(): void {
    if (this.#updateScheduled) return;
    this.#updateScheduled = true;
    requestAnimationFrame(() => {
      this.#updateScheduled = false;
      this.update();
    });
  }

  async #resolveContent(spread: Spread): Promise<SpreadContent> {
    const [left, right] = await Promise.all([this.#getPage(spread.left), this.#getPage(spread.right)]);
    return { left, right };
  }

  /** Decode one page; on failure emit `sourceError` and degrade to a blank (null) page. */
  async #getPage(index: number | null): Promise<PageContent | null> {
    if (index === null) return null;
    try {
      return await this.#source.get(index);
    } catch (error) {
      this.#emitter.emit('sourceError', { index, error });
      return null;
    }
  }

  #prefetchWindow(): void {
    const { toMount } = this.#virtualizer.update(this.#current, this.#spreads.length);
    const pages: number[] = [];
    for (const index of toMount) {
      const spread = this.#spreads[index];
      if (spread?.left != null) pages.push(spread.left);
      if (spread?.right != null) pages.push(spread.right);
    }
    this.#source.prefetch(pages);
  }

  #spreadIndexForPage(page: number): number {
    const index = this.#spreads.findIndex((s) => s.left === page || s.right === page);
    return index === -1 ? 0 : index;
  }

  /** Validate the (now-known) page count + startPage and build the spread model. */
  #buildSpreadModel(): void {
    const pageCount = this.#source.pageCount;
    if (!Number.isInteger(pageCount) || pageCount < 1) {
      throw new Error(`Zine: source has ${pageCount} pages; a Source must have at least 1 page.`);
    }
    const startPage = this.#startPageOption;
    if (
      startPage !== undefined &&
      (!Number.isInteger(startPage) || startPage < 0 || startPage >= pageCount)
    ) {
      throw new Error(
        `Zine: startPage ${JSON.stringify(startPage)} is out of range for a ${pageCount}-page book (valid 0..${pageCount - 1}).`,
      );
    }
    const mode = this.#effectiveMode();
    this.#singlePage = mode === 'single';
    this.#spreads = buildSpreads(pageCount, { direction: this.#direction, mode });
    // A page in the URL wins over `startPage`: the reader followed a link to it, which is a
    // later and more specific intent than the page the author configured.
    const linked = this.#deepLinkEnabled ? pageFromHash(globalThis.location?.hash ?? '') : null;
    this.#currentPage = clamp(linked ?? startPage ?? 0, 0, pageCount - 1);
    this.#current = this.#spreadIndexForPage(this.#currentPage);
  }
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/**
 * The translate range that keeps content within the viewport along one axis.
 *
 * `pos`/`size` are where the pages sit with no pan applied, so the view puts them at `pos + t`.
 * When they are larger than the viewport the range spans from their far edge to their near one,
 * so the reader can reach every part. When smaller there is nothing to explore, so the range
 * collapses to the single value that centres them: a lone page at 2x fills the width exactly, and
 * any freedom there would only let it drift off to one side.
 */
function axisPanRange(pos: number, size: number, viewport: number): [min: number, max: number] {
  if (size <= viewport) {
    const centered = (viewport - size) / 2 - pos;
    return [centered, centered];
  }
  return [viewport - (pos + size), -pos];
}

/** Quadratic ease-in-out. Deliberately gentler than a cubic: a cubic leaves the page nearly
 *  motionless for the first quarter of the turn and then spikes through the middle at roughly
 *  double the peak speed, which reads as a lurch rather than a sheet of paper being turned. */
function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function typeName(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

/** Validate constructor inputs up front, throwing agent-actionable errors. */
function validateOptions(container: unknown, options: unknown): void {
  if (
    typeof container !== 'object' ||
    container === null ||
    typeof (container as { appendChild?: unknown }).appendChild !== 'function' ||
    typeof (container as { addEventListener?: unknown }).addEventListener !== 'function'
  ) {
    throw new Error(`Zine: container must be a DOM element; received ${typeName(container)}.`);
  }
  if (typeof options !== 'object' || options === null) {
    throw new Error('Zine: an options object with a `source` is required.');
  }
  const o = options as Record<string, unknown>;

  const source = o.source as { get?: unknown; pageCount?: unknown } | undefined;
  if (
    typeof source !== 'object' ||
    source === null ||
    typeof source.get !== 'function' ||
    typeof source.pageCount !== 'number'
  ) {
    throw new Error('Zine: `source` is required and must be a Source, e.g. new ImageSource(urls).');
  }
  // Note: pageCount >= 1 and startPage-in-range are validated in #buildSpreadModel —
  // synchronously for a sync source, or after open() for an async one (e.g. PdfSource).

  const startPage = o.startPage;
  if (startPage !== undefined && (typeof startPage !== 'number' || !Number.isInteger(startPage) || startPage < 0)) {
    throw new Error(`Zine: startPage must be a non-negative integer; got ${JSON.stringify(startPage)}.`);
  }

  const direction = o.direction;
  if (direction !== undefined && direction !== 'ltr' && direction !== 'rtl') {
    throw new Error(`Zine: direction must be 'ltr' or 'rtl'; got ${JSON.stringify(direction)}.`);
  }

  const clickToFlip = o.clickToFlip;
  if (clickToFlip !== undefined && !['edge', 'half', 'off'].includes(clickToFlip as string)) {
    throw new Error(`Zine: clickToFlip must be 'edge', 'half', or 'off'; got ${JSON.stringify(clickToFlip)}.`);
  }

  const curl = o.curl;
  if (curl !== undefined) {
    if (typeof curl === 'object' && curl !== null) {
      // An imported or custom model. Check the one member the renderer calls every frame, so a
      // wrong shape fails here rather than as an undefined call mid-flip.
      if (typeof (curl as { deform?: unknown }).deform !== 'function') {
        throw new Error('Zine: a curl model must have a deform() function.');
      }
    } else if (IMPORTABLE_CURLS.includes(curl as string)) {
      // A real curl, just not bundled: say how to get it rather than calling it invalid.
      throw new Error(
        `Zine: the '${String(curl)}' curl is not bundled. Import it and pass the model: ` +
        `import { ${String(curl)} } from '@zinejs/core/curls'  →  curl: ${String(curl)}`,
      );
    } else if (!CURL_TYPES.includes(curl as CurlType)) {
      throw new Error(
        `Zine: curl must be ${CURL_TYPES.join(' or ')}, or a model imported from ` +
        `'@zinejs/core/curls' (${IMPORTABLE_CURLS.join(', ')}); got ${JSON.stringify(curl)}.`,
      );
    }
  }

  for (const flag of ['deepLink', 'disableContextMenu', 'responsiveSpread', 'loading'] as const) {
    if (o[flag] !== undefined && typeof o[flag] !== 'boolean') {
      throw new Error(`Zine: ${flag} must be a boolean; got ${typeName(o[flag])}.`);
    }
  }

  const controls = o.controls;
  if (controls !== undefined && typeof controls !== 'boolean' && (typeof controls !== 'object' || controls === null)) {
    throw new Error(
      `Zine: controls must be a boolean or an options object; got ${typeName(controls)}.`,
    );
  }
  const position = (controls as { position?: unknown } | undefined)?.position;
  if (position !== undefined && !['top', 'bottom', 'left', 'right'].includes(position as string)) {
    throw new Error(
      `Zine: controls.position must be 'top', 'bottom', 'left', or 'right'; got ${JSON.stringify(position)}.`,
    );
  }
  const colorScheme = (controls as { colorScheme?: unknown } | undefined)?.colorScheme;
  if (colorScheme !== undefined && !['light', 'dark', 'auto'].includes(colorScheme as string)) {
    throw new Error(
      `Zine: controls.colorScheme must be 'light', 'dark', or 'auto'; got ${JSON.stringify(colorScheme)}.`,
    );
  }
  const arrows = (controls as { arrows?: unknown } | undefined)?.arrows;
  if (arrows !== undefined && typeof arrows !== 'boolean' && !['desktop', 'mobile'].includes(arrows as string)) {
    throw new Error(
      `Zine: controls.arrows must be a boolean, 'desktop', or 'mobile'; got ${JSON.stringify(arrows)}.`,
    );
  }

  const contextMenu = o.contextMenu;
  if (contextMenu !== undefined && typeof contextMenu !== 'boolean' && (typeof contextMenu !== 'object' || contextMenu === null)) {
    throw new Error(
      `Zine: contextMenu must be a boolean or an options object; got ${typeName(contextMenu)}.`,
    );
  }
  const menuColorScheme = (contextMenu as { colorScheme?: unknown } | undefined)?.colorScheme;
  if (menuColorScheme !== undefined && !['light', 'dark', 'auto'].includes(menuColorScheme as string)) {
    throw new Error(
      `Zine: contextMenu.colorScheme must be 'light', 'dark', or 'auto'; got ${JSON.stringify(menuColorScheme)}.`,
    );
  }
  if (o.disableContextMenu === true && contextMenu !== undefined && contextMenu !== false) {
    throw new Error(
      "Zine: disableContextMenu and contextMenu are mutually exclusive — one removes the browser's " +
      'right-click menu, the other replaces it. Enable only one.',
    );
  }

  const hideControls = o.hideControls;
  if (
    hideControls !== undefined &&
    (!Array.isArray(hideControls) || hideControls.some((id) => typeof id !== 'string'))
  ) {
    throw new Error(
      `Zine: hideControls must be an array of control-id strings; got ${typeName(hideControls)}.`,
    );
  }

  const sound = o.sound;
  if (sound !== undefined && typeof sound !== 'boolean' && (typeof sound !== 'object' || sound === null)) {
    throw new Error(`Zine: sound must be a boolean or an options object; got ${typeName(sound)}.`);
  }
  if (typeof sound === 'object' && sound !== null) {
    const s = sound as { url?: unknown; volume?: unknown; muted?: unknown; persist?: unknown };
    if (s.url !== undefined && typeof s.url !== 'string') {
      throw new Error(`Zine: sound.url must be a string URL; got ${typeName(s.url)}.`);
    }
    if (s.volume !== undefined && (typeof s.volume !== 'number' || s.volume < 0 || s.volume > 1)) {
      throw new Error(`Zine: sound.volume must be a number between 0 and 1; got ${JSON.stringify(s.volume)}.`);
    }
    if (s.muted !== undefined && typeof s.muted !== 'boolean') {
      throw new Error(`Zine: sound.muted must be a boolean; got ${typeName(s.muted)}.`);
    }
    if (s.persist !== undefined && typeof s.persist !== 'boolean') {
      throw new Error(`Zine: sound.persist must be a boolean; got ${typeName(s.persist)}.`);
    }
  }

  const spreadMode = o.spreadMode;
  if (spreadMode !== undefined && !['double', 'single', 'cover', 'book'].includes(spreadMode as string)) {
    throw new Error(
      `Zine: spreadMode must be 'double', 'single', 'cover', or 'book'; got ${JSON.stringify(spreadMode)}.`,
    );
  }

  for (const key of ['frontCover', 'backCover'] as const) {
    const value = o[key];
    if (value !== undefined && typeof value !== 'string') {
      throw new Error(`Zine: ${key} must be an image URL string; got ${JSON.stringify(value)}.`);
    }
  }
  const pages = o.pages;
  if (pages !== undefined && (typeof pages !== 'object' || pages === null || Array.isArray(pages))) {
    throw new Error('Zine: pages must be an object mapping page indices to image URLs.');
  }

  assertMin(o.width, 'width', 1);
  assertMin(o.height, 'height', 1);
  assertMin(o.flipDuration, 'flipDuration', 0);
  assertMin(o.clickZoneSize, 'clickZoneSize', 0);
  assertMin(o.clickFlipDelay, 'clickFlipDelay', 0);
  assertMin(o.singlePageThreshold, 'singlePageThreshold', 0);
  validateZoomOption(o.zoom);
  validateRendererOption(o.renderer);
}

function assertMin(value: unknown, name: string, min: number): void {
  if (value === undefined) return;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min) {
    throw new Error(`Zine: ${name} must be a number >= ${min}; got ${JSON.stringify(value)}.`);
  }
}

function validateZoomOption(zoom: unknown): void {
  if (zoom === undefined) return;
  if (typeof zoom !== 'object' || zoom === null || Array.isArray(zoom)) {
    throw new Error('Zine: zoom must be an object, e.g. { max: 4 }.');
  }
  const z = zoom as Record<string, unknown>;
  if (z.enabled !== undefined && typeof z.enabled !== 'boolean') {
    throw new Error(`Zine: zoom.enabled must be a boolean; got ${JSON.stringify(z.enabled)}.`);
  }
  if (z.wheel !== undefined && typeof z.wheel !== 'boolean') {
    throw new Error(`Zine: zoom.wheel must be a boolean; got ${JSON.stringify(z.wheel)}.`);
  }
  if (z.doubleClickInFlipZone !== undefined && typeof z.doubleClickInFlipZone !== 'boolean') {
    throw new Error(
      `Zine: zoom.doubleClickInFlipZone must be a boolean; got ${JSON.stringify(z.doubleClickInFlipZone)}.`,
    );
  }
  if (z.doubleClick !== undefined && z.doubleClick !== false) {
    const levels = z.doubleClick;
    if (
      !Array.isArray(levels) ||
      levels.some((n) => typeof n !== 'number' || !Number.isFinite(n) || n < 1)
    ) {
      throw new Error(
        'Zine: zoom.doubleClick must be false or an array of zoom levels >= 1, e.g. [1, 2, 4].',
      );
    }
  }
  assertMin(z.max, 'zoom.max', 1);
}

function validateRendererOption(renderer: unknown): void {
  if (renderer === undefined) return;
  if (typeof renderer === 'string') {
    if (renderer !== 'auto' && renderer !== 'css' && renderer !== 'webgl2') {
      throw new Error(
        `Zine: renderer '${renderer}' is not recognized; use 'auto', 'css', 'webgl2', an array of those, or a custom Renderer.`,
      );
    }
    return;
  }
  if (Array.isArray(renderer)) {
    for (const kind of renderer) {
      if (kind !== 'css' && kind !== 'webgl2') {
        throw new Error(
          `Zine: renderer order array may only contain 'css' or 'webgl2'; got ${JSON.stringify(kind)}.`,
        );
      }
    }
    return;
  }
  if (
    typeof renderer === 'object' &&
    renderer !== null &&
    typeof (renderer as { mount?: unknown }).mount === 'function'
  ) {
    return;
  }
  throw new Error(
    "Zine: renderer must be 'auto', 'css', 'webgl2', an array of those, or a custom Renderer instance.",
  );
}
