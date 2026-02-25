import { useEffect, useRef, type RefObject } from "react";

import { Engine } from "@atlasjs/core";
import { InputPlugin } from "@atlasjs/input";
import { AssetPlugin } from "@atlasjs/assets";
import { PickingPlugin } from "@atlasjs/picking";
import { PixiRenderPlugin } from "@atlasjs/pixi";

import { Window } from "./Window";
import { TestScene } from "./scene/TestScene";

export function App() {
  const mountRef: RefObject<HTMLDivElement | null> =
    useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const engine: Engine = new Engine();

    const mount: HTMLElement = mountRef.current || document.body;
    const backgroundColor: number = 0x2d3436;
    const rendererPlugin: PixiRenderPlugin = new PixiRenderPlugin({
      mount,
      backgroundColor,
    });

    const inputPlugin: InputPlugin = new InputPlugin({
      target: mountRef.current || document.body,
    });

    const pickingPlugin: PickingPlugin = new PickingPlugin();
    const assetPlugin: AssetPlugin = new AssetPlugin();

    assetPlugin.setOrder(0);
    inputPlugin.setOrder(0);
    rendererPlugin.setOrder(1);
    pickingPlugin.setOrder(2);

    engine
      .use(assetPlugin)
      .use(rendererPlugin)
      .use(inputPlugin)
      .use(pickingPlugin);

    engine.start().then(() => {
      engine.scene.set(new TestScene());
    });

    return () => engine.stop();
  }, []);

  return (
    <div>
      <Window ref={mountRef} style={{ width: "100vw", height: "100vh" }} />
    </div>
  );
}
