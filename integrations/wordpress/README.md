# zinejs Flipbook (WordPress plugin)

A WordPress plugin that embeds a [zinejs](https://zinejs.com) flipbook via a Gutenberg block or the
`[zinejs]` shortcode. It wraps the published `@zinejs/core` + `@zinejs/pdf` UMD builds (bundled under
`assets/vendor/`); it does not reimplement the engine.

No build step: the block editor UI is plain JS (`assets/js/block.js`, using `wp.element`), the block
is server-rendered (PHP `render_callback`), and the front end is bootstrapped by `assets/js/init.js`.

## Layout

- `zinejs.php` — plugin header, asset registration, block + shortcode registration.
- `includes/render.php` — the shared markup path for the block and the shortcode.
- `block-pdf/`, `block-image/` — block.json metadata for the two dynamic blocks (PHP renders the front end).
- `assets/js/block.js` — editor UI (PDF picker + options).
- `assets/js/init.js` — front-end: mounts a flipbook on each `.zine-flipbook` container.
- `assets/vendor/` — bundled engine + pdf.js (see below).

## Local development

Requires Docker. From this directory:

```bash
npx @wordpress/env start
```

Open http://localhost:8888 (admin / password), then add a Zine Flipbook block or a `[zinejs]`
shortcode. `npx @wordpress/env stop` when done.

## Refreshing the bundled assets

The vendored files in `assets/vendor/` are copied from the monorepo. After the engine or pdf.js
version changes, rebuild and re-copy:

```bash
./bin/update-assets.sh
```

Then bump `ZINEJS_ENGINE_VERSION` / `ZINEJS_PDFJS_VERSION` in `zinejs.php` to match.

## Updating curl styles

The engine's curl set (`CURL_TYPES` for the bundled ones, `IMPORTABLE_CURLS` for the rest) is the
source of truth. When core adds, removes, or renames a curl, update these two places by hand so the
block offers the right set:

1. `assets/js/block.js`: the **Curl style** dropdown options.
2. `includes/render.php`: the curl **whitelist** in `zinejs_render_container`.

`assets/js/init.js` needs no change: it reads `ZineJS.IMPORTABLE_CURLS` from the bundled engine at
runtime to decide which curls load on demand. Run `./bin/update-assets.sh` after a core change so the
re-vendored `zine-curls.mjs` matches. If you drop a curl users may have saved: importable ones fall
back to the default automatically; a removed *bundled* curl would error, so keep those stable.

## Distribution

wordpress.org uses SVN and a `readme.txt` (present here) in its own format. The plugin folder that
ships is this directory; there is nothing to compile.

## License

The WordPress.org edition (this plugin plus the engine build it bundles) is distributed under GPLv2
or later. The engine is dual-licensed: PolyForm Noncommercial governs its other editions. See
`readme.txt` and `LICENSE`.
