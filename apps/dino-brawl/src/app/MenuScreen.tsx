import { type ReactNode, type RefObject, useEffect, useRef } from "react";

import "@fontsource/press-start-2p";

import GreenDino from "@assets/sprites/dinos/dino_green.png";
import DinoDash from "@assets/audio/dino_dash.mp3";

const STYLES: string = `
.dino-menu {
  --fw: 112px;
  --sheet: 2688px;
  --bg-0: #14101f;
  --bg-1: #221a38;
  --ink: #f4efe1;
  --green: #9be04a;
  --green-dark: #3f6d1c;
  --purple: #a06cff;
  position: fixed;
  inset: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 56px;
  overflow: hidden;
  background:
    radial-gradient(120% 90% at 50% 0%, var(--bg-1) 0%, var(--bg-0) 70%);
  font-family: "Press Start 2P", ui-monospace, "Courier New", monospace;
  color: var(--ink);
  user-select: none;
}

.dino-menu::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.28) 0 2px,
    rgba(0, 0, 0, 0) 2px 4px
  );
  mix-blend-mode: multiply;
  animation: dino-menu-scan 8s linear infinite;
}

.dino-menu__title {
  margin: 0;
  font-size: clamp(22px, 5.5vw, 52px);
  line-height: 1.15;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--green);
  text-shadow:
    0 4px 0 var(--green-dark),
    0 7px 0 rgba(0, 0, 0, 0.35),
    5px 9px 0 rgba(0, 0, 0, 0.25);
  animation: dino-menu-flicker 4.5s steps(1) infinite;
}

.dino-menu__title span {
  color: var(--purple);
  text-shadow:
    0 4px 0 #4a2d8a,
    0 7px 0 rgba(0, 0, 0, 0.35),
    5px 9px 0 rgba(0, 0, 0, 0.25);
}

.dino-menu__dino {
  width: var(--fw);
  height: var(--fw);
  background-repeat: no-repeat;
  background-size: var(--sheet) var(--fw);
  image-rendering: pixelated;
  transform: scaleX(-1);
  animation: dino-menu-run 0.66s steps(6) infinite;
}

.dino-menu__start {
  font-family: inherit;
  cursor: pointer;
  border: none;
  color: var(--bg-0);
  background: var(--green);
  padding: 22px 44px;
  font-size: clamp(14px, 2.6vw, 26px);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  box-shadow:
    0 6px 0 var(--green-dark),
    0 11px 0 rgba(0, 0, 0, 0.35);
  transition: transform 0.06s ease, box-shadow 0.06s ease, filter 0.12s ease;
}

.dino-menu__start:hover {
  filter: brightness(1.08);
}

.dino-menu__start:active {
  transform: translateY(6px);
  box-shadow:
    0 0 0 var(--green-dark),
    0 3px 0 rgba(0, 0, 0, 0.35);
}

@keyframes dino-menu-run {
  from { background-position-x: calc(-4 * var(--fw)); }
  to { background-position-x: calc(-10 * var(--fw)); }
}

@keyframes dino-menu-flicker {
  0%, 92%, 96%, 100% { opacity: 1; }
  94%, 98% { opacity: 0.55; }
}

@keyframes dino-menu-scan {
  from { background-position-y: 0; }
  to { background-position-y: 100px; }
}
`;

export function MenuScreen({ onStart }: { onStart: () => void }): ReactNode {
  const audioRef: RefObject<HTMLAudioElement | null> =
    useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio: HTMLAudioElement = new Audio(DinoDash);
    audioRef.current = audio;
    let disposed: boolean = false;

    const startFallback = (): void => {
      void audio.play().catch((): void => {});
    };

    void audio.play().catch((): void => {
      if (disposed) {
        return;
      }
      window.addEventListener("pointerdown", startFallback, { once: true });
      window.addEventListener("keydown", startFallback, { once: true });
    });

    return (): void => {
      disposed = true;
      window.removeEventListener("pointerdown", startFallback);
      window.removeEventListener("keydown", startFallback);
      audio.pause();
      audio.currentTime = 0;
      audioRef.current = null;
    };
  }, []);

  const handleStart = (): void => {
    const audio: HTMLAudioElement | null = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    onStart();
  };

  return (
    <div className="dino-menu">
      <style>{STYLES}</style>

      <h1 className="dino-menu__title">
        Dino <span>Brawl</span>
      </h1>

      <div
        className="dino-menu__dino"
        style={{ backgroundImage: `url(${GreenDino})` }}
      />

      <button type="button" className="dino-menu__start" onClick={handleStart}>
        Start
      </button>
    </div>
  );
}
