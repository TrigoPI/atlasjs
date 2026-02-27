import { Unsubscribe } from "@atlasjs/core";
import { RenderingSurface, SurfaceResizeCallback } from "./types";

export function createSurface(
  mount: HTMLElement,
  background?: number,
): RenderingSurface {
  mount.style.width = "100%";
  mount.style.height = "100%";
  mount.style.overflow = "hidden";

  const canvas: HTMLCanvasElement = document.createElement("canvas");
  const rect: DOMRect = mount.getBoundingClientRect();
  const width: number = Math.max(1, Math.floor(rect.width));
  const height: number = Math.max(1, Math.floor(rect.height));

  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  mount.appendChild(canvas);

  return {
    mount,
    canvas,
    background,
    width,
    height,
  };
}

export function observeSurfaceResize(
  surface: RenderingSurface,
  onResize: SurfaceResizeCallback,
): Unsubscribe {
  const ro: ResizeObserver = new ResizeObserver(() => {
    const rect: DOMRect = surface.mount.getBoundingClientRect();
    const w: number = Math.max(1, Math.floor(rect.width));
    const h: number = Math.max(1, Math.floor(rect.height));

    surface.width = w;
    surface.height = h;

    onResize(w, h);
  });

  const onWin = (): void => {
    const rect: DOMRect = surface.mount.getBoundingClientRect();
    onResize(Math.floor(rect.width), Math.floor(rect.height));
  };

  ro.observe(surface.mount);
  window.addEventListener("resize", onWin);

  return () => {
    ro.disconnect();
    window.removeEventListener("resize", onWin);
  };
}
