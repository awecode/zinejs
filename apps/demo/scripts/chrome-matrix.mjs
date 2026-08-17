/**
 * Drive the demo against pinned Chrome-for-Testing majors.
 *
 * Default matrix: 113, 114, 125, 153
 *
 *   113  oldest Chrome-for-Testing major (CfT has nothing below this)
 *   114  oldest version we found that rasterizes PDF text correctly
 *        (113 paints the page colour but drops glyphs: worker TypeError
 *        ArrayBuffer.prototype.transferToFixedLength)
 *   125  minimum Chrome claimed by pdf.js's legacy build
 *   153  current CfT Canary as of 2026-08 when this was written (152 is Stable)
 *
 * From the repo root, with the demo already running:
 *
 *   pnpm --filter @zinejs/demo dev
 *   pnpm test:chrome-matrix:install   # once: download the default majors into ./chrome
 *   pnpm test:chrome-matrix           # PDF + image, WebGL + CSS
 *
 * Optional: DEMO_URL=http://127.0.0.1:5173 CHROME_MAJORS=114,125 pnpm test:chrome-matrix
 * Override a binary with CHROME_<major>_PATH=/path/to/chrome. Majors below 113 are not
 * on Chrome-for-Testing; install skips those.
 *
 * Binaries and screenshots stay in ./chrome (gitignored). This file is the runner.
 */
import { spawnSync } from 'node:child_process'
import { access, constants as fsConstants, mkdir, readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const REPO = join(scriptDir, '../../..')
const CACHE = join(REPO, 'chrome')
const SHOTS = join(CACHE, 'screenshots')
const BASE = process.env.DEMO_URL ?? 'http://127.0.0.1:5173'
const MAJORS = (process.env.CHROME_MAJORS ?? '113,114,125,153')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const PAGES = ['/pdf-webgl.html', '/pdf-css.html', '/image-webgl.html', '/image-css.html']
const MIN_CFT_MAJOR = 113

function chromePathEnv(major) {
  return process.env[`CHROME_${major}_PATH`]
}

function chromeFolderPrefix() {
  if (process.platform === 'linux') return 'linux'
  if (process.platform === 'win32') return 'win64'
  if (process.platform === 'darwin') return process.arch === 'arm64' ? 'mac_arm' : 'mac'
  throw new Error(`chrome-matrix: unsupported platform ${process.platform}`)
}

function chromeExeRel() {
  if (process.platform === 'linux') return join('chrome-linux64', 'chrome')
  if (process.platform === 'win32') return join('chrome-win64', 'chrome.exe')
  const app = 'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
  if (process.arch === 'arm64') return join('chrome-mac-arm64', app)
  return join('chrome-mac', app)
}

async function findChrome(major) {
  const fromEnv = chromePathEnv(major)
  if (fromEnv) {
    try {
      await access(fromEnv, fsConstants.X_OK)
      return fromEnv
    } catch {
      throw new Error(`chrome-matrix: CHROME_${major}_PATH is not executable: ${fromEnv}`)
    }
  }

  const prefix = `${chromeFolderPrefix()}-${major}.`
  const roots = [CACHE, join(CACHE, 'chrome')]
  for (const root of roots) {
    let names
    try {
      names = await readdir(root)
    } catch {
      continue
    }
    const match = names.filter((n) => n.startsWith(prefix)).sort().at(-1)
    if (!match) continue
    const exe = join(root, match, chromeExeRel())
    try {
      await access(exe, fsConstants.X_OK)
      return exe
    } catch {
      continue
    }
  }
  return null
}

function installBrowsers() {
  let installed = 0
  for (const major of MAJORS) {
    if (Number(major) < MIN_CFT_MAJOR) {
      console.error(
        `chrome-matrix: skipping chrome@${major} (Chrome-for-Testing starts at ${MIN_CFT_MAJOR}).`,
      )
      console.error(
        `  For ${major}, extract under ${CACHE}/linux-${major}.<patch>/chrome-linux64/chrome or set CHROME_${major}_PATH.`,
      )
      continue
    }
    console.error(`Installing chrome@${major} into ${CACHE} …`)
    const r = spawnSync(
      'npx',
      ['--yes', '@puppeteer/browsers', 'install', `chrome@${major}`, '--path', REPO],
      { stdio: 'inherit', cwd: REPO },
    )
    if (r.status !== 0) {
      throw new Error(`chrome-matrix: install chrome@${major} failed (exit ${r.status ?? 'null'})`)
    }
    installed += 1
  }
  if (!installed && MAJORS.every((major) => Number(major) < MIN_CFT_MAJOR)) {
    console.error('chrome-matrix: nothing to install via Chrome-for-Testing; add manual binaries for older majors.')
  }
}

async function probe(page) {
  await page.waitForFunction(
    () => {
      const s = document.getElementById('status')?.textContent ?? ''
      return s.includes('/') || s.includes('could not open')
    },
    { timeout: 20_000 },
  )
  await page.waitForTimeout(1200)
  return page.evaluate(() => {
    const debug = document.getElementById('debug')?.innerText ?? ''
    const status = document.getElementById('status')?.innerText ?? ''
    const book = document.getElementById('book')
    const canvases = [...(book?.querySelectorAll('canvas') ?? [])].map((el) => {
      const canvas = el
      if (!(canvas instanceof HTMLCanvasElement) || canvas.width < 1 || canvas.height < 1) {
        return { className: canvas.className, width: canvas.width, height: canvas.height, px: null, ink: false }
      }
      try {
        const c = document.createElement('canvas')
        c.width = 1
        c.height = 1
        const ctx = c.getContext('2d', { willReadFrequently: true })
        ctx?.drawImage(
          canvas,
          Math.floor(canvas.width * 0.75),
          Math.floor(canvas.height / 2),
          1,
          1,
          0,
          0,
          1,
          1,
        )
        const px = ctx ? [...ctx.getImageData(0, 0, 1, 1).data] : []
        const ink = px[3] > 8 && (px[0] < 250 || px[1] < 250 || px[2] < 250)
        return { className: canvas.className, width: canvas.width, height: canvas.height, px, ink }
      } catch (err) {
        return { className: canvas.className, error: String(err) }
      }
    })
    return {
      status,
      debug,
      canvases,
      features: {
        getOrInsertComputed: typeof Map.prototype.getOrInsertComputed,
        toHex: typeof Uint8Array.prototype.toHex,
        withResolvers: typeof Promise.withResolvers,
        promiseTry: typeof Promise.try,
        urlParse: typeof URL.parse,
        sumPrecise: typeof Math.sumPrecise,
      },
    }
  })
}

async function runOne(name, executablePath, path) {
  const errors = []
  const logs = []
  const failed = []
  const shot = join(SHOTS, `${name}${path.replaceAll('/', '-').replace('.html', '')}.png`)
  let browser
  try {
    browser = await chromium.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader'],
    })
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page = await context.newPage()
    page.on('pageerror', (err) => errors.push(`${err.name}: ${err.message}`))
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') logs.push(`${msg.type()}: ${msg.text()}`)
    })
    page.on('requestfailed', (req) => {
      failed.push(`${req.failure()?.errorText ?? 'failed'} ${req.url()}`)
    })
    page.on('response', (res) => {
      if (res.status() >= 400) failed.push(`HTTP ${res.status()} ${res.url()}`)
    })
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    let result
    try {
      result = await probe(page)
    } catch (err) {
      const partial = await page
        .evaluate(() => ({
          status: document.getElementById('status')?.innerText ?? '',
          debug: document.getElementById('debug')?.innerText ?? '',
        }))
        .catch(() => ({ status: '', debug: '' }))
      result = { ...partial, canvases: [], features: {} }
      return {
        ...result,
        ok: false,
        shot,
        error: err instanceof Error ? err.message : String(err),
        errors,
        logs,
        failed,
      }
    }
    await mkdir(dirname(shot), { recursive: true })
    await page.screenshot({ path: shot, fullPage: true })
    return { ok: true, shot, ...result, errors, logs, failed }
  } catch (err) {
    return {
      ok: false,
      shot,
      status: '',
      debug: '',
      canvases: [],
      features: {},
      error: err instanceof Error ? err.message : String(err),
      errors,
      logs,
      failed,
    }
  } finally {
    await browser?.close().catch(() => {})
  }
}

function passed(path, result) {
  const rendererFailed =
    (result.status ?? '').includes('could not open') || (result.debug ?? '').includes('failed —')
  const opened = /\d+\s*\/\s*\d+/.test(result.status ?? '')
  const canvasInk = Array.isArray(result.canvases) && result.canvases.some((c) => c.ink)
  const isPdf = path.startsWith('/pdf')
  return !rendererFailed && opened && (isPdf || canvasInk)
}

const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage:
  pnpm test:chrome-matrix:install
  pnpm test:chrome-matrix

  DEMO_URL           default http://127.0.0.1:5173
  CHROME_MAJORS      default 113,114,125,153
  CHROME_<major>_PATH  override binary for a major
`)
  process.exit(0)
}

if (args.includes('--install')) {
  await mkdir(CACHE, { recursive: true })
  installBrowsers()
  process.exit(0)
}

await mkdir(SHOTS, { recursive: true })

const browsers = []
for (const major of MAJORS) {
  const path = await findChrome(major)
  if (!path) {
    const hint =
      Number(major) < MIN_CFT_MAJOR
        ? ` Chrome-for-Testing starts at ${MIN_CFT_MAJOR}; extract under ${CACHE}/linux-${major}.<patch>/chrome-linux64/chrome or set CHROME_${major}_PATH.`
        : ''
    console.error(`chrome-matrix: no Chrome ${major} under ${CACHE}.${hint} Run: pnpm test:chrome-matrix:install`)
    process.exit(1)
  }
  browsers.push({ name: `chrome-${major}`, path })
}

try {
  await fetch(BASE, { signal: AbortSignal.timeout(2000) })
} catch {
  console.error(`chrome-matrix: nothing at ${BASE}. Start the demo:\n  pnpm --filter @zinejs/demo dev`)
  process.exit(1)
}

let fails = 0
for (const browser of browsers) {
  for (const path of PAGES) {
    const result = await runOne(browser.name, browser.path, path)
    const mark = result.ok !== false && passed(path, result) ? 'PASS' : 'FAIL'
    if (mark === 'FAIL') fails += 1
    console.log(
      JSON.stringify({
        mark,
        browser: browser.name,
        path,
        status: result.status,
        debug: result.debug,
        canvases: result.canvases,
        features: result.features,
        shot: result.shot,
        error: result.error,
        errors: result.errors,
        logs: (result.logs ?? []).slice(0, 12),
        failed: (result.failed ?? []).filter((u) => !u.includes('favicon')).slice(0, 12),
      }),
    )
  }
}

if (fails) {
  console.error(`chrome-matrix: ${fails} failure(s). Screenshots: ${SHOTS}`)
  process.exit(1)
}
console.error(`chrome-matrix: all passed. Screenshots: ${SHOTS}`)
