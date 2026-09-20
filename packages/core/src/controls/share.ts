import { createIcon, ICONS } from './icons';
import { SOCIALS } from './socials';
import { qrSvg } from './qr';
import { applyColorScheme } from './styles';
import type { ControlsColorScheme } from './types';
import type { Zine } from '../zine';
import type { ZineStrings } from '../strings';

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
  #strings: ZineStrings;

  constructor(zine: Zine, container: HTMLElement, colorScheme: ControlsColorScheme = 'auto') {
    const doc = container.ownerDocument!;
    this.#doc = doc;
    this.#lastFocus = doc.activeElement;
    this.#strings = zine.strings;

    const url = zine.pageLink();
    const title = doc.title || this.#strings.shareFallbackTitle;

    this.#backdrop = doc.createElement('div');
    this.#backdrop.className = 'zine-share-backdrop';
    // The dialog is mounted on <body>, outside the toolbar, so it does not inherit the stamp;
    // apply it here. color-scheme then inherits down to the dialog and its fields.
    applyColorScheme(this.#backdrop, colorScheme);
    this.#backdrop.addEventListener('pointerdown', (e) => {
      if (e.target === this.#backdrop) this.close();
    });

    this.#dialog = doc.createElement('div');
    this.#dialog.className = 'zine-share';
    this.#dialog.setAttribute('role', 'dialog');
    this.#dialog.setAttribute('aria-modal', 'true');
    this.#dialog.setAttribute('aria-label', this.#strings.share);
    this.#backdrop.appendChild(this.#dialog);

    const head = doc.createElement('div');
    head.className = 'zine-share-head';
    const heading = doc.createElement('strong');
    heading.textContent = this.#strings.share;
    const close = doc.createElement('button');
    close.type = 'button';
    close.className = 'zine-share-close';
    close.setAttribute('aria-label', this.#strings.close);
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
      wrap.setAttribute('aria-label', this.#strings.qrLabel);
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
    input.setAttribute('aria-label', this.#strings.linkLabel);
    input.addEventListener('focus', () => input.select());

    const copy = doc.createElement('button');
    copy.type = 'button';
    copy.className = 'zine-share-copy';
    copy.textContent = this.#strings.copy;
    copy.addEventListener('click', () => {
      void this.#copy(url, copy);
    });
    row.append(input, copy);
    return row;
  }

  async #copy(url: string, button: HTMLButtonElement): Promise<void> {
    try {
      await navigator.clipboard?.writeText(url);
      button.textContent = this.#strings.copied;
    } catch {
      button.textContent = this.#strings.copyManual;
    }
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      button.textContent = this.#strings.copy;
    }, COPIED_MS);
  }

  #socialRow(doc: Document, url: string, title: string): HTMLElement {
    const row = doc.createElement('div');
    row.className = 'zine-share-socials';
    for (const social of SOCIALS) {
      const link = doc.createElement('a');
      link.className = 'zine-share-social';
      link.href = social.href(url, title);
      // Brand names stay as-is; "Email" is the one social label that translates.
      const label = social.id === 'email' ? this.#strings.email : social.label;
      link.title = label;
      link.setAttribute('aria-label', this.#strings.shareOn(label));
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
