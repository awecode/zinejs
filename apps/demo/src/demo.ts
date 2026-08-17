import './theme.css';
import './demo.css';
import { createThemeToggle, initTheme } from './theme';
import { Zine, ImageSource, CURL_TYPES, IMPORTABLE_CURLS, type CurlSpec, type Source } from '@zinejs/core';
// The demo offers every curl, so it imports the four that are not bundled. A real book names
// the one it wants and carries only that.
import { roll, leaf, flick, silk } from '@zinejs/core/curls';
import { PdfSource } from '@zinejs/pdf';
import { installClickDebug } from './clickDebug';

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

initTheme();

// Reactive options live in the URL query string: changing one reloads with a fresh Zine
// (robust — no in-place teardown), while the shareable URL captures the exact config.
const q = new URLSearchParams(location.search);
const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d);
const opt = {
  spreadMode: (q.get('spreadMode') ?? 'cover') as 'double' | 'single' | 'cover' | 'book',
  curl: q.get('curl') ?? (renderer === 'webgl2' ? 'cone' : 'roll'),
  direction: (q.get('direction') ?? 'ltr') as 'ltr' | 'rtl',
  clickToFlip: (q.get('clickToFlip') ?? 'edge') as 'edge' | 'half' | 'off',
  flipDuration: num('flipDuration', 800),
  zoomMax: num('zoom', 4),
  singlePageThreshold: num('spt', 640),
  controls: (q.get('controls') ?? 'bottom') as 'bottom' | 'top' | 'left' | 'right' | 'off',
  controlsDock: (q.get('dock') ?? 'docked') as 'docked' | 'floating',
};

// Bundled names first, then the importable ones, so the dropdown reads in that order.
const ALL_CURLS = [...CURL_TYPES, ...IMPORTABLE_CURLS];
const IMPORTED: Record<string, CurlSpec> = { roll, leaf, flick, silk };
/** A bundled curl passes through as its name; the rest resolve to the model we imported. */
const curlSpec = (name: string): CurlSpec => IMPORTED[name] ?? (name as CurlSpec);

const imageUrls = Array.from(
  { length: 20 },
  (_, i) => `sample-images/page-${String(i + 1).padStart(2, '0')}.png`,
);
// `?src=` overrides the PDF URL for ad-hoc perf testing — pass any URL, e.g. a large e-paper:
// ?src=https://media.xyz.com/issues/epapers/1084.pdf.
const pdfSrc = q.get('src') ?? 'pdf/sample.pdf';
const makeSource = (): Source =>
  kind === 'pdf' ? new PdfSource(pdfSrc, { progressive: true }) : new ImageSource(imageUrls);

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
      <div class="header-row">
        <div>
          <h1>zinejs demo — ${current.label}</h1>
          <div class="sub">${kind === 'pdf' ? 'PDF source (pdf.js)' : 'Image source'}, forced <code>renderer: '${renderer}'</code>${renderer === 'webgl2' ? ` · curl <code>${opt.curl}</code>` : ''}. Options are reactive (they reload with a fresh book).</div>
        </div>
      </div>
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
app.querySelector('.header-row')!.appendChild(createThemeToggle());
const book = document.getElementById('book')!;
const controlsEl = document.getElementById('controls')!;
const statusEl = document.getElementById('status')!;
const debugEl = document.getElementById('debug')!;

// The library sets the container's aspect-ratio to the book once pages load. We only hint the
// sample aspect here so the CSS can cap the width to keep the height on-screen. It has to follow
// the layout: the cap is what stops a one-page book, twice as tall, running off the screen.
const pageAspect = kind === 'pdf' ? 612 / 792 : 1200 / 1548;
const hintAspect = (single: boolean): void => {
  book.style.setProperty('--book-ar', String((single ? 1 : 2) * pageAspect));
};
hintAspect(opt.spreadMode === 'single');

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
  controlsEl.append(selectControl('curl', 'curl', ALL_CURLS, opt.curl));
}
controlsEl.append(
  selectControl('direction', 'direction', ['ltr', 'rtl'] as const, opt.direction),
  selectControl('clickToFlip', 'clickToFlip', ['edge', 'half', 'off'] as const, opt.clickToFlip),
  selectControl('controls', 'controls', ['bottom', 'top', 'left', 'right', 'off'] as const, opt.controls),
  selectControl('controls dock', 'dock', ['docked', 'floating'] as const, opt.controlsDock),
  rangeControl('flipDuration', 'flipDuration', 0, 2000, 50, opt.flipDuration, 'ms'),
  rangeControl('zoom max', 'zoom', 1, 8, 0.5, opt.zoomMax, '×'),
  rangeControl('singlePageThreshold', 'spt', 0, 1200, 20, opt.singlePageThreshold, 'px'),
);

// Paging and zoom now come from the built-in toolbar over the book, so the demo only keeps the
// actions that toolbar has no equivalent for.
const actions = document.createElement('div');
actions.className = 'control';
actions.innerHTML = '<span>controls</span>';
const row = document.createElement('div');
row.className = 'actions';
row.append(
  button('Zoom 2×', () => zine.setZoom(2)),
  button('Reset zoom', () => zine.resetZoom()),
);
actions.appendChild(row);
controlsEl.appendChild(actions);

// ---- Mount (once) ------------------------------------------------------------
let activeRenderer = renderer as string;
let rendererError: string | null = null;
const sourceErrors: string[] = [];
let rasterProbe = '';

const zine = new Zine(book, {
  source: makeSource(),
  renderer,
  spreadMode: opt.spreadMode,
  ...(renderer === 'webgl2' ? { curl: curlSpec(opt.curl) } : {}),
  direction: opt.direction,
  clickToFlip: opt.clickToFlip,
  flipDuration: opt.flipDuration,
  singlePageThreshold: opt.singlePageThreshold,
  zoom: { max: opt.zoomMax },
  controls:
    opt.controls === 'off'
      ? false
      : {
        position: opt.controls,
        docked: opt.controlsDock === 'docked',
        // ?items=ends puts first/last on the bar itself, to see how a control that comes and
        // goes behaves out there rather than tucked in the ⋮ menu.
        ...(q.get('items') === 'ends'
          ? {
            items: [
              'first',
              'prev',
              'pageInput',
              'next',
              'last',
              '|',
              'zoomOut',
              'zoomIn',
              'search',
              'share',
              'menu',
              'fullscreen',
            ],
          }
          : {}),
      },
});

// Click/double-click diagnostics, on unless ?clickdebug=0. Explains in the console why a
// double-click did or did not zoom (browser never paired the clicks vs. landed in a flip zone).
if (q.get('clickdebug') !== '0') {
  installClickDebug(book, zine, { clickToFlip: opt.clickToFlip });
}

zine.on('pageChanged', updateStatus);
zine.on('zoomChanged', updateStatus);
zine.on('sourceError', (e) => {
  const err = e.error;
  const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  sourceErrors.push(`p${e.index} ${msg}`);
  updateDebug();
});
// Keep the width cap in step with the layout, however it changed: the toolbar's page-layout
// switch, or the responsive fallback on a narrow window.
zine.on('spreadChanged', (e) => hintAspect(e.singlePage));
zine.on('rendererFallback', (e) => {
  activeRenderer = e.to;
  updateDebug();
});
zine.ready
  .then(async () => {
    updateStatus();
    updateDebug();
    await probePdfRaster();
  })
  .catch((err: unknown) => {
    rendererError = err instanceof Error ? err.message : String(err);
    statusEl.textContent = 'could not open (see debug below)';
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
  const lines = [
    `<span class="k">WebGL2 support   :</span> <span class="${supportCls}">${supportTxt}</span>`,
    `<span class="k">GPU              :</span> ${probe.gpu}`,
    `<span class="k">'auto' would pick:</span> ${auto}`,
    `<span class="k">this demo forces :</span> ${renderer}`,
    `<span class="k">active renderer  :</span> <span class="${activeCls}">${activeTxt}</span>`,
  ];
  if (sourceErrors.length) {
    lines.push(
      `<span class="k">sourceError       :</span> <span class="bad">${sourceErrors.join(' | ')}</span>`,
    );
  }
  if (rasterProbe) lines.push(rasterProbe);
  debugEl.innerHTML = lines.join('\n');
}

async function probePdfRaster(): Promise<void> {
  if (kind !== 'pdf') return;
  try {
    const img = await zine.getPageImage(0);
    if (!img) {
      rasterProbe = `<span class="k">pdf source        :</span> <span class="bad">none</span>`;
      updateDebug();
      return;
    }
    const kindName =
      img instanceof ImageBitmap ? 'ImageBitmap' : img instanceof HTMLCanvasElement ? 'canvas' : typeof img;
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx?.drawImage(img as CanvasImageSource, Math.floor(img.width / 2), Math.floor(img.height / 2), 1, 1, 0, 0, 1, 1);
    const px = ctx ? [...ctx.getImageData(0, 0, 1, 1).data] : [];
    const ink = px[3] > 8 && (px[0] < 250 || px[1] < 250 || px[2] < 250);
    rasterProbe = `<span class="k">pdf source        :</span> ${kindName} ${img.width}×${img.height}  px ${px.join(',')}  <span class="${ink ? 'ok' : 'bad'}">${ink ? 'has ink' : 'blank/white'}</span>`;
  } catch (err) {
    rasterProbe = `<span class="k">pdf source        :</span> <span class="bad">${err instanceof Error ? err.message : String(err)}</span>`;
  }
  updateDebug();
}

updateDebug();
