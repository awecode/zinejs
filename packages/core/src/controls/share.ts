import { createIcon, ICONS } from './icons';
import { SOCIALS } from './socials';
import { qrSvg } from './qr';
import type { Zine } from '../zine';

/** QR edge length in CSS px. */
const QR_SIZE = 132;
/** How long the copy button confirms for. */
const COPIED_MS = 1600;

/**
 * The share dialog: a QR code, the link, a copy button and the usual social destinations.
 *
 * Loaded on demand — the whole module, its icons and the QR encoder arrive only when a reader
 * presses Share, so a book nobody shares pays nothing for it.
 */
export class ShareDialog {
  #doc: Document;
  #backdrop: HTMLElement;
  #dialog: HTMLElement;
  #lastFocus: Element | null;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #onKey: (e: KeyboardEvent) => void;

  constructor(zine: Zine, container: HTMLElement) {
    const doc = container.ownerDocument!;
    this.#doc = doc;
    this.#lastFocus = doc.activeElement;

    const url = zine.pageLink();
    const title = doc.title || 'Flipbook';

    this.#backdrop = doc.createElement('div');
    this.#backdrop.className = 'zine-share-backdrop';
    this.#backdrop.addEventListener('pointerdown', (e) => {
      if (e.target === this.#backdrop) this.close();
    });

    this.#dialog = doc.createElement('div');
    this.#dialog.className = 'zine-share';
    this.#dialog.setAttribute('role', 'dialog');
    this.#dialog.setAttribute('aria-modal', 'true');
    this.#dialog.setAttribute('aria-label', 'Share');
    this.#backdrop.appendChild(this.#dialog);

    const head = doc.createElement('div');
    head.className = 'zine-share-head';
    const heading = doc.createElement('strong');
    heading.textContent = 'Share';
    const close = doc.createElement('button');
    close.type = 'button';
    close.className = 'zine-share-close';
    close.setAttribute('aria-label', 'Close');
    close.appendChild(createIcon(doc, ICONS.close));
    close.addEventListener('click', () => this.close());
    head.append(heading, close);

    this.#dialog.append(head, this.#linkRow(doc, url), this.#socialRow(doc, url, title));
    const qr = this.#qr(doc, url);
    if (qr) this.#dialog.insertBefore(qr, this.#dialog.children[1]!);

    container.ownerDocument.body.appendChild(this.#backdrop);

    this.#onKey = (e): void => {
      if (e.key === 'Escape') this.close();
      if (e.key === 'Tab') this.#trapFocus(e);
    };
    this.#backdrop.addEventListener('keydown', this.#onKey);
    close.focus();
  }

  /** The QR, or nothing if the URL is too long to encode — better no code than a broken one. */
  #qr(doc: Document, url: string): HTMLElement | null {
    if (!url) return null;
    try {
      const wrap = doc.createElement('div');
      wrap.className = 'zine-share-qr';
      wrap.innerHTML = qrSvg(url, QR_SIZE);
      wrap.setAttribute('aria-label', 'QR code for this page');
      wrap.setAttribute('role', 'img');
      return wrap;
    } catch {
      return null;
    }
  }

  #linkRow(doc: Document, url: string): HTMLElement {
    const row = doc.createElement('div');
    row.className = 'zine-share-link';
    const input = doc.createElement('input');
    input.type = 'text';
    input.readOnly = true;
    input.value = url;
    input.setAttribute('aria-label', 'Link to this page');
    input.addEventListener('focus', () => input.select());

    const copy = doc.createElement('button');
    copy.type = 'button';
    copy.className = 'zine-share-copy';
    copy.textContent = 'Copy';
    copy.addEventListener('click', () => {
      void this.#copy(url, copy);
    });
    row.append(input, copy);
    return row;
  }

  async #copy(url: string, button: HTMLButtonElement): Promise<void> {
    try {
      await navigator.clipboard?.writeText(url);
      button.textContent = 'Copied';
    } catch {
      button.textContent = 'Press Ctrl+C';
    }
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      button.textContent = 'Copy';
    }, COPIED_MS);
  }

  #socialRow(doc: Document, url: string, title: string): HTMLElement {
    const row = doc.createElement('div');
    row.className = 'zine-share-socials';
    for (const social of SOCIALS) {
      const link = doc.createElement('a');
      link.className = 'zine-share-social';
      link.href = social.href(url, title);
      link.title = social.label;
      link.setAttribute('aria-label', `Share on ${social.label}`);
      if (social.id !== 'email') {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
      link.appendChild(createIcon(doc, social.icon));
      row.appendChild(link);
    }
    return row;
  }

  /** Keep Tab inside the dialog while it is open. */
  #trapFocus(event: KeyboardEvent): void {
    const focusable = [
      ...this.#dialog.querySelectorAll<HTMLElement>('button, a[href], input'),
    ].filter((el) => !el.hasAttribute('disabled'));
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable.at(-1)!;
    const active = this.#doc.activeElement;
    if (event.shiftKey && active === first) {
      last.focus();
      event.preventDefault();
    } else if (!event.shiftKey && active === last) {
      first.focus();
      event.preventDefault();
    }
  }

  close(): void {
    this.destroy();
  }

  destroy(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    this.#backdrop.removeEventListener('keydown', this.#onKey);
    this.#backdrop.remove();
    // Hand focus back to whatever opened the dialog.
    (this.#lastFocus as HTMLElement | null)?.focus?.();
  }
}
