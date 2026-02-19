import { useEffect, useRef, type RefObject } from "react";

import { Engine } from "@atlasjs/core";
import { PixiRenderPlugin } from "@atlasjs/pixi";
import { InputPlugin } from "@atlasjs/input";

import { Window } from "./Window";
import { TestScene } from "./scene/TestScene";

export function App() {
  const mountRef: RefObject<HTMLDivElement | null> =
    useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const engine: Engine = new Engine();

    const rendererPlugin: PixiRenderPlugin = new PixiRenderPlugin({
      mount: mountRef.current || document.body,
      backgroundColor: 0x55efc4,
    });

    const inputPlugin: InputPlugin = new InputPlugin({
      target: mountRef.current || document.body,
    });

    engine.events.on("render:ready", () => {
      engine.scene.set(new TestScene());
    });

    engine.use(rendererPlugin);
    engine.use(inputPlugin);

    engine.start();

    return () => engine.stop();
  }, []);

  return (
    <div>
      <p>AtlasJs sandbox 😈</p>
      <Window ref={mountRef} style={{ width: "720px", height: "480px" }} />
    </div>
  );
}
