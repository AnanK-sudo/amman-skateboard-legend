import { describe, it, expect, beforeEach } from 'vitest';
import { InputManager } from '@/core/InputManager';

describe('InputManager', () => {
  let input: InputManager;

  beforeEach(() => {
    input = new InputManager();
    input.attach(document.body);
  });

  it('tracks key down state', () => {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    expect(input.isDown('KeyW')).toBe(true);
  });

  it('tracks key up state', () => {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    document.body.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
    expect(input.isDown('KeyW')).toBe(false);
  });

  it('detects key just pressed this frame', () => {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    expect(input.justPressed('Space')).toBe(true);
    input.update();
    expect(input.justPressed('Space')).toBe(false);
  });

  it('detects key just released this frame', () => {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    input.update();
    document.body.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    expect(input.justReleased('Space')).toBe(true);
    input.update();
    expect(input.justReleased('Space')).toBe(false);
  });

  it('tracks mouse movement delta', () => {
    document.body.dispatchEvent(new MouseEvent('mousemove', { movementX: 10, movementY: -5 }));
    expect(input.mouseDelta.x).toBe(10);
    expect(input.mouseDelta.y).toBe(-5);
    input.update();
    expect(input.mouseDelta.x).toBe(0);
    expect(input.mouseDelta.y).toBe(0);
  });

  it('can detach listeners', () => {
    input.detach();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    expect(input.isDown('KeyW')).toBe(false);
  });
});
