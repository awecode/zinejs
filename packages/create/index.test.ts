import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), 'index.js');
const SELF_VERSION = JSON.parse(
  fs.readFileSync(path.join(path.dirname(CLI), 'package.json'), 'utf8'),
).version;

let tmp: string;

// Run the CLI non-interactively (no TTY) inside the temp dir.
const scaffold = (args: string[]): string =>
  execFileSync('node', [CLI, ...args], { cwd: tmp, encoding: 'utf8' });

const readPkg = (dir: string) =>
  JSON.parse(fs.readFileSync(path.join(tmp, dir, 'package.json'), 'utf8'));

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zine-create-'));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('create @zinejs', () => {
  it('scaffolds an image project with the core dep and rewritten name', () => {
    scaffold(['my-book', '--template', 'image']);
    expect(fs.existsSync(path.join(tmp, 'my-book/index.html'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, 'my-book/src/main.js'))).toBe(true);
    // _gitignore is delivered as .gitignore (npm would strip a real one from the tarball).
    expect(fs.existsSync(path.join(tmp, 'my-book/.gitignore'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, 'my-book/public/pages/page-1.png'))).toBe(true);

    const pkg = readPkg('my-book');
    expect(pkg.name).toBe('my-book');
    expect(pkg.dependencies['@zinejs/core']).toBe(`^${SELF_VERSION}`);
    expect(pkg.dependencies['@zinejs/pdf']).toBeUndefined();
  });

  it('scaffolds a pdf project with both deps and the sample document', () => {
    scaffold(['reader', '--template', 'pdf']);
    expect(fs.existsSync(path.join(tmp, 'reader/public/sample.pdf'))).toBe(true);
    // pdf.js worker needs @zinejs/pdf excluded from Vite's pre-bundler.
    expect(fs.existsSync(path.join(tmp, 'reader/vite.config.js'))).toBe(true);

    const pkg = readPkg('reader');
    expect(pkg.dependencies['@zinejs/core']).toBe(`^${SELF_VERSION}`);
    expect(pkg.dependencies['@zinejs/pdf']).toBe(`^${SELF_VERSION}`);
  });

  it('sanitizes an unusual directory name into a valid package name', () => {
    scaffold(['My Cool Book!', '--template', 'image']);
    expect(readPkg('My Cool Book!').name).toBe('my-cool-book');
  });

  it('refuses a non-empty directory without --force, and proceeds with it', () => {
    fs.mkdirSync(path.join(tmp, 'taken'));
    fs.writeFileSync(path.join(tmp, 'taken/keep.txt'), 'x');
    expect(() => scaffold(['taken', '--template', 'image'])).toThrow();
    expect(() => scaffold(['taken', '--template', 'image', '--force'])).not.toThrow();
    expect(fs.existsSync(path.join(tmp, 'taken/index.html'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, 'taken/keep.txt'))).toBe(true); // existing files kept
  });

  it('rejects an unknown template', () => {
    expect(() => scaffold(['x', '--template', 'nope'])).toThrow();
  });
});
