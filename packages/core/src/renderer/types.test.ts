import { describe, it, expect } from 'vitest';
import type { Renderer, SpreadContent, FlipDirection, LayoutMetrics } from './types';
import type { Spread } from '../engine/spread';

// Canonical minimal implementation — proves the contract is coherent and
// implementable, and documents the shape future renderers follow.
class NoopRenderer implements Renderer {
  readonly calls: string[] = [];

  async mount(_container: HTMLElement): Promise<void> {
    this.calls.push('mount');
  }
  destroy(): void {
    this.calls.push('destroy');
  }
  renderSpread(spread: Spread, _content: SpreadContent): void {
    this.calls.push(`renderSpread:${spread.left}/${spread.right}`);
  }
  setFlipProgress(t: number, direction: FlipDirection): void {
    this.calls.push(`flip:${t}:${direction}`);
  }
  setViewTransform(scale: number, x: number, y: number): void {
    this.calls.push(`view:${scale},${x},${y}`);
  }
  measure(): LayoutMetrics {
    return { containerWidth: 800, containerHeight: 600, pageWidth: 400, pageHeight: 600 };
  }
}

describe('Renderer contract', () => {
  it('is implementable and every method is callable', async () => {
    const r = new NoopRenderer();
    await r.mount({} as HTMLElement);
    r.renderSpread({ left: 0, right: 1 }, { left: null, right: null });
    r.setFlipProgress(0.5, 'forward');
    r.setViewTransform(2, 10, 20);
    const metrics = r.measure();
    r.destroy();

    expect(r.calls).toEqual([
      'mount',
      'renderSpread:0/1',
      'flip:0.5:forward',
      'view:2,10,20',
      'destroy',
    ]);
    expect(metrics.pageWidth).toBe(400);
  });
});
