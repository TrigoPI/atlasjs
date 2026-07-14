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
