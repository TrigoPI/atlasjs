export const FLIP_H: number = 0x80000000;
export const FLIP_V: number = 0x40000000;
export const FLIP_D: number = 0x20000000;
export const GID_MASK: number = 0x1fffffff;

export interface ResolvedGid {
  readonly gid: number;
  readonly flipX: boolean;
  readonly flipY: boolean;
}

export function resolveGid(raw: number): ResolvedGid {
  const u: number = raw >>> 0;
  return {
    gid: u & GID_MASK,
    flipX: (u & FLIP_H) !== 0,
    flipY: (u & FLIP_V) !== 0,
  };
}
