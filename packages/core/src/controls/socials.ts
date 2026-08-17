/**
 * Where a reader can send a link, and how each service wants it.
 *
 * These are plain share-intent URLs — no SDKs, no third-party scripts, nothing that could track
 * the reader before they choose to share. Each brand mark is drawn from its own official glyph;
 * they are filled shapes rather than the stroked outlines used elsewhere in the toolbar, so they
 * carry `fill="currentColor"` and no stroke.
 */
export interface Social {
  id: string;
  label: string;
  /** Inner SVG markup for a 24x24 viewBox, filled rather than stroked. */
  icon: string;
  href(url: string, title: string): string;
}

const e = encodeURIComponent;

export const SOCIALS: readonly Social[] = [
  {
    id: 'facebook',
    label: 'Facebook',
    icon: '<path fill="currentColor" stroke="none" d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.45 2.89h-2.33v6.99A10 10 0 0 0 22 12Z"/>',
    href: (url) => `https://www.facebook.com/sharer/sharer.php?u=${e(url)}`,
  },
  {
    id: 'x',
    label: 'X (Twitter)',
    icon: '<path fill="currentColor" stroke="none" d="M17.53 3h3.06l-6.69 7.64L21.75 21h-6.16l-4.82-6.3L5.24 21H2.18l7.15-8.17L2.25 3h6.32l4.36 5.77L17.53 3Zm-1.07 16.17h1.69L7.62 4.73H5.8l10.66 14.44Z"/>',
    href: (url, title) => `https://twitter.com/intent/tweet?url=${e(url)}&text=${e(title)}`,
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    icon: '<path fill="currentColor" stroke="none" d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05a3.74 3.74 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13Zm1.78 13.02H3.55V9h3.57v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0Z"/>',
    href: (url) => `https://www.linkedin.com/sharing/share-offsite/?url=${e(url)}`,
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: '<path fill="currentColor" stroke="none" d="M12.04 2a9.9 9.9 0 0 0-8.5 14.9L2 22l5.25-1.38A9.9 9.9 0 1 0 12.04 2Zm5.8 14.06c-.25.7-1.44 1.33-1.99 1.38-.53.05-1.02.24-3.44-.72-2.9-1.14-4.73-4.1-4.87-4.29-.14-.19-1.16-1.54-1.16-2.94s.73-2.08 1-2.37c.26-.28.57-.35.76-.35h.55c.17 0 .42-.07.65.5.24.58.8 2 .87 2.14.07.14.12.31.02.5-.09.19-.14.3-.28.47l-.42.48c-.14.14-.28.29-.12.57.16.28.7 1.16 1.51 1.88 1.04.93 1.91 1.21 2.19 1.35.28.15.44.12.6-.07.17-.19.7-.81.88-1.09.19-.28.37-.23.63-.14.25.1 1.63.77 1.9.91.29.14.48.21.55.33.07.11.07.67-.18 1.37Z"/>',
    href: (url, title) => `https://api.whatsapp.com/send?text=${e(`${title} ${url}`)}`,
  },
  {
    id: 'pinterest',
    label: 'Pinterest',
    icon: '<path fill="currentColor" stroke="none" d="M12 2a10 10 0 0 0-3.65 19.31c-.09-.78-.17-1.98.03-2.83.19-.78 1.2-4.98 1.2-4.98s-.3-.61-.3-1.52c0-1.42.82-2.48 1.85-2.48.87 0 1.3.66 1.3 1.44 0 .88-.56 2.2-.85 3.42-.24 1.02.51 1.86 1.52 1.86 1.83 0 3.23-1.93 3.23-4.7 0-2.46-1.77-4.18-4.29-4.18-2.92 0-4.64 2.19-4.64 4.46 0 .88.34 1.83.76 2.35a.3.3 0 0 1 .07.29l-.28 1.16c-.05.19-.15.23-.34.14-1.28-.6-2.08-2.47-2.08-3.98 0-3.24 2.35-6.21 6.79-6.21 3.56 0 6.33 2.54 6.33 5.93 0 3.54-2.23 6.39-5.32 6.39-1.04 0-2.02-.54-2.35-1.18l-.64 2.44c-.23.89-.86 2.01-1.28 2.69A10 10 0 1 0 12 2Z"/>',
    href: (url, title) => `https://pinterest.com/pin/create/button/?url=${e(url)}&description=${e(title)}`,
  },
  {
    id: 'email',
    label: 'Email',
    icon: '<path fill="currentColor" stroke="none" d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 4.24-7.47 4.67a1 1 0 0 1-1.06 0L4 8.24V6.4l8 5 8-5v1.84Z"/>',
    href: (url, title) => `mailto:?subject=${e(title)}&body=${e(url)}`,
  },
];
