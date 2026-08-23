import { Renderer, SpriteBatch, ShapeBatch, TrailBatch } from "../core";
import { Batcher } from "./NodeRenderer";
import {
  DrawCommand,
  SpriteDrawCommand,
  ShapeDrawCommand,
  TileMapDrawCommand,
  TrailDrawCommand,
} from "./DrawCommand";

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

export class TileMapBatcher implements Batcher {
  private readonly batch: SpriteBatch;

  public constructor(batch: SpriteBatch) {
    this.batch = batch;
  }

  public begin(command: DrawCommand): void {
    const c: TileMapDrawCommand = command as TileMapDrawCommand;
    this.batch.begin(c.texture, c.sampler, c.renderState);
  }

  public add(command: DrawCommand): void {
    const c: TileMapDrawCommand = command as TileMapDrawCommand;
    for (let i: number = 0; i < c.count; i++) {
      this.batch.add(c.models[i], c.uvRects[i], c.tint);
    }
  }

  public draw(renderer: Renderer): void {
    renderer.drawInstancedBatch(this.batch);
  }
}

export class TrailBatcher implements Batcher {
  private readonly batch: TrailBatch;

  public constructor(batch: TrailBatch) {
    this.batch = batch;
  }

  public begin(command: DrawCommand): void {
    const c: TrailDrawCommand = command as TrailDrawCommand;
    this.batch.begin(c.renderState);
  }

  public add(command: DrawCommand): void {
    const c: TrailDrawCommand = command as TrailDrawCommand;

    for (let i: number = 0; i < c.pointCount - 1; i++) {
      this.batch.add(
        c.positions[i],
        c.positions[i + 1],
        c.edges[i],
        c.edges[i + 1],
        c.colors[i],
        c.colors[i + 1],
      );
    }
  }

  public draw(renderer: Renderer): void {
    renderer.drawInstancedBatch(this.batch);
  }
}
