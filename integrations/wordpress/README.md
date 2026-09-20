# zinejs Flipbook (WordPress plugin)

A WordPress plugin that embeds a [zinejs](https://zinejs.com) flipbook via a Gutenberg block or the
`[zine]` shortcode. It wraps the published `@zinejs/core` + `@zinejs/pdf` UMD builds (bundled under
`assets/vendor/`); it does not reimplement the engine.

No build step: the block editor UI is plain JS (`assets/js/block.js`, using `wp.element`), the block
is server-rendered (PHP `render_callback`), and the front end is bootstrapped by `assets/js/init.js`.

## Layout

- `zinejs.php` — plugin header, asset registration, block + shortcode registration.
- `includes/render.php` — the shared markup path for the block and the shortcode.
- `block/block.json` — block metadata (dynamic block; PHP renders the front end).
- `assets/js/block.js` — editor UI (PDF picker + options).
- `assets/js/init.js` — front-end: mounts a flipbook on each `.zine-flipbook` container.
- `assets/vendor/` — bundled engine + pdf.js (see below).

## Local development

Requires Docker. From this directory:

```bash
npx @wordpress/env start
```

Open http://localhost:8888 (admin / password), then add a Zine Flipbook block or a `[zine]`
shortcode. `npx @wordpress/env stop` when done.

## Refreshing the bundled assets

The vendored files in `assets/vendor/` are copied from the monorepo. After the engine or pdf.js
version changes, rebuild and re-copy:

```bash
./bin/update-assets.sh
```

Then bump `ZINEJS_ENGINE_VERSION` / `ZINEJS_PDFJS_VERSION` in `zinejs.php` to match.

## Distribution

wordpress.org uses SVN and a `readme.txt` (present here) in its own format. The plugin folder that
ships is this directory; there is nothing to compile.

## Licensing

Free plugin. The zinejs engine is PolyForm Noncommercial 1.0.0: commercial sites need a commercial
license (https://zinejs.com/license). The license-key surface (freemium enforcement) is a follow-up;
for now the readme and the block link to the license page.
