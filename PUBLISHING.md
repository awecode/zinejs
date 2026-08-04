# Publishing `@zinejs/*`

Checklist for releasing `@zinejs/core` and `@zinejs/pdf` to npm. Publish **core first** — pdf peer-depends on it.

## 1. Sanity + build

```bash
pnpm --filter @zinejs/core test && pnpm --filter @zinejs/pdf test
pnpm --filter @zinejs/core build && pnpm --filter @zinejs/pdf build
```

## 2. Size limits

```bash
pnpm --filter @zinejs/core size
pnpm --filter @zinejs/pdf size
```

## 3. Dry run — confirm versions

```bash
pnpm --filter @zinejs/core publish --dry-run --no-git-checks
pnpm --filter @zinejs/pdf publish --dry-run --no-git-checks
```

## 4. Log in

```bash
npm login
npm whoami
```

## 5. Publish

```bash
pnpm --filter @zinejs/core publish --access public --no-git-checks
pnpm --filter @zinejs/pdf publish --access public --no-git-checks
```
