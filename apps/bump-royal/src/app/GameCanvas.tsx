import { type ReactNode, type RefObject, useEffect, useRef } from "react";

import { Engine } from "@atlasjs/core";
import { Vec2 } from "@atlasjs/math";
import { AssetPlugin } from "@atlasjs/assets";
import { AudioPlugin } from "@atlasjs/audio";
import { InputPlugin } from "@atlasjs/input";
import { NexusPlugin } from "@atlasjs/nexus";
import { InertialPlugin } from "@atlasjs/inertia";
import { RapierPhysicsWorld } from "@atlasjs/rapier";
import { GameplayPlugin } from "@atlasjs/gameplay";
import { GizmoPlugin } from "@atlasjs/gizmos";
import { NebulaPlugin } from "@atlasjs/nebula";
import { WebGPURenderer } from "@atlasjs/nebula-webgpu";

import { MainScene } from "../game";
import { throttle } from "../utils";

export function GameCanvas({
  onFps,
  onReady,
  onError,
}: {
  onFps: (fps: number) => void;
  onReady?: () => void;
  onError?: (error: unknown) => void;
}): ReactNode {
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
    const audioPlugin: AudioPlugin = new AudioPlugin();
    const rendererPlugin: NebulaPlugin = new NebulaPlugin(renderer);
    const nexusPlugin: NexusPlugin = new NexusPlugin();
    const gameplayPlugin: GameplayPlugin = new GameplayPlugin();
    const gizmoPlugin: GizmoPlugin = new GizmoPlugin({
      showColliders: false,
    });

    // prettier-ignore
    const rapierWorld: RapierPhysicsWorld = new RapierPhysicsWorld({ unitsPerMeter: 100, gravity: new Vec2(0, 0) });
    const inertiaPlugin: InertialPlugin = new InertialPlugin(rapierWorld);

    const inputPlugin: InputPlugin = new InputPlugin({
      target: mount,
    });

    engine
      .use(assetPlugin)
      .use(audioPlugin)
      .use(inputPlugin)
      .use(inertiaPlugin)
      .use(rendererPlugin)
      .use(nexusPlugin)
      .use(gameplayPlugin)
      .use(gizmoPlugin);

    engine
      .start()
      .then(() => {
        const cb = throttle((frame: number) => {
          onFps(Math.round(frame));
        }, 500);

        engine.scene.set(new MainScene(cb, () => onReady?.()));
      })
      .catch((error: unknown) => {
        console.error("Failed to start the engine", error);
        onError?.(error);
      });

    return () => engine.stop();
  }, [onFps, onReady, onError]);

  return <canvas ref={mountRef} style={{ width: "100vw", height: "100vh" }} />;
}
