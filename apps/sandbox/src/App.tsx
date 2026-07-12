import { type RefObject, useEffect, useRef } from "react";

import { Engine } from "@atlasjs/core";
import { InputPlugin } from "@atlasjs/input";
import { NexusPlugin } from "@atlasjs/nexus";
import { InertialPlugin } from "@atlasjs/inertia";
import { RapierPhysicsWorld } from "@atlasjs/rapier";
import { GameplayPlugin } from "@atlasjs/gameplay";
import { NebulaPlugin, WebGPURenderer } from "@atlasjs/nebula";

import { EcsScene } from "./game";

export function App() {
  const mountRef: RefObject<HTMLCanvasElement | null> =
    useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const engine: Engine = new Engine();
    const mount: HTMLCanvasElement | null = mountRef.current;

    if (!mount) {
      throw new Error("Mount element not found");
    }

    mount.width = window.innerWidth;
    mount.height = window.innerHeight;

    const renderer: WebGPURenderer = new WebGPURenderer(mount);
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
      .use(inputPlugin)
      .use(inertiaPlugin)
      .use(rendererPlugin)
      .use(nexusPlugin)
      .use(gameplayPlugin);

    engine.start().then(() => {
      engine.scene.set(new EcsScene());
    });

    return () => engine.stop();
  }, []);

  return <canvas ref={mountRef} style={{ width: "100vw", height: "100vh" }} />;
}
