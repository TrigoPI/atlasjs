import { RenderSurface } from "@atlasjs/render";
import { Unsubscribe } from "@atlasjs/core";

import { CreateSurfaceOptions, ResizeFn } from "./types";

export function createSurface({
  mount,
  backgroundColor,
}: CreateSurfaceOptions): RenderSurface {
  const dpr: number = getDPR();
  const canvas: HTMLCanvasElement = document.createElement("canvas");

  mount.style.width = "100%";
  mount.style.height = "100%";
  mount.style.overflow = "hidden";

  const rect: DOMRect = mount.getBoundingClientRect();
  const width: number = Math.max(1, Math.floor(rect.width));
  const height: number = Math.max(1, Math.floor(rect.height));

  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  mount.appendChild(canvas);

  return {
    backgroundColor,
    mount,
    canvas,
    width,
    height,
    dpr,
  };
}

export function observeSurfaceResize(
  surface: RenderSurface,
  onResize: ResizeFn,
): Unsubscribe {
  const ro: ResizeObserver = new ResizeObserver(() => {
    const rect: DOMRect = surface.mount.getBoundingClientRect();
    const w: number = Math.max(1, Math.floor(rect.width));
    const h: number = Math.max(1, Math.floor(rect.height));
    const r: number = getDPR();

    surface.width = w;
    surface.height = h;
    surface.dpr = r;

    onResize(w, h, r);
  });

  const onWin = (): void => {
    const rect: DOMRect = surface.mount.getBoundingClientRect();
    onResize(Math.floor(rect.width), Math.floor(rect.height), getDPR());
  };

  ro.observe(surface.mount);
  window.addEventListener("resize", onWin);

  return () => {
    ro.disconnect();
    window.removeEventListener("resize", onWin);
  };
}

function getDPR(): number {
  return window.devicePixelRatio || 1;
}
