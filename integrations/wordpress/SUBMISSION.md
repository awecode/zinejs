# WordPress.org submission checklist

The plugin is prepared for a WordPress.org launch as a **GPLv2-or-later free edition**. This file
lists the steps only you can do, and the decisions to confirm before submitting.

## Confirm before submitting

- [ ] **Dual-licensing intent.** The wp.org copy (plugin + the bundled zinejs engine) ships under
      GPLv2-or-later. Your other editions stay under PolyForm. You are the copyright holder, so this
      is allowed, but it must be your intent: anyone may use/redistribute the wp.org copy, including
      commercially. Your paid/pro tier must be a separate product (extra features, support, hosting).
- [ ] **`Contributors:` in `readme.txt`** currently says `zinejs`. Change it to your real
      WordPress.org account username(s), comma-separated. The listing is owned by these accounts.
- [ ] **`Tested up to:`** in `readme.txt` (currently 6.7): set to the latest WordPress version you
      have actually tested against.
- [ ] **Branding.** `.wordpress-org/icon-256x256.png` and `banner-772x250.png` / `banner-1544x500.png`
      are clean placeholders. Replace with real artwork when you have it (optional for approval).

## Initial submission (a ZIP upload, not SVN)

1. Build the zip: `./bin/build-zip.sh` -> `dist/zinejs.zip` (clean, shipped files only).
2. Create/log in to a WordPress.org account, go to https://wordpress.org/plugins/developers/add/
   and upload `dist/zinejs.zip`.
3. A human reviewer checks it (licensing, security, guidelines). Expect back-and-forth by email;
   turnaround is often days to a couple of weeks. The slug is assigned from the plugin header.

## After approval (SVN + automated deploys)

1. You receive SVN access for the slug (expected: `zinejs`).
2. In the GitHub repo, set secrets **SVN_USERNAME** and **SVN_PASSWORD** (your wp.org account).
3. Push a tag `wp-1.0.0`. `.github/workflows/deploy-wordpress.yml` builds a clean plugin folder,
   deploys trunk + the tag to SVN, and uploads the `.wordpress-org/` assets. Future releases: bump
   the version in `zinejs.php` and `readme.txt` (Stable tag), then push `wp-<version>`.

## Keeping the engine current

The bundled engine/pdf.js live in `assets/vendor/`. After a core release, run `./bin/update-assets.sh`
to re-vendor them, bump `ZINEJS_ENGINE_VERSION` / `ZINEJS_PDFJS_VERSION` in `zinejs.php`, and cut a
new plugin version.
