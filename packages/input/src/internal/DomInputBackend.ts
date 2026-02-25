import { Unsubscribe } from "@atlasjs/core";
import { BackendInput } from "./BackendInput";
import { Key } from "../public";

export class DomInputBackend {
  private readonly input: BackendInput;
  private off: Unsubscribe[] = [];

  public constructor(input: BackendInput) {
    this.input = input;
  }

  public attach(t: HTMLElement): void {
    const onKeyDown = (e: KeyboardEvent) => {
      this.input.keys.setDown(e.code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      this.input.keys.setUp(e.code);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect: DOMRect = t.getBoundingClientRect();
      const x: number = e.clientX - rect.left;
      const y: number = e.clientY - rect.top;
      this.input.pointer.move(x, y);
    };

    const onPointerDown = (e: PointerEvent) => {
      this.input.pointer.setDown(true);
      if (e.button === 0) this.input.keys.setDown(Key.MouseLeft);
      if (e.button === 2) this.input.keys.setDown(Key.MouseRight);
    };

    const onPointerUp = (e: PointerEvent) => {
      this.input.pointer.setDown(false);
      if (e.button === 0) this.input.keys.setUp(Key.MouseLeft);
      if (e.button === 2) this.input.keys.setUp(Key.MouseRight);
    };

    const onWheel = (e: WheelEvent) => {
      this.input.pointer.wheel(e.deltaY);
    };

    const onBlur = () => {
      this.input.clearAll();
    };

    t.addEventListener("pointermove", onPointerMove);
    t.addEventListener("pointerdown", onPointerDown);
    t.addEventListener("pointerup", onPointerUp);
    t.addEventListener("pointercancel", onPointerUp);
    t.addEventListener("wheel", onWheel, { passive: true });

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    this.off.push(() => t.removeEventListener("pointermove", onPointerMove));
    this.off.push(() => t.removeEventListener("pointerdown", onPointerDown));
    this.off.push(() => t.removeEventListener("pointerup", onPointerUp));
    this.off.push(() => t.removeEventListener("pointercancel", onPointerUp));
    this.off.push(() => t.removeEventListener("wheel", onWheel));

    this.off.push(() => window.removeEventListener("keydown", onKeyDown));
    this.off.push(() => window.removeEventListener("keyup", onKeyUp));
    this.off.push(() => window.removeEventListener("blur", onBlur));
  }

  public detach(): void {
    for (const fn of this.off) {
      fn();
    }
  }
}
