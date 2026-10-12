import { describe, it, expect } from 'vitest';
import { judgeLanding, judgeWallHit, type LandingSnapshot } from '@/player/LandingJudge';

const clean: LandingSnapshot = { flipProgress: null, grabHeld: false, spinResidualDeg: 0, dropHeight: 0.5, crouched: false };

describe('judgeLanding', () => {
  it('accepts a plain landing', () => expect(judgeLanding(clean)).toEqual({ clean: true }));

  it('bails on a flip landed before 85 percent', () => {
    expect(judgeLanding({ ...clean, flipProgress: 0.85 })).toEqual({ clean: true });
    expect(judgeLanding({ ...clean, flipProgress: 0.84 })).toEqual({ clean: false, reason: 'unfinished' });
  });

  it('bails when still holding a grab', () => {
    expect(judgeLanding({ ...clean, grabHeld: true })).toEqual({ clean: false, reason: 'grab' });
  });

  it('bails when more than 30 degrees off a half turn', () => {
    expect(judgeLanding({ ...clean, spinResidualDeg: 30 })).toEqual({ clean: true });
    expect(judgeLanding({ ...clean, spinResidualDeg: -31 })).toEqual({ clean: false, reason: 'crooked' });
  });

  it('bails on big drops unless crouched, and always above 6 m', () => {
    expect(judgeLanding({ ...clean, dropHeight: 2.5 })).toEqual({ clean: true });
    expect(judgeLanding({ ...clean, dropHeight: 2.6 })).toEqual({ clean: false, reason: 'drop' });
    expect(judgeLanding({ ...clean, dropHeight: 5.9, crouched: true })).toEqual({ clean: true });
    expect(judgeLanding({ ...clean, dropHeight: 6.1, crouched: true })).toEqual({ clean: false, reason: 'drop' });
  });
});

describe('judgeWallHit', () => {
  it('bails only on fast hits that kill most of the speed', () => {
    expect(judgeWallHit(9.5, 2)).toBe('wall');
    expect(judgeWallHit(8.9, 0)).toBeNull();
    expect(judgeWallHit(12, 4)).toBeNull(); // glancing: kept a third
  });
});
