=== zinejs Flipbook ===
Contributors: isdipesh
Tags: flipbook, pdf, page flip, magazine, viewer
Requires at least: 6.3
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

A real page-flip reader for PDFs and images, via a block or the [zine] shortcode.

== Description ==

zinejs Flipbook embeds a fast, GPU-accelerated page-flip reader in your posts and pages. Point it at a
PDF from your Media Library and readers can flip, zoom, and page through it like a real book. A CSS
fallback keeps it working on devices without WebGL.

Ways to add a flipbook:

* The **Zine PDF Flipbook** block: pick a PDF and set options in the editor.
* The **Zine Image Flipbook** block: pick a set of images.
* The **[zine] shortcode**: for the Classic editor, theme templates, and page builders.

The engine and pdf.js are bundled with the plugin, and the scripts are enqueued only on pages that actually contain a flipbook.

= Shortcode =

`[zine pdf="https://example.com/brochure.pdf" spread="cover" curl="silk" controls-position="top"]`

The shortcode accepts the same options as the blocks. Source: `pdf` (URL) or `images`
(comma-separated URLs). Layout: `spread` (cover | double | single | book), `direction` (ltr | rtl),
`fit` (contain | fill), `responsive` (true | false), `threshold` (px), `max-width` (px), `aspect`
(e.g. 3/2, or auto). Interaction: `click-to-flip` (edge | half | off), `curl` (cone | simple | roll
| leaf | flick | silk), `flip-duration` (ms), `start-page` (0-based). Zoom: `zoom` (true | false),
`zoom-max`, `zoom-wheel`, `zoom-double-click`. Controls: `controls` (true | false),
`controls-position` (top | bottom | left | right), `controls-scheme` (auto | light | dark),
`controls-arrows`, `context-menu`, `loading`, `hints`, `deep-link`. Permissions: `allow-download`,
`allow-print`, `allow-share`. Covers: `front-cover` (URL), `back-cover` (URL). Sound: `sound`
(true | false), `sound-volume` (0..1), `sound-muted`, `sound-persist`.

By default the book drops to one page per spread when its container is narrower than 500px
(`threshold`), so it stays readable on phones and in narrow theme columns. If your column is narrow
but you still want two-page spreads (for example in `cover` mode), set `responsive="false"`, or use
the block's Wide/Full alignment to give it more room.

== License ==

This plugin is free and open source, licensed under the GNU GPL v2 or later. The zinejs engine it
bundles is distributed here under the same GPL license, and its source is available at
https://github.com/awecode/zinejs (the engine is dual-licensed; other editions exist at
https://zinejs.com). Bundled pdf.js is licensed under Apache-2.0; its source is at
https://github.com/mozilla/pdf.js.

The plugin's own code is unminified and readable. The bundled `assets/vendor/*` files are built from
the sources above; see the repository for the build steps.

== Installation ==

1. Upload the `zinejs` folder to `/wp-content/plugins/`, or install the plugin through the Plugins
   screen in WordPress.
2. Activate it through the Plugins screen.
3. Add a "Zine Flipbook" block to a post or page, or use the `[zine]` shortcode.

== Frequently Asked Questions ==

= Can I show more than one flipbook on a page? =

Yes. Add multiple blocks or shortcodes; each mounts independently.

= The PDF does not render on my server =

pdf.js loads its worker as an ES module. A few servers serve `.mjs` files with the wrong MIME type,
which blocks the worker. If pages stay blank, add this to your server config (Apache `.htaccess`):

`AddType text/javascript .mjs`

== Screenshots ==

1. A two-page PDF spread rendered by the PDF Flipbook block.
2. An image flipbook with the built-in reader toolbar.

== Changelog ==

= 1.0.0 =
* Two blocks (PDF and Images) plus the [zine] shortcode, with the full zinejs option set.