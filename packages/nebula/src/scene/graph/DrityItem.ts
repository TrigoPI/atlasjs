export interface DirtyItem {
  isQueued(): boolean;
  markQueued(): void;
  markUnqueued(): void;
}
