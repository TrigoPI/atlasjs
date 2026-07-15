import { Renderer, SpriteBatch, ShapeBatch } from "../core";
import { DrawCommand, SpriteDrawCommand, ShapeDrawCommand } from "./DrawCommand";
import { Batcher } from "./NodeRenderer";

export class SpriteBatcher implements Batcher {
  private readonly batch: SpriteBatch;

  public constructor(batch: SpriteBatch) {
    this.batch = batch;
  }

  public begin(command: DrawCommand): void {
    const c: SpriteDrawCommand = command as SpriteDrawCommand;
    this.batch.begin(c.texture, c.sampler, c.renderState);
  }

  public add(command: DrawCommand): void {
    const c: SpriteDrawCommand = command as SpriteDrawCommand;
    this.batch.add(c.model, c.uvRect, c.tint);
  }

  public draw(renderer: Renderer): void {
    renderer.drawInstancedBatch(this.batch);
  }
}

export class ShapeBatcher implements Batcher {
  private readonly batch: ShapeBatch;

  public constructor(batch: ShapeBatch) {
    this.batch = batch;
  }

  public begin(command: DrawCommand): void {
    const c: ShapeDrawCommand = command as ShapeDrawCommand;
    this.batch.begin(c.renderState);
  }

  public add(command: DrawCommand): void {
    const c: ShapeDrawCommand = command as ShapeDrawCommand;
    this.batch.add(c.model, c.color, c.params);
  }

  public draw(renderer: Renderer): void {
    renderer.drawInstancedBatch(this.batch);
  }
}
