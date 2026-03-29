import { VertexBufferLayout } from "../buffers";
import { SamplerDescriptor, VertexAttribute } from "../core-types";

export class IDGenerator {
  public static createTextureId(): string {
    return crypto.randomUUID();
  }

  public static createSamplerId(descriptor?: SamplerDescriptor): string {
    return `${descriptor?.magFilter ?? "linear"}|${descriptor?.minFilter ?? "linear"}|${descriptor?.addressModeU ?? "clamp-to-edge"}|${descriptor?.addressModeV ?? "clamp-to-edge"}`;
  }

  public static createVertexLayoutId(layout: VertexBufferLayout): string {
    return `${layout.getStride()}|${layout
      .getAttributes()
      .map((a: VertexAttribute) => `${a.location}:${a.type}:${a.offset}`)
      .join("|")}`;
  }
}
