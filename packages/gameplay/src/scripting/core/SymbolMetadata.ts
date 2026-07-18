(Symbol as { metadata?: symbol }).metadata ??= Symbol.for("Symbol.metadata");

export function getCtorMetadata<T>(ctor: Function): T | undefined {
  return (ctor as { [Symbol.metadata]?: T })[Symbol.metadata];
}
