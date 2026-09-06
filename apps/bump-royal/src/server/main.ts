import "./env.ts";

/* The dynamic import is load-bearing. A static import of startServer.ts would hoist the whole
   @atlasjs module graph above env.ts's side effects; it happens to work today only because
   every createLogger call site sits inside a constructor, and would break the day one moves to
   module scope. Deferring the import makes the ordering a guarantee instead of a coincidence. */
const { startServer } = await import("./startServer.ts");

await startServer();
