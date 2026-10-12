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

describe('CustomizeMenu deck row', () => {
  it('lets you pick owned decks and refuses locked ones', async () => {
    const { DECKS } = await import('@/world/decks');
    const menu = new CustomizeMenu(new Customization(), () => {});
    const picks: string[] = [];
    menu.addDeckRow(DECKS, () => ['default', 'citadel'], 'default', id => picks.push(id));
    const buttons = [...document.querySelectorAll('button')];
    buttons.find(b => b.textContent === 'CITADEL')!.click();
    buttons.find(b => b.textContent?.startsWith('LOCKED: Cash a 1500'))!.click();
    expect(picks).toEqual(['citadel']);
  });
});
