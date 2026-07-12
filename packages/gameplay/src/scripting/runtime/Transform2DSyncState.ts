import { Transform2DComponent } from "../components";

export class Transform2DSyncState {
  public lastPositionX: number;
  public lastPositionY: number;
  public lastScaleX: number;
  public lastScaleY: number;
  public lastRotation: number;

  public constructor() {
    this.lastPositionX = 0;
    this.lastPositionY = 0;
    this.lastScaleX = 1;
    this.lastScaleY = 1;
    this.lastRotation = 0;
  }

  public capture(component: Transform2DComponent): void {
    this.lastPositionX = component.position.x;
    this.lastPositionY = component.position.y;
    this.lastScaleX = component.scale.x;
    this.lastScaleY = component.scale.y;
    this.lastRotation = component.rotation;
  }
}
