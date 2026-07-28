import { describe, it, expect } from 'vitest';
import { hitTest } from './hitTest';

const page = { width: 100, height: 100 };
const cornerSize = 20;

describe('hitTest', () => {
  it('reports outside for points beyond the page bounds', () => {
    expect(hitTest({ x: -1, y: 50 }, page, cornerSize)).toBe('outside');
    expect(hitTest({ x: 101, y: 50 }, page, cornerSize)).toBe('outside');
    expect(hitTest({ x: 50, y: -1 }, page, cornerSize)).toBe('outside');
    expect(hitTest({ x: 50, y: 101 }, page, cornerSize)).toBe('outside');
  });

  it('reports corner for points inside any of the four corner boxes', () => {
    expect(hitTest({ x: 5, y: 5 }, page, cornerSize)).toBe('corner');
    expect(hitTest({ x: 95, y: 5 }, page, cornerSize)).toBe('corner');
    expect(hitTest({ x: 5, y: 95 }, page, cornerSize)).toBe('corner');
    expect(hitTest({ x: 95, y: 95 }, page, cornerSize)).toBe('corner');
  });

  it('reports page for the interior and for non-corner edge points', () => {
    expect(hitTest({ x: 50, y: 50 }, page, cornerSize)).toBe('page');
    expect(hitTest({ x: 50, y: 5 }, page, cornerSize)).toBe('page'); // near top edge, not a corner
    expect(hitTest({ x: 5, y: 50 }, page, cornerSize)).toBe('page'); // near left edge, not a corner
  });

  it('treats the exact page boundary as inside (corner at the extremes)', () => {
    expect(hitTest({ x: 0, y: 0 }, page, cornerSize)).toBe('corner');
    expect(hitTest({ x: 100, y: 100 }, page, cornerSize)).toBe('corner');
  });
});
