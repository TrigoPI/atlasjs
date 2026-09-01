import type { ReactNode } from "react";

export function ErrorScreen({ message }: { message: string }): ReactNode {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 20,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "16px",
        padding: "24px",
        backgroundColor: "#1a0f14",
        color: "#f4efe1",
        fontFamily: "ui-monospace, 'Courier New', monospace",
      }}
    >
      <h1 style={{ color: "#ff5a5f" }}>Engine crashed</h1>
      <p style={{ maxWidth: "640px", textAlign: "center" }}>
        {message || "Unknown error"}
      </p>
      <p style={{ opacity: 0.6 }}>Check the console for details</p>
    </div>
  );
}
