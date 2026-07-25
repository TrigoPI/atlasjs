import { type RefObject, useEffect, useRef, useState } from "react";

import { Engine } from "@atlasjs/core";
import { AssetPlugin } from "@atlasjs/assets";
import { InputPlugin } from "@atlasjs/input";
import { NexusPlugin } from "@atlasjs/nexus";
import { InertialPlugin } from "@atlasjs/inertia";
import { RapierPhysicsWorld } from "@atlasjs/rapier";
import { GameplayPlugin } from "@atlasjs/gameplay";
import { NebulaPlugin } from "@atlasjs/nebula";
import { WebGPURenderer } from "@atlasjs/nebula-webgpu";

import { EcsScene } from "./game";
import { throttle } from "./utils";

export function App() {
  const [fps, setFps] = useState<number>(0);
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

    // prettier-ignore
    const rapierWorld: RapierPhysicsWorld = new RapierPhysicsWorld({ unitsPerMeter: 100 });
    const inertiaPlugin: InertialPlugin = new InertialPlugin(rapierWorld);

    const inputPlugin: InputPlugin = new InputPlugin({
      target: mountRef.current || document.body,
    });

    // prettier-ignore
    engine
      .use(assetPlugin)
      .use(inputPlugin)
      .use(inertiaPlugin)
      .use(rendererPlugin)
      .use(nexusPlugin)
      .use(gameplayPlugin);

    engine.start().then(() => {
      const cb = throttle((frame: number) => {
        setFps(Math.round(frame));
      }, 250);

      engine.scene.set(new EcsScene(cb));
    });

    return () => engine.stop();
  }, []);

  return (
    <div>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: 1,
          color: "white",
          padding: "10px",
        }}
      >
        <span>{fps} fps</span>
      </div>
      <canvas ref={mountRef} style={{ width: "100vw", height: "100vh" }} />;
    </div>
  );
}
