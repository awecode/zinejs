#!/usr/bin/env node
// Scaffold a new zinejs flipbook project. Run via `npm create @zinejs`,
// `pnpm create @zinejs`, or `yarn create @zinejs`. Zero runtime dependencies.
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES = new Set(['image', 'pdf']);
const SELF_VERSION = JSON.parse(fs.readFileSync(path.join(HERE, 'package.json'), 'utf8')).version;

function help() {
  console.log(`
Create a zinejs flipbook project.

Usage:
  npm create @zinejs [dir] [options]

Options:
  --template <image|pdf>   Starter to use (prompted if omitted)
  --force                  Scaffold into a non-empty directory
  -h, --help               Show this help
`);
}

/** Turn a directory name into a valid npm package name. */
function toPkgName(s) {
  const name = s
    .toLowerCase()
    .replace(/[^a-z0-9-~._]/g, '-')
    .replace(/^[._]+/, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return name || 'zine-book';
}

/** Copy a template tree, renaming `_gitignore` to `.gitignore` (npm strips real .gitignore). */
function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const name = entry.name === '_gitignore' ? '.gitignore' : entry.name;
    const dest = path.join(to, name);
    if (entry.isDirectory()) copyTree(src, dest);
    else fs.copyFileSync(src, dest);
  }
}

/** Set the project name and pin @zinejs/* deps to this tool's version. */
function patchPackageJson(dir, projectName) {
  const file = path.join(dir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
  pkg.name = projectName;
  for (const dep of Object.keys(pkg.dependencies ?? {})) {
    if (dep.startsWith('@zinejs/')) pkg.dependencies[dep] = `^${SELF_VERSION}`;
  }
  fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
}

function parseArgs(argv) {
  const out = { dir: undefined, template: undefined, force: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') out.help = true;
    else if (a === '--force') out.force = true;
    else if (a === '--template') out.template = argv[++i];
    else if (a.startsWith('--template=')) out.template = a.slice('--template='.length);
    else if (!a.startsWith('-') && out.dir === undefined) out.dir = a;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    help();
    return;
  }

  const interactive = process.stdin.isTTY && process.stdout.isTTY;
  const rl = interactive
    ? readline.createInterface({ input: process.stdin, output: process.stdout })
    : null;
  const ask = async (q, def) => {
    if (!rl) return def;
    const a = (await rl.question(q)).trim();
    return a || def;
  };

  try {
    const dir = args.dir ?? (await ask('Project directory: (my-zine-book) ', 'my-zine-book'));

    let template = args.template;
    if (template && !TEMPLATES.has(template)) {
      console.error(`error: unknown template '${template}' (expected image or pdf)`);
      process.exitCode = 1;
      return;
    }
    if (!template) {
      const a = await ask('Source type: image or pdf? (image) ', 'image');
      template = a.toLowerCase();
      if (!TEMPLATES.has(template)) {
        console.error(`error: unknown template '${template}' (expected image or pdf)`);
        process.exitCode = 1;
        return;
      }
    }

    const target = path.resolve(process.cwd(), dir);
    if (fs.existsSync(target)) {
      const rest = fs.readdirSync(target).filter((f) => f !== '.git');
      if (rest.length > 0 && !args.force) {
        console.error(`error: ${dir} is not empty. Use --force to scaffold into it anyway.`);
        process.exitCode = 1;
        return;
      }
    }

    copyTree(path.join(HERE, 'templates', template), target);
    patchPackageJson(target, toPkgName(path.basename(target)));

    console.log(`
Created a zinejs (${template}) flipbook in ${dir}

Next steps:
  cd ${dir}
  npm install
  npm run dev
`);
  } finally {
    rl?.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
