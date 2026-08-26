import type { Entity } from "@atlasjs/nexus";

import type { AtlasScript } from "./AtlasScript";
import type { GameEntity } from "./GameEntity";

export type PropsOf<T> = T extends AtlasScript<infer P> ? P : {};

export type AttachProps<P> = {
  [K in keyof P]: P[K] extends GameEntity ? Entity : P[K];
};

export type AttachArgs<T> =
  {} extends AttachProps<PropsOf<T>>
    ? [props?: AttachProps<PropsOf<T>>]
    : [props: AttachProps<PropsOf<T>>];
