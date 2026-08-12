import { DebugOverlay } from "./DebugOverlay";
import { ErrorScreen } from "./ErrorScreen";
import { GameCanvas } from "./GameCanvas";
import { LoadingScreen } from "./LoadingScreen";

import {
  type ReactNode,
  type RefObject,
  useCallback,
  useRef,
  useState,
} from "react";

const MIN_LOADING_MS: number = 3000;

type GameStatus = "loading" | "ready" | "error";

export function App(): ReactNode {
  const [fps, setFps] = useState<number>(0);
  const [status, setStatus] = useState<GameStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const startedAt: RefObject<number> = useRef<number>(performance.now());

  const handleReady = useCallback((): void => {
    const elapsed: number = performance.now() - startedAt.current;
    const remaining: number = Math.max(0, MIN_LOADING_MS - elapsed);
    window.setTimeout((): void => {
      setStatus(
        (current: GameStatus): GameStatus =>
          current === "error" ? current : "ready",
      );
    }, remaining);
  }, []);

  const handleError = useCallback((error: unknown): void => {
    setErrorMessage(error instanceof Error ? error.message : String(error));
    setStatus("error");
  }, []);

  return (
    <div>
      <GameCanvas onFps={setFps} onReady={handleReady} onError={handleError} />
      <DebugOverlay fps={fps} />
      {status === "loading" && <LoadingScreen />}
      {status === "error" && <ErrorScreen message={errorMessage} />}
    </div>
  );
}
