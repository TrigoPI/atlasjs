import type { ReactNode } from "react";

import "@fontsource/press-start-2p";

import BlueDino from "@assets/sprites/dinos/dino_blue.png";
import EvilDino from "@assets/sprites/dinos/dino_evil.png";
import GreenDino from "@assets/sprites/dinos/dino_green.png";
import RedDino from "@assets/sprites/dinos/dino_red.png";
import YellowDino from "@assets/sprites/dinos/dino_yellow.png";

const DINOS: readonly string[] = [
  GreenDino,
  RedDino,
  BlueDino,
  YellowDino,
  EvilDino,
];

const STYLES: string = `
.dino-loading {
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

.dino-loading::after {
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
  animation: dino-scan 8s linear infinite;
}

.dino-loading__title {
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
  animation: dino-flicker 4.5s steps(1) infinite;
}

.dino-loading__title span {
  color: var(--purple);
  text-shadow:
    0 4px 0 #4a2d8a,
    0 7px 0 rgba(0, 0, 0, 0.35),
    5px 9px 0 rgba(0, 0, 0, 0.25);
}

.dino-loading__stage {
  position: relative;
  width: min(760px, 88vw);
  height: calc(var(--fw) + 28px);
  overflow: hidden;
}

.dino-loading__ground {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 8px;
  background:
    repeating-linear-gradient(
      to right,
      var(--green) 0 24px,
      var(--green-dark) 24px 48px
    );
  box-shadow: 0 -3px 0 rgba(0, 0, 0, 0.4);
}

.dino-loading__track {
  position: absolute;
  bottom: 8px;
  left: 0;
  display: flex;
  align-items: flex-end;
  gap: 64px;
  width: max-content;
  animation: dino-march 7s linear infinite;
}

.dino-loading__dino {
  width: var(--fw);
  height: var(--fw);
  background-repeat: no-repeat;
  background-size: var(--sheet) var(--fw);
  image-rendering: pixelated;
  transform: scaleX(-1);
  animation: dino-run 0.66s steps(6) infinite;
}

@keyframes dino-run {
  from { background-position-x: calc(-4 * var(--fw)); }
  to { background-position-x: calc(-10 * var(--fw)); }
}

@keyframes dino-march {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

@keyframes dino-flicker {
  0%, 92%, 96%, 100% { opacity: 1; }
  94%, 98% { opacity: 0.55; }
}

@keyframes dino-scan {
  from { background-position-y: 0; }
  to { background-position-y: 100px; }
}

.dino-loading__status {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: clamp(9px, 1.6vw, 14px);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  animation: dino-blink 1.1s steps(1) infinite;
}

.dino-loading__dots span {
  animation: dino-dot 1.4s steps(1) infinite;
}

.dino-loading__dots span:nth-child(2) { animation-delay: 0.2s; }
.dino-loading__dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes dino-blink {
  0%, 70% { opacity: 1; }
  71%, 100% { opacity: 0.35; }
}

@keyframes dino-dot {
  0%, 30% { opacity: 0; }
  31%, 100% { opacity: 1; }
}
`;

export function LoadingScreen(): ReactNode {
  const parade: readonly string[] = [...DINOS, ...DINOS];

  return (
    <div className="dino-loading">
      <style>{STYLES}</style>

      <h1 className="dino-loading__title">
        Dino <span>Brawl</span>
      </h1>

      <div className="dino-loading__stage">
        <div className="dino-loading__track">
          {parade.map((src: string, index: number) => (
            <div
              key={index}
              className="dino-loading__dino"
              style={{ backgroundImage: `url(${src})` }}
            />
          ))}
        </div>
        <div className="dino-loading__ground" />
      </div>

      <div className="dino-loading__status">
        <span>Loading</span>
        <span className="dino-loading__dots">
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </div>
    </div>
  );
}
