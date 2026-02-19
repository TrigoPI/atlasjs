export type ResizeFn = (w: number, h: number, dpr: number) => void;

export type CreateSurfaceOptions = {
  mount: HTMLElement;
  backgroundColor: number;
};
