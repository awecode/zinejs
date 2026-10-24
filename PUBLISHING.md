# Publishing

Releases are tag-driven. A local script bumps versions, tags and pushes; GitHub Actions builds and publishes.

| What | Script | Trigger | Workflow |
| --- | --- | --- | --- |
| `@zinejs/core`, `@zinejs/pdf`, `@zinejs/create` to npm | `scripts/release.sh` | `v*.*.*` tag | [.github/workflows/release.yml](.github/workflows/release.yml) |
| WordPress plugin to wordpress.org | `scripts/release-wp.sh` | `wp-*` tag | [.github/workflows/deploy-wordpress.yml](.github/workflows/deploy-wordpress.yml) |

## npm packages

All three packages share one version and are released together.

### 1. Check

Start from a clean tree on `main`, with tests and size budgets passing:

```bash
pnpm --filter @zinejs/core test && pnpm --filter @zinejs/pdf test
pnpm --filter @zinejs/core size && pnpm --filter @zinejs/pdf size
```

### 2. Release

```bash
scripts/release.sh 1.0.1        # asks for confirmation; add --yes to skip
```

The script:

1. Checks the version is valid semver, newer than the current one, and not already tagged, and that the working tree is clean.
2. Bumps `packages/core`, `packages/pdf` and `packages/create` to that version.
3. Commits `chore(release): vX.Y.Z`, tags `vX.Y.Z`, and pushes the branch and the tag.

### 3. Publish (automatic)

The tag runs the **Release** workflow, which builds core and pdf, copies `LICENSE` into each package, rewrites pdf's `workspace:^` dependency to the real core version, and publishes core, then pdf, then create with `--provenance`.

Auth is npm Trusted Publishing (OIDC), configured on npmjs.com for this repo, `release.yml` and the `public` environment. There is no `NPM_TOKEN` and no `npm login`.

A version already on npm is skipped, so a failed run can be retried safely: re-run the job, or start **Release** from the Actions tab (`workflow_dispatch`).

### 4. Verify

```bash
npm view @zinejs/core version
npm view @zinejs/pdf version
```

The jsDelivr and unpkg URLs pick up the new version on their own.

## WordPress plugin

The plugin in [integrations/wordpress](integrations/wordpress) bundles its own copy of the engine. It has its own version, separate from npm: a plugin-only change needs no engine release, and an engine change that does not affect WordPress needs no plugin release.

### 1. Release npm first, if the engine changed

Run `scripts/release.sh` as above. The plugin script refuses to bundle an engine that differs from its released `v*` tag.

### 2. Write the changelog

Add an entry at the top of the changelog in [readme.txt](integrations/wordpress/readme.txt), ending with the engine it bundles:

```
= 1.1.3 =
* Fix: what changed, in words a site owner understands.
* Bundles zinejs engine 1.0.3.
```

It may stay uncommitted; the script includes it in the release commit.

### 3. Release

```bash
scripts/release-wp.sh 1.1.3        # asks for confirmation; add --yes to skip
```

The script:

1. Checks the version is valid and newer than the plugin's, the tag is unused, the changelog entry exists, and nothing but `readme.txt` is uncommitted.
2. Checks the engine in `packages/core/package.json` has a `v*` tag and no source changes since it.
3. Rebuilds the bundled engine and pdf.js files (`integrations/wordpress/bin/update-assets.sh`).
4. Writes the plugin version into the `Version:` header, `ZINEJS_VERSION` and `Stable tag`, and the engine and pdf.js versions into `ZINEJS_ENGINE_VERSION` and `ZINEJS_PDFJS_VERSION`. The last two are the cache-busting query on the vendored scripts, so they must match what is bundled.
5. Commits `chore(wp): release X.Y.Z (engine A.B.C)`, tags `wp-X.Y.Z`, and pushes the branch and the tag.

### 4. Deploy (automatic)

The **Deploy WordPress plugin** workflow copies the shipped files (it excludes dev files such as `bin/`, `README.md` and `.wordpress-org/`) to wordpress.org SVN trunk, creates the SVN tag, and updates the listing assets from `.wordpress-org/`. It needs the `SVN_USERNAME` and `SVN_PASSWORD` repo secrets.

For a manual upload zip, run `integrations/wordpress/bin/build-zip.sh`.
