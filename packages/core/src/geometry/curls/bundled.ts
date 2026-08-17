import { deformCone } from './cone';
import { deformSimple } from './simple';
import { IMPORTABLE_CURLS, type CurlModel, type CurlSpec, type CurlType } from './types';

/**
 * The curl models carried in the bundle, and the only ones nameable by string.
 *
 * Kept apart from `./index` so importing them does not drag in the other four: the barrel names
 * every model, which is right for a caller picking one but wrong for the renderer, which must
 * only ever pull these two.
 */
export const cone: CurlModel = { deform: deformCone, anchored: true };
export const simple: CurlModel = {
  deform: deformSimple,
  anchored: false,
  flat: true,
  gloss: false,
};

export const BUNDLED_CURLS: Record<CurlType, CurlModel> = { cone, simple };

/**
 * Turn a `curl` option into a model. Strings name a bundled curl; anything else is already a
 * model, imported from `@zinejs/core/curls` or written by the caller.
 */
export function resolveCurl(spec: CurlSpec): CurlModel {
  if (typeof spec !== 'string') return spec;
  const model = BUNDLED_CURLS[spec];
  if (model) return model;
  // Reached only when validation was bypassed (a renderer used directly, say), so name the fix
  // rather than the mistake: these curls are real, they just are not bundled.
  if (IMPORTABLE_CURLS.includes(spec)) {
    throw new Error(
      `Zine: the '${spec}' curl is not bundled. Import it and pass the model: ` +
        `import { ${spec} } from '@zinejs/core/curls'  →  curl: ${spec}`,
    );
  }
  throw new Error(`Zine: unknown curl ${JSON.stringify(spec)}.`);
}
