// Mock canvas getContext
HTMLCanvasElement.prototype.getContext = function () {
  return {
    fillRect: () => {},
    clearRect: () => {},
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      data: new Array(w * h * 4),
    }),
    putImageData: () => {},
    createImageData: () => [],
    setTransform: () => {},
    drawImage: () => {},
    save: () => {},
    fillText: () => {},
    restore: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    stroke: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    arc: () => {},
    fill: () => {},
    measureText: () => ({ width: 0 }),
    transform: () => {},
    rect: () => {},
    clip: () => {},
  } as unknown as RenderingContext
} as typeof HTMLCanvasElement.prototype.getContext

// Mock requestAnimationFrame / cancelAnimationFrame
let rafId = 0
globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
  rafId++
  setTimeout(() => cb(performance.now()), 0)
  return rafId
}

globalThis.cancelAnimationFrame = (_id: number): void => {
  // no-op in test environment
}
