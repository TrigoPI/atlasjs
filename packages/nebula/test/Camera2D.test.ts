import { describe, it, expect } from "vitest";
import { Vec2 } from "@atlasjs/math";

import { Camera2D } from "../src/core/camera/Camera2D";

describe("Camera2D.update", () => {
  it("projects the culled viewport region (origin = position, extent = size / zoom) onto NDC under zoom + pan", () => {
    const width: number = 800;
    const height: number = 600;
    const zoom: number = 2;
    const px: number = 2000;
    const py: number = 500;

    const camera: Camera2D = new Camera2D();
    camera.setPosition(px, py).setZoom(zoom);
    camera.update(width, height);

    // SceneRenderer culls against WebGPURenderer.getCameraViewport():
    //   top-left = position, size = (width, height) / zoom.
    // That region must map exactly onto the NDC box: top-left = (-1, 1),
    // bottom-right = (1, -1), center = (0, 0).
    const topLeft: Vec2 = camera.viewProjection.transformPoint2(px, py);
    const bottomRight: Vec2 = camera.viewProjection.transformPoint2(
      px + width / zoom,
      py + height / zoom,
    );
    const center: Vec2 = camera.viewProjection.transformPoint2(
      px + width / (2 * zoom),
      py + height / (2 * zoom),
    );

    expect(topLeft.x).toBeCloseTo(-1);
    expect(topLeft.y).toBeCloseTo(1);
    expect(bottomRight.x).toBeCloseTo(1);
    expect(bottomRight.y).toBeCloseTo(-1);
    expect(center.x).toBeCloseTo(0);
    expect(center.y).toBeCloseTo(0);
  });
});

describe("Camera2D.screenToWorld / worldToScreen", () => {
  it("screenToWorld maps the screen origin to the camera position", () => {
    const camera: Camera2D = new Camera2D();
    camera.setPosition(100, 50).setZoom(2);

    const world: Vec2 = camera.screenToWorld(new Vec2(0, 0));

    expect(world.x).toBeCloseTo(100);
    expect(world.y).toBeCloseTo(50);
  });

  it("screenToWorld divides the screen offset by the zoom", () => {
    const camera: Camera2D = new Camera2D();
    camera.setPosition(100, 50).setZoom(2);

    const world: Vec2 = camera.screenToWorld(new Vec2(800, 600));

    expect(world.x).toBeCloseTo(100 + 400);
    expect(world.y).toBeCloseTo(50 + 300);
  });

  it("worldToScreen is the inverse of screenToWorld", () => {
    const camera: Camera2D = new Camera2D();
    camera.setPosition(-30, 12).setZoom(3);

    const screen: Vec2 = camera.worldToScreen(new Vec2(70, 42));
    const roundTrip: Vec2 = camera.screenToWorld(screen);

    expect(roundTrip.x).toBeCloseTo(70);
    expect(roundTrip.y).toBeCloseTo(42);
  });

  it("writes into the provided out vector", () => {
    const camera: Camera2D = new Camera2D();
    camera.setPosition(0, 0).setZoom(1);
    const out: Vec2 = new Vec2();

    const result: Vec2 = camera.screenToWorld(new Vec2(5, 9), out);

    expect(result).toBe(out);
    expect(out.x).toBeCloseTo(5);
    expect(out.y).toBeCloseTo(9);
  });
});

describe("Camera2D pixel snapping", () => {
  it("defaults pixelSnap to true", () => {
    const camera: Camera2D = new Camera2D();

    expect(camera.pixelSnap).toBe(true);
  });

  it("snaps the view translation to the device-pixel grid at zoom 1, dpr 1", () => {
    const camera: Camera2D = new Camera2D();
    camera.position.set(100.3, 50.7);
    camera.zoom = 1;
    camera.update(800, 600, 1);

    expect(camera.view.buffer[12]).toBe(-100);
    expect(camera.view.buffer[13]).toBe(-51);
  });

  it("snaps to the finer device-pixel grid at dpr 2", () => {
    const camera: Camera2D = new Camera2D();
    camera.position.set(100.3, 50.7);
    camera.zoom = 1;
    camera.update(800, 600, 2);

    expect(camera.view.buffer[12]).toBeCloseTo(-100.5);
    expect(camera.view.buffer[13]).toBeCloseTo(-50.5);
  });

  it("leaves the translation unsnapped when pixelSnap is false", () => {
    const camera: Camera2D = new Camera2D();
    camera.pixelSnap = false;
    camera.position.set(100.3, 50.7);
    camera.zoom = 1;
    camera.update(800, 600, 1);

    expect(camera.view.buffer[12]).toBeCloseTo(-100.3, 2);
  });
});
