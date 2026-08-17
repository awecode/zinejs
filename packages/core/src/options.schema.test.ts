import { describe, it, expect } from 'vitest';
import schema from '../options.schema.json';

describe('options.schema.json', () => {
  it('requires a source and forbids unknown options', () => {
    expect(schema.required).toContain('source');
    expect(schema.additionalProperties).toBe(false);
  });

  it('documents exactly the constructor options', () => {
    expect(Object.keys(schema.properties).sort()).toEqual(
      [
        'spreadMode',
        'frontCover',
        'backCover',
        'pages',
        'direction',
        'width',
        'height',
        'flipDuration',
        'clickToFlip',
        'clickZoneSize',
        'clickFlipDelay',
        'zoom',
        'renderer',
        'curl',
        'singlePageThreshold',
        'source',
        'startPage',
        'controls',
        'deepLink',
        'disableContextMenu',
        'responsiveSpread',
      ].sort(),
    );
  });

  it('states the same defaults the constructor uses', () => {
    expect(schema.properties.flipDuration?.default).toBe(800);
    expect(schema.properties.singlePageThreshold?.default).toBe(640);
    expect(schema.properties.direction?.default).toBe('ltr');
    expect(schema.properties.controls?.default).toBe(true);
  });
});
