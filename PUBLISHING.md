# Publishing `@zinejs/*`

Checklist for releasing `@zinejs/core` and `@zinejs/pdf` to npm. Publish **core first** — pdf peer-depends on it.

## 1. Bump versions

Bump `version` in whichever package(s) you are releasing (`packages/core/package.json`, `packages/pdf/package.json`, or both). Committing the bump is recommended.

## 2. Sanity + build

```bash
pnpm --filter @zinejs/core test && pnpm --filter @zinejs/pdf test
pnpm --filter @zinejs/core build && pnpm --filter @zinejs/pdf build
```

## 3. Size limits

```bash
pnpm --filter @zinejs/core size && pnpm --filter @zinejs/pdf size
```

## 4. Dry run — confirm versions

```bash
pnpm --filter @zinejs/core publish --dry-run --no-git-checks
pnpm --filter @zinejs/pdf publish --dry-run --no-git-checks
```

## 5. Log in

```bash
npm login
npm whoami
```

## 6. Publish

```bash
pnpm --filter @zinejs/core publish --access public --no-git-checks
pnpm --filter @zinejs/pdf publish --access public --no-git-checks
```
