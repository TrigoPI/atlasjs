import type { Texture2D } from "@atlasjs/nebula";

export function fakeTexture(
  id: string = "tex",
  width: number = 64,
  height: number = 32,
): Texture2D {
  return {
    id,
    __kind: "texture2D",
    width,
    height,
    dispose: (): void => {},
  } as unknown as Texture2D;
}
