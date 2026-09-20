/**
 * User-facing text for the reader UI (control labels, screen-reader announcements, panel and
 * loading text). English by default; a consumer overrides any subset via the `strings` option.
 *
 * Static entries are plain strings. Entries that mix in a number or piece of text are functions,
 * so a translation can handle pluralization and word order that a `{placeholder}` string cannot.
 * Page numbers passed to these functions are already 1-based (display) values.
 */
export interface ZineStrings {
  // Toolbar / control buttons (each is tooltip + aria-label + visible label).
  prevPage: string;
  nextPage: string;
  firstPage: string;
  lastPage: string;
  zoomIn: string;
  zoomOut: string;
  fullscreen: string;
  mute: string;
  unmute: string;
  share: string;
  downloadPdf: string;
  showOnePage: string;
  showTwoPages: string;
  print: string;
  more: string;
  controlsLabel: string;
  showThumbnails: string;
  hideThumbnails: string;
  showOutline: string;
  hideOutline: string;
  searchOpen: string;
  searchClose: string;
  pageWidgetLabel: string; // toolbar page-number widget title
  pageNumberLabel: string; // page-number input aria-label
  roledescription: string; // container aria-roledescription

  // Panels.
  thumbnailsLabel: string;
  outlineLabel: string;
  outlineLoading: string;
  outlineEmpty: string;
  untitled: string; // outline entry with no title
  searchResultsLabel: string;
  searchPlaceholder: string;
  searchInputLabel: string;
  searching: string;

  // Loading overlay.
  loadingOpening: string;
  loadingPreparing: string;

  // Share dialog.
  shareFallbackTitle: string; // used when the document has no title
  close: string;
  copy: string;
  copied: string;
  copyManual: string;
  qrLabel: string;
  linkLabel: string;
  email: string; // social label (brand names are not translated)

  // Hints (visual captions).
  panHint: string;

  // Dynamic (interpolated / pluralizable) entries.
  pageAnnounce: (current: number, total: number) => string;
  pageTotal: (total: number) => string;
  downloadingPercent: (percent: number) => string;
  downloadingSize: (megabytes: number) => string;
  zoomHint: (opts: { doubleClick: boolean; wheel: boolean; mac: boolean }) => string;
  noMatches: (query: string) => string;
  searchHitLabel: (page: number) => string;
  searchHitAria: (page: number, excerpt: string) => string;
  shareOn: (network: string) => string;
  thumbnailAria: (pageLabels: string[]) => string;
  outlineEntryAria: (title: string, page: number) => string;
}

/** Built-in English text. Overridden per key by the `strings` option. */
export const defaultStrings: ZineStrings = {
  prevPage: 'Previous page',
  nextPage: 'Next page',
  firstPage: 'First page',
  lastPage: 'Last page',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  fullscreen: 'Fullscreen',
  mute: 'Mute page sound',
  unmute: 'Unmute page sound',
  share: 'Share',
  downloadPdf: 'Download PDF',
  showOnePage: 'Show one page',
  showTwoPages: 'Show two pages',
  print: 'Print',
  more: 'More',
  controlsLabel: 'Flipbook controls',
  showThumbnails: 'Show thumbnails',
  hideThumbnails: 'Hide thumbnails',
  showOutline: 'Show outline',
  hideOutline: 'Hide outline',
  searchOpen: 'Search',
  searchClose: 'Hide search',
  pageWidgetLabel: 'Page',
  pageNumberLabel: 'Page number',
  roledescription: 'flipbook',

  thumbnailsLabel: 'Pages',
  outlineLabel: 'Outline',
  outlineLoading: 'Loading…',
  outlineEmpty: 'This document has no outline.',
  untitled: 'Untitled',
  searchResultsLabel: 'Search results',
  searchPlaceholder: 'Search…',
  searchInputLabel: 'Search the document',
  searching: 'Searching…',

  loadingOpening: 'Opening document…',
  loadingPreparing: 'Preparing pages…',

  shareFallbackTitle: 'Flipbook',
  close: 'Close',
  copy: 'Copy',
  copied: 'Copied',
  copyManual: 'Press Ctrl+C',
  qrLabel: 'QR code for this page',
  linkLabel: 'Link to this page',
  email: 'Email',

  panHint: 'Drag to move',

  pageAnnounce: (current, total) => `Page ${current} of ${total}`,
  pageTotal: (total) => `/ ${total}`,
  downloadingPercent: (percent) => `Downloading document… ${percent}%`,
  downloadingSize: (megabytes) => `Downloading document… ${megabytes.toFixed(1)} MB`,
  zoomHint: ({ doubleClick, wheel, mac }) => {
    const parts: string[] = [];
    if (doubleClick) parts.push('Double-click');
    if (wheel) parts.push(`${mac ? '⌘' : 'Ctrl'}-scroll`);
    return `${parts.join(' or ')} to zoom`;
  },
  noMatches: (query) => `No matches for “${query}”`,
  searchHitLabel: (page) => `Page ${page}`,
  searchHitAria: (page, excerpt) => `Page ${page}: ${excerpt}`,
  shareOn: (network) => `Share on ${network}`,
  thumbnailAria: (labels) =>
    labels.length > 1 ? `Pages ${labels[0]}–${labels.at(-1)}` : `Page ${labels[0] ?? ''}`,
  outlineEntryAria: (title, page) => `${title}, page ${page}`,
};

/** Merge consumer overrides over the English defaults. A missing key keeps the default. */
export function resolveStrings(overrides?: Partial<ZineStrings>): ZineStrings {
  return overrides ? { ...defaultStrings, ...overrides } : defaultStrings;
}
