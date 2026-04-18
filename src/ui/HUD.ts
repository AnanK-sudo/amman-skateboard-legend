// HUD.ts — in-game heads-up display
// Graffiti/street-art styled overlay rendered as HTML/CSS over the game canvas.

const COLORS = {
  orange: '#ff6b35',
  green:  '#3fb950',
  purple: '#d2a8ff',
  pink:   '#f778ba',
  blue:   '#58a6ff',
  gray:   '#8b949e',
};

const FONT_STACK = '"Impact", "Arial Black", sans-serif';

function labelStyle(): Partial<CSSStyleDeclaration> {
  return {
    display: 'block',
    fontSize: '11px',
    letterSpacing: '2px',
    color: COLORS.gray,
    fontFamily: FONT_STACK,
    marginBottom: '2px',
    textTransform: 'uppercase',
  };
}

export class HUD {
  private root: HTMLElement;

  // Score
  private scoreLabel: HTMLElement;
  private scoreValue: HTMLElement;

  // Zone
  private zoneLabel: HTMLElement;
  private zoneValue: HTMLElement;

  // Combo panel
  private comboPanel: HTMLElement;
  private comboLabel: HTMLElement;
  private comboMultiplier: HTMLElement;
  private comboTrickList: HTMLElement;
  private comboScore: HTMLElement;

  // Trick flash
  private trickFlash: HTMLElement;
  private trickFlashTimer: ReturnType<typeof setTimeout> | null = null;

  // Speed bar
  private speedLabel: HTMLElement;
  private speedBarOuter: HTMLElement;
  private speedBarInner: HTMLElement;

  // Challenge panel
  private challengePanel: HTMLElement;
  private challengeLabel: HTMLElement;
  private challengeName: HTMLElement;
  private challengeProgress: HTMLElement;

  constructor() {
    const hud = document.getElementById('hud');
    if (!hud) throw new Error('HUD container #hud not found in DOM');
    this.root = hud;

    // ---- Score (top-left) ----
    const scoreBlock = document.createElement('div');
    Object.assign(scoreBlock.style, {
      position: 'absolute',
      top: '16px',
      left: '16px',
    });

    this.scoreLabel = document.createElement('span');
    Object.assign(this.scoreLabel.style, labelStyle());
    this.scoreLabel.textContent = 'SCORE';

    this.scoreValue = document.createElement('div');
    Object.assign(this.scoreValue.style, {
      fontFamily: FONT_STACK,
      fontSize: '40px',
      color: COLORS.orange,
      textShadow: `3px 3px 0 #7a2d00, 6px 6px 0 rgba(0,0,0,0.4)`,
      lineHeight: '1',
    });
    this.scoreValue.textContent = '0';

    scoreBlock.appendChild(this.scoreLabel);
    scoreBlock.appendChild(this.scoreValue);
    this.root.appendChild(scoreBlock);

    // ---- Zone (top-right) ----
    const zoneBlock = document.createElement('div');
    Object.assign(zoneBlock.style, {
      position: 'absolute',
      top: '16px',
      right: '16px',
      textAlign: 'right',
    });

    this.zoneLabel = document.createElement('span');
    Object.assign(this.zoneLabel.style, labelStyle());
    this.zoneLabel.style.textAlign = 'right';
    this.zoneLabel.textContent = 'ZONE';

    this.zoneValue = document.createElement('div');
    Object.assign(this.zoneValue.style, {
      fontFamily: FONT_STACK,
      fontSize: '16px',
      color: COLORS.green,
      border: `2px solid ${COLORS.green}`,
      borderRadius: '20px',
      padding: '3px 12px',
      display: 'inline-block',
      textShadow: `0 0 8px ${COLORS.green}`,
      boxShadow: `0 0 8px ${COLORS.green}44`,
      letterSpacing: '1px',
    });
    this.zoneValue.textContent = '—';

    zoneBlock.appendChild(this.zoneLabel);
    zoneBlock.appendChild(this.zoneValue);
    this.root.appendChild(zoneBlock);

    // ---- Combo panel (right side, hidden by default) ----
    this.comboPanel = document.createElement('div');
    Object.assign(this.comboPanel.style, {
      position: 'absolute',
      top: '50%',
      right: '16px',
      transform: 'translateY(-50%)',
      textAlign: 'right',
      display: 'none',
      minWidth: '140px',
    });

    this.comboLabel = document.createElement('span');
    Object.assign(this.comboLabel.style, labelStyle());
    this.comboLabel.style.textAlign = 'right';
    this.comboLabel.textContent = 'COMBO';

    this.comboMultiplier = document.createElement('div');
    Object.assign(this.comboMultiplier.style, {
      fontFamily: FONT_STACK,
      fontSize: '36px',
      color: COLORS.pink,
      textShadow: `2px 2px 0 #7a0038, 0 0 12px ${COLORS.pink}`,
      lineHeight: '1',
    });
    this.comboMultiplier.textContent = 'x1';

    this.comboTrickList = document.createElement('div');
    Object.assign(this.comboTrickList.style, {
      fontFamily: FONT_STACK,
      fontSize: '12px',
      color: COLORS.purple,
      lineHeight: '1.5',
      marginTop: '6px',
      maxHeight: '120px',
      overflowY: 'hidden',
    });

    this.comboScore = document.createElement('div');
    Object.assign(this.comboScore.style, {
      fontFamily: FONT_STACK,
      fontSize: '18px',
      color: COLORS.blue,
      textShadow: `0 0 8px ${COLORS.blue}`,
      marginTop: '4px',
    });
    this.comboScore.textContent = '0 pts';

    this.comboPanel.appendChild(this.comboLabel);
    this.comboPanel.appendChild(this.comboMultiplier);
    this.comboPanel.appendChild(this.comboTrickList);
    this.comboPanel.appendChild(this.comboScore);
    this.root.appendChild(this.comboPanel);

    // ---- Trick flash (center) ----
    this.trickFlash = document.createElement('div');
    Object.assign(this.trickFlash.style, {
      position: 'absolute',
      top: '35%',
      left: '50%',
      transform: 'translateX(-50%) rotate(-3deg)',
      textAlign: 'center',
      pointerEvents: 'none',
      opacity: '0',
      transition: 'opacity 0.15s ease',
      whiteSpace: 'nowrap',
    });

    const trickName = document.createElement('div');
    trickName.className = 'trick-flash-name';
    Object.assign(trickName.style, {
      fontFamily: FONT_STACK,
      fontSize: '48px',
      color: COLORS.orange,
      textShadow: `3px 3px 0 #7a2d00, 6px 6px 0 rgba(0,0,0,0.5), 0 0 20px ${COLORS.orange}`,
      lineHeight: '1',
      letterSpacing: '2px',
      textTransform: 'uppercase',
    });

    const trickPoints = document.createElement('div');
    trickPoints.className = 'trick-flash-points';
    Object.assign(trickPoints.style, {
      fontFamily: FONT_STACK,
      fontSize: '22px',
      color: COLORS.pink,
      textShadow: `2px 2px 0 #7a0038`,
      marginTop: '4px',
      letterSpacing: '1px',
    });

    this.trickFlash.appendChild(trickName);
    this.trickFlash.appendChild(trickPoints);
    this.root.appendChild(this.trickFlash);

    // ---- Speed bar (bottom-left) ----
    const speedBlock = document.createElement('div');
    Object.assign(speedBlock.style, {
      position: 'absolute',
      bottom: '16px',
      left: '16px',
    });

    this.speedLabel = document.createElement('span');
    Object.assign(this.speedLabel.style, labelStyle());
    this.speedLabel.textContent = 'SPEED';

    this.speedBarOuter = document.createElement('div');
    Object.assign(this.speedBarOuter.style, {
      width: '80px',
      height: '8px',
      background: 'rgba(255,255,255,0.1)',
      borderRadius: '4px',
      overflow: 'hidden',
      border: `1px solid ${COLORS.gray}44`,
    });

    this.speedBarInner = document.createElement('div');
    Object.assign(this.speedBarInner.style, {
      height: '100%',
      width: '0%',
      background: 'linear-gradient(to right, #3fb950, #ff6b35)',
      borderRadius: '4px',
      transition: 'width 0.1s linear',
    });

    this.speedBarOuter.appendChild(this.speedBarInner);
    speedBlock.appendChild(this.speedLabel);
    speedBlock.appendChild(this.speedBarOuter);
    this.root.appendChild(speedBlock);

    // ---- Challenge panel (bottom-right, hidden by default) ----
    this.challengePanel = document.createElement('div');
    Object.assign(this.challengePanel.style, {
      position: 'absolute',
      bottom: '16px',
      right: '16px',
      textAlign: 'right',
      display: 'none',
      minWidth: '160px',
    });

    this.challengeLabel = document.createElement('span');
    Object.assign(this.challengeLabel.style, labelStyle());
    this.challengeLabel.style.textAlign = 'right';
    this.challengeLabel.textContent = 'CHALLENGE';

    this.challengeName = document.createElement('div');
    Object.assign(this.challengeName.style, {
      fontFamily: FONT_STACK,
      fontSize: '14px',
      color: COLORS.purple,
      textShadow: `0 0 8px ${COLORS.purple}`,
      marginBottom: '4px',
      lineHeight: '1.2',
    });

    this.challengeProgress = document.createElement('div');
    Object.assign(this.challengeProgress.style, {
      fontFamily: FONT_STACK,
      fontSize: '12px',
      color: COLORS.gray,
      letterSpacing: '1px',
    });

    this.challengePanel.appendChild(this.challengeLabel);
    this.challengePanel.appendChild(this.challengeName);
    this.challengePanel.appendChild(this.challengeProgress);
    this.root.appendChild(this.challengePanel);
  }

  // --- Public API ---

  updateScore(score: number): void {
    this.scoreValue.textContent = score.toLocaleString();
  }

  updateZone(name: string): void {
    this.zoneValue.textContent = name;
  }

  updateCombo(chain: string[], multiplier: number, score: number): void {
    if (chain.length === 0) {
      this.comboPanel.style.display = 'none';
      return;
    }

    this.comboPanel.style.display = 'block';
    this.comboMultiplier.textContent = `x${multiplier}`;
    this.comboScore.textContent = `${score.toLocaleString()} pts`;

    // Show last 6 tricks to avoid overflow
    const visible = chain.slice(-6);
    this.comboTrickList.innerHTML = visible
      .map((t) => `<div>${t}</div>`)
      .join('');
  }

  flashTrick(name: string, points: number): void {
    const nameEl = this.trickFlash.querySelector<HTMLElement>('.trick-flash-name');
    const ptsEl  = this.trickFlash.querySelector<HTMLElement>('.trick-flash-points');

    if (nameEl) nameEl.textContent = name.toUpperCase();
    if (ptsEl)  ptsEl.textContent  = `+${points.toLocaleString()}`;

    // Clear any pending hide timer
    if (this.trickFlashTimer !== null) {
      clearTimeout(this.trickFlashTimer);
      this.trickFlashTimer = null;
    }

    // Force reflow so transition fires even on rapid calls
    this.trickFlash.style.transition = 'none';
    this.trickFlash.style.opacity = '1';
    // Re-enable transition for fade-out
    void this.trickFlash.offsetWidth;
    this.trickFlash.style.transition = 'opacity 0.15s ease';

    this.trickFlashTimer = setTimeout(() => {
      this.trickFlash.style.transition = 'opacity 0.4s ease';
      this.trickFlash.style.opacity = '0';
      this.trickFlashTimer = null;
    }, 800);
  }

  updateSpeed(ratio: number): void {
    const clamped = Math.max(0, Math.min(1, ratio));
    this.speedBarInner.style.width = `${clamped * 100}%`;
  }

  updateChallenge(name: string, progress: number, target: number): void {
    this.challengePanel.style.display = 'block';
    this.challengeName.textContent = name;
    this.challengeProgress.textContent = `${progress} / ${target}`;
  }

  hideChallenge(): void {
    this.challengePanel.style.display = 'none';
  }

  flashNewBest(): void {
    const el = document.createElement('div');
    el.textContent = 'NEW BEST!';
    Object.assign(el.style, {
      position: 'absolute', top: '20%', left: '50%',
      transform: 'translateX(-50%) rotate(-5deg) scale(1)',
      fontFamily: '"Impact", "Arial Black", sans-serif',
      fontSize: '56px', color: '#ffdd00',
      textShadow: '3px 3px 0 #ff6b35, 6px 6px 0 rgba(0,0,0,0.5)',
      letterSpacing: '4px', opacity: '1',
      transition: 'opacity 0.5s ease, transform 0.5s ease',
      pointerEvents: 'none', zIndex: '50',
    });
    this.root.appendChild(el);

    // Animate: scale up then fade out
    requestAnimationFrame(() => {
      el.style.transform = 'translateX(-50%) rotate(-5deg) scale(1.3)';
    });
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(-50%) rotate(-5deg) scale(0.8)';
    }, 1500);
    setTimeout(() => el.remove(), 2200);
  }
}
