import type { ReactNode } from "react";

export function DebugOverlay({ fps }: { fps: number }): ReactNode {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        zIndex: 1,
        color: "white",
        padding: "10px",
      }}
    >
      <span>{fps} fps</span>
    </div>
  );
}
