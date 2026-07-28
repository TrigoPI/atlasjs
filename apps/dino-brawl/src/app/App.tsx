import { type ReactNode, useState } from "react";

import { DebugOverlay } from "./DebugOverlay";
import { GameCanvas } from "./GameCanvas";

export function App(): ReactNode {
  const [fps, setFps] = useState<number>(0);

  return (
    <div>
      <DebugOverlay fps={fps} />
      <GameCanvas onFps={setFps} />
    </div>
  );
}
