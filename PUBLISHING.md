# Publishing

Releases are tag-driven. You run one script locally; GitHub Actions builds and publishes.

| What | Trigger | Workflow |
| --- | --- | --- |
| `@zinejs/core`, `@zinejs/pdf`, `@zinejs/create` to npm | `v*.*.*` tag | [.github/workflows/release.yml](.github/workflows/release.yml) |
| WordPress plugin to wordpress.org | `wp-*` tag | [.github/workflows/deploy-wordpress.yml](.github/workflows/deploy-wordpress.yml) |

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

The plugin in [integrations/wordpress](integrations/wordpress) bundles its own copy of the engine, so release npm first when the engine changed.

1. Refresh the bundled engine and pdf.js files:

   ```bash
   integrations/wordpress/bin/update-assets.sh
   ```

2. In [zinejs.php](integrations/wordpress/zinejs.php), bump the plugin `Version:` header and `ZINEJS_VERSION`. Set `ZINEJS_ENGINE_VERSION` and `ZINEJS_PDFJS_VERSION` to the bundled versions; they are the cache-busting query on the vendored scripts, so a stale value keeps visitors on the old files.
3. In [readme.txt](integrations/wordpress/readme.txt), bump `Stable tag` and add a changelog entry.
4. Commit, then tag and push:

   ```bash
   git tag -a wp-1.1.1 -m wp-1.1.1 && git push origin wp-1.1.1
   ```

The **Deploy WordPress plugin** workflow copies the shipped files (it excludes dev files such as `bin/`, `README.md` and `.wordpress-org/`) to wordpress.org SVN trunk, creates the SVN tag, and updates the listing assets from `.wordpress-org/`. It needs the `SVN_USERNAME` and `SVN_PASSWORD` repo secrets.

For a manual upload zip, run `integrations/wordpress/bin/build-zip.sh`.
