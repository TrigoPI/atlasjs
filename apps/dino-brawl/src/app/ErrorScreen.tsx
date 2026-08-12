import type { ReactNode } from "react";

import "@fontsource/press-start-2p";

import EvilDino from "@assets/sprites/dinos/dino_evil.png";

const STYLES: string = `
.dino-error {
  --fw: 140px;
  --sheet: 3360px;
  --bg-0: #1a0f14;
  --bg-1: #341824;
  --ink: #f4efe1;
  --red: #ff5a5f;
  --red-dark: #7a1f22;
  --muted: #a89a94;
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 36px;
  padding: 24px;
  box-sizing: border-box;
  overflow: hidden;
  background: radial-gradient(120% 90% at 50% 0%, var(--bg-1) 0%, var(--bg-0) 70%);
  font-family: "Press Start 2P", ui-monospace, "Courier New", monospace;
  color: var(--ink);
  user-select: none;
}

.dino-error::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.3) 0 2px,
    rgba(0, 0, 0, 0) 2px 4px
  );
  mix-blend-mode: multiply;
  animation: dino-error-scan 8s linear infinite;
}

.dino-error__dino {
  width: var(--fw);
  height: var(--fw);
  background-repeat: no-repeat;
  background-size: var(--sheet) var(--fw);
  image-rendering: pixelated;
  animation:
    dino-error-idle 0.5s steps(4) infinite,
    dino-error-shake 0.2s steps(2) infinite;
}

.dino-error__title {
  margin: 0;
  max-width: 90vw;
  font-size: clamp(20px, 5vw, 44px);
  line-height: 1.2;
  letter-spacing: 0.04em;
  text-align: center;
  text-transform: uppercase;
  color: var(--red);
  text-shadow:
    0 4px 0 var(--red-dark),
    0 7px 0 rgba(0, 0, 0, 0.35),
    5px 9px 0 rgba(0, 0, 0, 0.25);
  animation: dino-error-glitch 2.4s steps(1) infinite;
}

.dino-error__message {
  margin: 0;
  max-width: 640px;
  font-size: clamp(9px, 1.6vw, 13px);
  line-height: 1.8;
  letter-spacing: 0.04em;
  text-align: center;
  word-break: break-word;
}

.dino-error__hint {
  margin: 0;
  font-size: clamp(8px, 1.4vw, 11px);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
  animation: dino-error-blink 1.1s steps(1) infinite;
}

@keyframes dino-error-idle {
  from { background-position-x: 0; }
  to { background-position-x: calc(-4 * var(--fw)); }
}

@keyframes dino-error-shake {
  0% { transform: translate(-2px, 0); }
  50% { transform: translate(2px, 1px); }
  100% { transform: translate(-2px, 0); }
}

@keyframes dino-error-glitch {
  0%, 86%, 92%, 100% { opacity: 1; transform: translateX(0); }
  88% { opacity: 0.6; transform: translateX(-3px); }
  90% { opacity: 0.85; transform: translateX(3px); }
}

@keyframes dino-error-scan {
  from { background-position-y: 0; }
  to { background-position-y: 100px; }
}

@keyframes dino-error-blink {
  0%, 70% { opacity: 1; }
  71%, 100% { opacity: 0.35; }
}
`;

export function ErrorScreen({ message }: { message: string }): ReactNode {
  return (
    <div className="dino-error">
      <style>{STYLES}</style>

      <div
        className="dino-error__dino"
        style={{ backgroundImage: `url(${EvilDino})` }}
      />

      <h1 className="dino-error__title">Engine Crashed</h1>

      <p className="dino-error__message">{message || "Unknown error"}</p>

      <p className="dino-error__hint">Check the console for details</p>
    </div>
  );
}
