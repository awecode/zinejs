/**
 * Toolbar glyphs, inlined so the bundle carries no icon-font or sprite dependency.
 *
 * Paths are from Lucide (https://lucide.dev), ISC licensed:
 *   Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather
 *   (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
 *
 * Each value is the inner markup of a 24x24 `viewBox` drawn with `stroke="currentColor"`,
 * `fill="none"` and round caps/joins — {@link createIcon} supplies those, so the strings stay to
 * the geometry.
 */
export const ICONS: Record<string, string> = {
  /** chevron-left */
  prev: '<path d="m15 18-6-6 6-6"/>',
  /** chevron-right */
  next: '<path d="m9 18 6-6-6-6"/>',
  /** chevrons-left */
  first: '<path d="m11 17-5-5 5-5"/><path d="m18 17-5-5 5-5"/>',
  /** chevrons-right */
  last: '<path d="m6 17 5-5-5-5"/><path d="m13 17 5-5-5-5"/>',
  /** zoom-in */
  zoomIn:
    '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6"/><path d="M8 11h6"/>',
  /** zoom-out */
  zoomOut: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M8 11h6"/>',
  /** search */
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  /** share-2 */
  share:
    '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/>',
  /** ellipsis-vertical */
  menu: '<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>',
  /** maximize */
  fullscreen:
    '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
  /** minimize */
  exitFullscreen:
    '<path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>',
  /** gallery-vertical-end */
  thumbnails:
    '<path d="M7 2h10"/><path d="M5 6h14"/><rect width="18" height="12" x="3" y="10" rx="2"/>',
  /** list-tree */
  outline:
    '<path d="M21 12h-8"/><path d="M21 6h-8"/><path d="M21 18h-8"/><path d="M3 6v4c0 1.1.9 2 2 2h3"/><path d="M3 10v6c0 1.1.9 2 2 2h3"/>',
  /** printer */
  print:
    '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14" rx="1"/>',
  /** download */
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
  /** x */
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
};

/** Build an `<svg>` for one of the {@link ICONS}, or null if the name is unknown. */
export function createIcon(doc: Document, markup: string): SVGSVGElement {
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  // Slightly under Lucide's default 2: at the toolbar's icon size a full-weight stroke reads
  // heavy and closes up the tighter shapes.
  svg.setAttribute('stroke-width', '1.75');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  // Icon markup is library-authored, never consumer input.
  svg.innerHTML = markup;
  return svg;
}
