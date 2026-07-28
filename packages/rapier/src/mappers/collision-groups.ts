export function packCollisionGroups(
  membership: number,
  filter: number,
): number {
  return (((membership & 0xffff) << 16) | (filter & 0xffff)) >>> 0;
}
