import { AtlasScript, Camera, InputApi, Key } from "@atlasjs/gameplay";

export class CameraZoomScript extends AtlasScript {
  private input: InputApi;
  private zoom: number;
  private camera: Camera;

  public onCreate(): void {
    this.input = this.getService(InputApi);
    this.camera = this.requireComponent(Camera);
    this.zoom = 1;
  }

  public onUpdate(): void {
    if (this.input.isPressed(Key.R)) {
      this.zoom = 1;
    }

    const scrollDelta: number = this.input.scrollDelta * 0.001;
    this.zoom += scrollDelta;

    const x: number = this.zoom - 1;
    const zoomPower: number = Math.min(Math.pow(Math.E, x), 1000);
    const smoothZoom: number = (this.camera.zoom - zoomPower) * 0.2;

    this.camera.zoom -= smoothZoom;
  }
}
