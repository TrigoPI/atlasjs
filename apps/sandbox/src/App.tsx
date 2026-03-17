import { useEffect, useRef, type RefObject } from "react";

import { Engine } from "@atlasjs/core";
import { InputPlugin } from "@atlasjs/input";
import { PixiRenderer } from "@atlasjs/pixi";
import { EditorPlugin } from "@atlasjs/editor";
import { NebulaPlugin } from "@atlasjs/nebula";
import { AssetPlugin } from "@atlasjs/assets";

import { Window } from "./Window";
import { TestScene } from "./scene/TestScene";
import { GameScene } from "./game";

export function App() {
  const mountRef: RefObject<HTMLDivElement | null> =
    useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const engine: Engine = new Engine();
    const mount: HTMLElement = mountRef.current || document.body;

    const pixiRenderer: PixiRenderer = new PixiRenderer();
    const assetPlugin: AssetPlugin = new AssetPlugin();
    const editorPlugin: EditorPlugin = new EditorPlugin();
    const rendererPlugin: NebulaPlugin = new NebulaPlugin(pixiRenderer, {
      mount,
      background: 0x000000,
    });

    const inputPlugin: InputPlugin = new InputPlugin({
      target: mountRef.current || document.body,
    });

    engine
      .use(assetPlugin)
      .use(inputPlugin)
      .use(rendererPlugin)
      .use(editorPlugin);

    engine.start().then(() => {
      engine.scene.set(new TestScene());
    });

    return () => engine.stop();
  }, []);

  return <Window ref={mountRef} style={{ width: "100vw", height: "100vh" }} />;
}
