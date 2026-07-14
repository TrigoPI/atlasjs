import { Renderer, SpriteBatch, ShapeBatch } from "../core";
import { SpriteDrawCommand, ShapeDrawCommand } from "./DrawCommand";

export class SpriteBatcher {
  private readonly batch: SpriteBatch;

  public constructor(batch: SpriteBatch) {
    this.batch = batch;
  }

  public begin(command: SpriteDrawCommand): void {
    this.batch.begin(command.texture, command.sampler, command.renderState);
  }

  public add(command: SpriteDrawCommand): void {
    this.batch.add(command.model, command.uvRect, command.tint);
  }

  public draw(renderer: Renderer): void {
    renderer.drawInstancedBatch(this.batch);
  }
}

export class ShapeBatcher {
  private readonly batch: ShapeBatch;

  public constructor(batch: ShapeBatch) {
    this.batch = batch;
  }

  public begin(command: ShapeDrawCommand): void {
    this.batch.begin(command.renderState);
  }

  public add(command: ShapeDrawCommand): void {
    this.batch.add(command.model, command.color, command.params);
  }

  public draw(renderer: Renderer): void {
    renderer.drawInstancedBatch(this.batch);
  }
}
