import { useEffect, useRef, type RefObject } from "react";

import { Engine } from "@atlasjs/core";
import { InputPlugin } from "@atlasjs/input";
import { AssetPlugin } from "@atlasjs/assets";
import { NebulaPlugin, WebGPURenderer } from "@atlasjs/nebula";

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

    const assetPlugin: AssetPlugin = new AssetPlugin();
    const renderer: WebGPURenderer = new WebGPURenderer(mount);
    const rendererPlugin: NebulaPlugin = new NebulaPlugin(renderer);

    const inputPlugin: InputPlugin = new InputPlugin({
      target: mountRef.current || document.body,
    });

    engine.use(assetPlugin).use(inputPlugin).use(rendererPlugin);

    engine.start().then(() => {
      engine.scene.set(new GameScene());
    });

    return () => engine.stop();
  }, []);

  return <canvas ref={mountRef} style={{ width: "100vw", height: "100vh" }} />;
}
