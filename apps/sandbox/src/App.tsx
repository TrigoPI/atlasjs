import { useEffect, useRef, type RefObject } from "react";

import { Engine } from "@atlasjs/core";
import { InputPlugin } from "@atlasjs/input";
import { PixiRenderer } from "@atlasjs/pixi";
import { PickingPlugin } from "@atlasjs/picking";
import { AssetPlugin, NebulaPlugin } from "@atlasjs/nebula";

import { Window } from "./Window";
import { TestScene } from "./scene/TestScene";

export function App() {
  const mountRef: RefObject<HTMLDivElement | null> =
    useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const engine: Engine = new Engine();
    const mount: HTMLElement = mountRef.current || document.body;
    const pixiRenderer: PixiRenderer = new PixiRenderer();

    const assetPlugin: AssetPlugin = new AssetPlugin();
    const pickingPlugin: PickingPlugin = new PickingPlugin();

    const rendererPlugin: NebulaPlugin = new NebulaPlugin(pixiRenderer, {
      mount,
      background: 0x000000,
    });

    const inputPlugin: InputPlugin = new InputPlugin({
      target: mountRef.current || document.body,
    });

    assetPlugin.setOrder(0);
    inputPlugin.setOrder(0);
    pickingPlugin.setOrder(0);
    rendererPlugin.setOrder(1);

    engine
      .use(assetPlugin)
      .use(inputPlugin)
      .use(rendererPlugin)
      .use(pickingPlugin);

    engine.start().then(() => {
      engine.scene.set(new TestScene());
    });

    return () => engine.stop();
  }, []);

  return <Window ref={mountRef} style={{ width: "100vw", height: "100vh" }} />;
}
