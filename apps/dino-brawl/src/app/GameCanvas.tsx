import { type ReactNode, type RefObject, useEffect, useRef } from "react";

import { Engine } from "@atlasjs/core";
import { AssetPlugin } from "@atlasjs/assets";
import { InputPlugin } from "@atlasjs/input";
import { NexusPlugin } from "@atlasjs/nexus";
import { InertialPlugin } from "@atlasjs/inertia";
import { RapierPhysicsWorld } from "@atlasjs/rapier";
import { GameplayPlugin } from "@atlasjs/gameplay";
import { NebulaPlugin } from "@atlasjs/nebula";
import { WebGPURenderer } from "@atlasjs/nebula-webgpu";

import { ArenaScene } from "../game";
import { throttle } from "../utils";

export function GameCanvas({ onFps }: { onFps: (fps: number) => void }): ReactNode {
  const mountRef: RefObject<HTMLCanvasElement | null> =
    useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const engine: Engine = new Engine();
    const mount: HTMLCanvasElement | null = mountRef.current;

    if (!mount) {
      throw new Error("Mount element not found");
    }

    const renderer: WebGPURenderer = new WebGPURenderer(mount);
    const assetPlugin: AssetPlugin = new AssetPlugin();
    const rendererPlugin: NebulaPlugin = new NebulaPlugin(renderer);
    const nexusPlugin: NexusPlugin = new NexusPlugin();
    const gameplayPlugin: GameplayPlugin = new GameplayPlugin();

    const rapierWorld: RapierPhysicsWorld = new RapierPhysicsWorld({ unitsPerMeter: 100 });
    const inertiaPlugin: InertialPlugin = new InertialPlugin(rapierWorld);

    const inputPlugin: InputPlugin = new InputPlugin({
      target: mountRef.current || document.body,
    });

    engine
      .use(assetPlugin)
      .use(inputPlugin)
      .use(inertiaPlugin)
      .use(rendererPlugin)
      .use(nexusPlugin)
      .use(gameplayPlugin);

    engine.start().then(() => {
      const cb = throttle((frame: number) => {
        onFps(Math.round(frame));
      }, 250);

      engine.scene.set(new ArenaScene(cb));
    });

    return () => engine.stop();
  }, [onFps]);

  return <canvas ref={mountRef} style={{ width: "100vw", height: "100vh" }} />;
}
