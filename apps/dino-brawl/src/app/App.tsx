import { DebugOverlay } from "./DebugOverlay";
import { GameCanvas } from "./GameCanvas";

import { type ReactNode, useState } from "react";

export function App(): ReactNode {
  const [fps, setFps] = useState<number>(0);

  return (
    <div>
      <GameCanvas onFps={setFps} />
      <DebugOverlay fps={fps} />
    </div>
  );
}
