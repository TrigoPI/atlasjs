export interface ScriptLifecycle {
  onCreate?(): void;
  onUpdate?(dt: number): void;
  onFixedUpdate?(): void;
  onDestroy?(): void;
}
