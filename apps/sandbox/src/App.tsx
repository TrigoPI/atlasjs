import { type RefObject, useEffect, useRef } from "react";

import { Engine } from "@atlasjs/core";
import { InputPlugin } from "@atlasjs/input";
import { NebulaPlugin, WebGPURenderer } from "@atlasjs/nebula";
import { InertialPlugin } from "@atlasjs/inertia";
import { RapierPhysicsWorld } from "@atlasjs/rapier";

import { GameScene } from "./game";

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
      .use(rendererPlugin);

    engine.start().then(() => {
      engine.scene.set(new GameScene());
    });

    return () => engine.stop();
  }, []);

  return <canvas ref={mountRef} style={{ width: "100vw", height: "100vh" }} />;
}
