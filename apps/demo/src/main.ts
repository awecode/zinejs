import { Zine, ImageSource } from '@zinejs/core';

const TOTAL = 8;

/** Draw a procedural page as a data URL — no external assets needed. */
function makePage(n: number): string {
  const w = 800;
  const h = 1000;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');

  const hue = Math.round((n / TOTAL) * 360);
  ctx.fillStyle = `hsl(${hue} 45% 92%)`;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = `hsl(${hue} 40% 70%)`;
  ctx.lineWidth = 8;
  ctx.strokeRect(20, 20, w - 40, h - 40);

  ctx.fillStyle = `hsl(${hue} 55% 30%)`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 220px system-ui, sans-serif';
  ctx.fillText(String(n + 1), w / 2, h / 2);
  ctx.font = '32px system-ui, sans-serif';
  ctx.fillText('zinejs demo', w / 2, h / 2 + 170);

  return canvas.toDataURL('image/png');
}

const pages = Array.from({ length: TOTAL }, (_, i) => makePage(i));
const container = document.getElementById('book');
if (!container) throw new Error('#book not found');

const zine = new Zine(container, { source: new ImageSource(pages) });

const label = document.getElementById('page');
function updateLabel(): void {
  if (label) label.textContent = `page ${zine.getPage() + 1} / ${zine.getPageCount()}`;
}
zine.on('ready', updateLabel);
zine.on('pageChanged', updateLabel);

document.getElementById('next')?.addEventListener('click', () => zine.flipNext());
document.getElementById('prev')?.addEventListener('click', () => zine.flipPrev());
