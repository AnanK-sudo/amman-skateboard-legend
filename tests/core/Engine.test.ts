import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/core/Engine';

describe('Engine', () => {
  it('calls update and render callbacks each frame', () => {
    const update = vi.fn();
    const render = vi.fn();
    const engine = new Engine({ update, render });
    engine.tick(16.67);
    expect(update).toHaveBeenCalledOnce();
    expect(render).toHaveBeenCalledOnce();
  });

  it('passes delta time in seconds to update', () => {
    const update = vi.fn();
    const engine = new Engine({ update, render: vi.fn() });
    engine.tick(16.67);
    const delta = update.mock.calls[0][0];
    expect(delta).toBeCloseTo(0.01667, 3);
  });

  it('clamps delta time to prevent spiral of death', () => {
    const update = vi.fn();
    const engine = new Engine({ update, render: vi.fn() });
    engine.tick(500);
    const delta = update.mock.calls[0][0];
    expect(delta).toBeLessThanOrEqual(0.1);
  });

  it('tracks elapsed time', () => {
    const engine = new Engine({ update: vi.fn(), render: vi.fn() });
    engine.tick(16.67);
    engine.tick(16.67);
    expect(engine.elapsed).toBeCloseTo(0.03334, 3);
  });

  it('can pause and resume', () => {
    const update = vi.fn();
    const engine = new Engine({ update, render: vi.fn() });
    engine.pause();
    engine.tick(16.67);
    expect(update).not.toHaveBeenCalled();
    engine.resume();
    engine.tick(16.67);
    expect(update).toHaveBeenCalledOnce();
  });
});
