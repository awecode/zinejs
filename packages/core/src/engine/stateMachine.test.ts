import { describe, it, expect } from 'vitest';
import { nextState, FlipMachine } from './stateMachine';

describe('nextState', () => {
  it('walks a full flip: idle → dragging → animating → idle', () => {
    expect(nextState('idle', 'grab')).toBe('dragging');
    expect(nextState('dragging', 'release')).toBe('animating');
    expect(nextState('animating', 'settle')).toBe('idle');
  });

  it('jumps straight to animating for a programmatic flip', () => {
    expect(nextState('idle', 'flip')).toBe('animating');
    expect(nextState('animating', 'settle')).toBe('idle');
  });

  it('walks a zoom pan: idle → zoomed-panning → idle', () => {
    expect(nextState('idle', 'panStart')).toBe('zoomed-panning');
    expect(nextState('zoomed-panning', 'panEnd')).toBe('idle');
  });

  it('returns null for illegal transitions', () => {
    expect(nextState('idle', 'release')).toBeNull();
    expect(nextState('idle', 'settle')).toBeNull();
    expect(nextState('dragging', 'grab')).toBeNull();
    expect(nextState('animating', 'grab')).toBeNull();
    expect(nextState('zoomed-panning', 'grab')).toBeNull();
  });
});

describe('FlipMachine', () => {
  it('starts idle by default and tracks legal transitions', () => {
    const m = new FlipMachine();
    expect(m.state).toBe('idle');
    expect(m.send('grab')).toBe('dragging');
    expect(m.state).toBe('dragging');
    expect(m.send('release')).toBe('animating');
    expect(m.send('settle')).toBe('idle');
  });

  it('ignores illegal events without changing state', () => {
    const m = new FlipMachine();
    expect(m.send('release')).toBeNull();
    expect(m.state).toBe('idle');
  });

  it('accepts a custom initial state', () => {
    const m = new FlipMachine('animating');
    expect(m.state).toBe('animating');
  });
});
