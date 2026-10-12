import { describe, it, expect } from 'vitest';
import { CustomizeMenu } from '@/ui/CustomizeMenu';
import { Customization } from '@/player/Customization';
import type { Stance } from '@/player/anim/mirror';

describe('CustomizeMenu stance toggle', () => {
  it('shows the current stance and flips it on click', () => {
    const menu = new CustomizeMenu(new Customization(), () => {});
    const changes: Stance[] = [];
    menu.addStanceToggle('regular', s => changes.push(s));
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent?.startsWith('STANCE'))!;
    expect(btn.textContent).toBe('STANCE: REGULAR');
    btn.click();
    expect(btn.textContent).toBe('STANCE: GOOFY');
    btn.click();
    expect(changes).toEqual(['goofy', 'regular']);
  });
});
