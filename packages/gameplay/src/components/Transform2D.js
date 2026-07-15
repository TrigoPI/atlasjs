import { Vec2 } from "@atlasjs/math";
export class Transform2D {
    position;
    scale;
    rotation;
    constructor() {
        this.position = new Vec2(0, 0);
        this.scale = new Vec2(1, 1);
        this.rotation = 0;
    }
}
//# sourceMappingURL=Transform2D.js.map