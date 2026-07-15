export class WebGPUSurface {
  private readonly canvasElement: HTMLCanvasElement;
  private readonly autoResize: boolean;
  private resizeObserver?: ResizeObserver;
  private width: number;
  private height: number;

  public constructor(canvas: HTMLCanvasElement, autoResize: boolean) {
    this.canvasElement = canvas;
    this.autoResize = autoResize;
    this.width = canvas.width;
    this.height = canvas.height;
  }

  public get canvas(): HTMLCanvasElement {
    return this.canvasElement;
  }

  public get logicalWidth(): number {
    return this.width;
  }

  public get logicalHeight(): number {
    return this.height;
  }

  public startObserving(): void {
    if (!this.autoResize) {
      return;
    }

    this.resize(
      this.canvasElement.clientWidth,
      this.canvasElement.clientHeight,
    );
    this.resizeObserver = new ResizeObserver((entries: ResizeObserverEntry[]) =>
      this.onResizeEntries(entries),
    );
    this.resizeObserver.observe(this.canvasElement);
  }

  public resize(width: number, height: number): void {
    const dpr: number = this.getDevicePixelRatio();
    this.applyResize(
      width,
      height,
      Math.round(width * dpr),
      Math.round(height * dpr),
    );
  }

  public dispose(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
  }

  private applyResize(
    logicalWidth: number,
    logicalHeight: number,
    physicalWidth: number,
    physicalHeight: number,
  ): void {
    const width: number = Math.round(physicalWidth);
    const height: number = Math.round(physicalHeight);

    if (width <= 0 || height <= 0) {
      return;
    }

    this.width = logicalWidth;
    this.height = logicalHeight;
    this.canvasElement.width = width;
    this.canvasElement.height = height;
  }

  private onResizeEntries(entries: ResizeObserverEntry[]): void {
    const entry: ResizeObserverEntry | undefined = entries[0];

    if (!entry) {
      return;
    }

    const contentBox: ResizeObserverSize = Array.isArray(entry.contentBoxSize)
      ? entry.contentBoxSize[0]
      : (entry.contentBoxSize as unknown as ResizeObserverSize);

    const logicalWidth: number = contentBox.inlineSize;
    const logicalHeight: number = contentBox.blockSize;

    const devicePixelBox: ReadonlyArray<ResizeObserverSize> | undefined =
      entry.devicePixelContentBoxSize;

    if (devicePixelBox && devicePixelBox[0]) {
      this.applyResize(
        logicalWidth,
        logicalHeight,
        devicePixelBox[0].inlineSize,
        devicePixelBox[0].blockSize,
      );
      return;
    }

    const dpr: number = this.getDevicePixelRatio();
    this.applyResize(
      logicalWidth,
      logicalHeight,
      Math.round(logicalWidth * dpr),
      Math.round(logicalHeight * dpr),
    );
  }

  private getDevicePixelRatio(): number {
    return typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  }
}
