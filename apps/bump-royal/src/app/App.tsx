import { DebugOverlay } from "./DebugOverlay";
import { ErrorScreen } from "./ErrorScreen";
import { GameCanvas } from "./GameCanvas";

import { type ReactNode, useCallback, useState } from "react";

export function App(): ReactNode {
  const [fps, setFps] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const onError = useCallback((cause: unknown): void => {
    setError(cause instanceof Error ? cause.message : String(cause));
  }, []);

  return (
    <div>
      <GameCanvas onFps={setFps} onError={onError} />
      <DebugOverlay fps={fps} />
      {error !== null ? <ErrorScreen message={error} /> : null}
    </div>
  );
}
