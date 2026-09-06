const MS_PER_SECOND: number = 1000;

/* Seconds, monotonic. SnapshotBuffer works in seconds and never reads a clock itself, so this
   is the single place the browser's one enters the online client. */
export function nowSeconds(): number {
  return performance.now() / MS_PER_SECOND;
}
