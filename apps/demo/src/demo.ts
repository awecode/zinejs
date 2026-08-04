import './demo.css';
import { Zine, ImageSource, CURL_TYPES, type CurlType, type Source } from '@zinejs/core';
import { PdfSource } from '@zinejs/pdf';

// One harness drives all four demo pages; the kind + renderer come from the URL path.
type Kind = 'image' | 'pdf';
type RendererKind = 'webgl2' | 'css';

const DEMOS: { path: string; kind: Kind; renderer: RendererKind; label: string }[] = [
  { path: '/image-webgl.html', kind: 'image', renderer: 'webgl2', label: 'ImageBook · WebGL2' },
  { path: '/pdf-webgl.html', kind: 'pdf', renderer: 'webgl2', label: 'PDF · WebGL2' },
  { path: '/image-css.html', kind: 'image', renderer: 'css', label: 'ImageBook · CSS' },
  { path: '/pdf-css.html', kind: 'pdf', renderer: 'css', label: 'PDF · CSS' },
];

const current = DEMOS.find((d) => location.pathname.endsWith(d.path)) ?? DEMOS[0]!;
const { kind, renderer } = current;

// Reactive options live in the URL query string: changing one reloads with a fresh Zine
// (robust — no in-place teardown), while the shareable URL captures the exact config.
const q = new URLSearchParams(location.search);
const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d);
const opt = {
  spreadMode: (q.get('spreadMode') ?? 'cover') as 'double' | 'single' | 'cover' | 'book',
  curl: (q.get('curl') ?? (renderer === 'webgl2' ? 'cone' : 'roll')) as CurlType,
  direction: (q.get('direction') ?? 'ltr') as 'ltr' | 'rtl',
  clickToFlip: (q.get('clickToFlip') ?? 'edge') as 'edge' | 'half' | 'off',
  flipDuration: num('flipDuration', 800),
  zoomMax: num('zoom', 4),
  singlePageThreshold: num('spt', 640),
};

const imageUrls = Array.from(
  { length: 20 },
  (_, i) => `sample-images/page-${String(i + 1).padStart(2, '0')}.png`,
);
const makeSource = (): Source =>
  kind === 'pdf' ? new PdfSource('pdf/sample.pdf', { progressive: true }) : new ImageSource(imageUrls);

function applyOption(param: string, value: string | number): void {
  const url = new URL(location.href);
  url.searchParams.set(param, String(value));
  location.assign(url); // reload with the new option — a clean, fresh Zine
}

// ---- DOM scaffold ------------------------------------------------------------
const app = document.getElementById('app')!;
app.innerHTML = `
  <div class="wrap">
    <header>
      <h1>zinejs demo — ${current.label}</h1>
      <div class="sub">${kind === 'pdf' ? 'PDF source (pdf.js)' : 'Image source'}, forced <code>renderer: '${renderer}'</code>${renderer === 'webgl2' ? ` · curl <code>${opt.curl}</code> (try <code>cone</code> for the natural paper turn)` : ''}. Options are reactive (they reload with a fresh book).</div>
      <nav>${DEMOS.map((d) => `<a href="${d.path}" class="${d === current ? 'active' : ''}">${d.label}</a>`).join('')}</nav>
    </header>
    <div class="controls" id="controls"></div>
    <div id="book"></div>
    <footer>
      <div class="status" id="status">loading…</div>
      <div class="debug" id="debug"></div>
    </footer>
  </div>
`;
const book = document.getElementById('book')!;
const controlsEl = document.getElementById('controls')!;
const statusEl = document.getElementById('status')!;
const debugEl = document.getElementById('debug')!;

// The library sets the container's aspect-ratio to the book once pages load. We only hint
// the sample aspect here so the CSS can cap the width to keep the height on-screen.
const sampleAspect = (opt.spreadMode === 'single' ? 1 : 2) * (kind === 'pdf' ? 612 / 792 : 1200 / 1548);
book.style.setProperty('--book-ar', String(sampleAspect));

// ---- Controls ----------------------------------------------------------------
function selectControl<T extends string>(
  label: string,
  param: string,
  options: readonly T[],
  value: T,
): HTMLElement {
  const wrap = document.createElement('label');
  wrap.className = 'control';
  wrap.innerHTML = `<span>${label}</span>`;
  const sel = document.createElement('select');
  for (const o of options) {
    const el = document.createElement('option');
    el.value = o;
    el.textContent = o;
    if (o === value) el.selected = true;
    sel.appendChild(el);
  }
  sel.addEventListener('change', () => applyOption(param, sel.value));
  wrap.appendChild(sel);
  return wrap;
}

function rangeControl(
  label: string,
  param: string,
  min: number,
  max: number,
  step: number,
  value: number,
  unit: string,
): HTMLElement {
  const wrap = document.createElement('label');
  wrap.className = 'control';
  const head = document.createElement('span');
  head.innerHTML = `${label} <span class="val">${value}${unit}</span>`;
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.addEventListener('input', () => {
    head.querySelector('.val')!.textContent = `${input.value}${unit}`;
  });
  input.addEventListener('change', () => applyOption(param, Number(input.value)));
  wrap.append(head, input);
  return wrap;
}

function button(text: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}

controlsEl.append(
  selectControl('spreadMode', 'spreadMode', ['double', 'single', 'cover', 'book'] as const, opt.spreadMode),
);
if (renderer === 'webgl2') {
  controlsEl.append(selectControl('curl', 'curl', CURL_TYPES, opt.curl));
}
controlsEl.append(
  selectControl('direction', 'direction', ['ltr', 'rtl'] as const, opt.direction),
  selectControl('clickToFlip', 'clickToFlip', ['edge', 'half', 'off'] as const, opt.clickToFlip),
  rangeControl('flipDuration', 'flipDuration', 0, 2000, 50, opt.flipDuration, 'ms'),
  rangeControl('zoom max', 'zoom', 1, 8, 0.5, opt.zoomMax, '×'),
  rangeControl('singlePageThreshold', 'spt', 0, 1200, 20, opt.singlePageThreshold, 'px'),
);

const actions = document.createElement('div');
actions.className = 'control';
actions.innerHTML = '<span>controls</span>';
const row = document.createElement('div');
row.className = 'actions';
row.append(
  button('‹ Prev', () => zine.flipPrev()),
  button('Next ›', () => zine.flipNext()),
  button('Zoom 2×', () => zine.setZoom(2)),
  button('Reset zoom', () => zine.resetZoom()),
);
actions.appendChild(row);
controlsEl.appendChild(actions);

// ---- Mount (once) ------------------------------------------------------------
let activeRenderer = renderer as string;
let rendererError: string | null = null;

const zine = new Zine(book, {
  source: makeSource(),
  renderer,
  spreadMode: opt.spreadMode,
  ...(renderer === 'webgl2' ? { curl: opt.curl } : {}),
  direction: opt.direction,
  clickToFlip: opt.clickToFlip,
  flipDuration: opt.flipDuration,
  singlePageThreshold: opt.singlePageThreshold,
  zoom: { max: opt.zoomMax },
});

zine.on('pageChanged', updateStatus);
zine.on('zoomChanged', updateStatus);
zine.on('rendererFallback', (e) => {
  activeRenderer = e.to;
  updateDebug();
});
zine.ready
  .then(() => {
    updateStatus();
    updateDebug();
  })
  .catch((err: unknown) => {
    rendererError = err instanceof Error ? err.message : String(err);
    statusEl.textContent = 'renderer unavailable — see debug below';
    updateDebug();
  });

// ---- Status + renderer debug -------------------------------------------------
function updateStatus(): void {
  statusEl.textContent = `page ${zine.getPage() + 1} / ${zine.getPageCount()}  ·  zoom ${zine.getZoom().toFixed(2)}×`;
}

function probeWebgl2(): { supported: boolean; gpu: string } {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return { supported: false, gpu: '—' };
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : 'hidden by browser';
    return { supported: true, gpu };
  } catch {
    return { supported: false, gpu: '—' };
  }
}

const probe = probeWebgl2();

function updateDebug(): void {
  const supportCls = probe.supported ? 'ok' : 'bad';
  const supportTxt = probe.supported ? 'available ✓' : 'unavailable ✗';
  const auto = probe.supported ? 'webgl2' : 'css';
  const activeCls = rendererError ? 'bad' : 'ok';
  const activeTxt = rendererError ? `failed — ${rendererError}` : activeRenderer;
  debugEl.innerHTML = [
    `<span class="k">WebGL2 support   :</span> <span class="${supportCls}">${supportTxt}</span>`,
    `<span class="k">GPU              :</span> ${probe.gpu}`,
    `<span class="k">'auto' would pick:</span> ${auto}`,
    `<span class="k">this demo forces :</span> ${renderer}`,
    `<span class="k">active renderer  :</span> <span class="${activeCls}">${activeTxt}</span>`,
  ].join('\n');
}

updateDebug();
