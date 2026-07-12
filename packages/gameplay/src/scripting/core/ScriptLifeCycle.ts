export interface ScriptLifecycle {
  onCreate?(): void;
  onUpdate?(dt: number): void;
  onFixedUpdate?(dt: number): void;
  onDestroy?(): void;
}
