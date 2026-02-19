import { clamp } from "./Time";

export function startRafLoop(onTick: (dt: number) => void): () => void {
  let last: number = performance.now();
  let running: boolean = true;
  let rafId: number | null = null;

  const loop = (t: number) => {
    if (!running) {
      return;
    }

    const dt: number = clamp((t - last) / 1000, 0, 0.25);
    last = t;

    onTick(dt);
    rafId = requestAnimationFrame(loop);
  };

  rafId = requestAnimationFrame(loop);

  return () => {
    running = false;
    if (rafId != null) {
      cancelAnimationFrame(rafId);
    }
  };
}
