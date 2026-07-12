import { SHADER_PROPERTY_SIZES } from "../core-const";
import { VertexAttribute, VertexAttributeFormat } from "../core-types";
import { IDGenerator } from "../utils";

export class VertexBufferLayout {
  private stride: number;
  private attributes: VertexAttribute[];
  private location: number;

  public constructor() {
    this.stride = 0;
    this.location = 0;
    this.attributes = [];
  }

  public getId(): string {
    return IDGenerator.createVertexLayoutId(this);
  }

  public getAttributes(): Readonly<VertexAttribute[]> {
    return this.attributes;
  }

  public getStride(): number {
    return this.stride;
  }

  public addAttribute(type: VertexAttributeFormat): VertexBufferLayout {
    const size: number = SHADER_PROPERTY_SIZES[type];
    const offset: number = this.stride;
    const location: number = this.location;

    this.location++;
    this.stride += size;
    this.attributes.push({ type, location, offset });

    return this;
  }

  public static create(): VertexBufferLayout {
    return new VertexBufferLayout();
  }
}
