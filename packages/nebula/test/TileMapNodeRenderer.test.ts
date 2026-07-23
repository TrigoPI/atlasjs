import { describe, expect, it } from "vitest";
import { Bound, Vec4 } from "@atlasjs/math";
import { TileMapNode } from "../src/graphics/TileMapNode";
import { TileMapNodeRenderer } from "../src/renderers/TileMapNodeRenderer";
import { TileMapBatcher } from "../src/renderers/Batchers";
import { TileMapDrawCommand } from "../src/renderers/DrawCommand";
import { Renderer, Sampler, SpriteBatch, Texture2D } from "../src/core";

function fakeTexture(id: string = "grass", width: number = 256, height: number = 256): Texture2D {
  return { id, __kind: "texture2D", width, height, destroy: (): void => {} } as Texture2D;
}

function fakeRenderer(): Renderer {
  return {
    createSampler: (): Sampler => ({ id: "default-sampler" }) as Sampler,
    createSpriteBatch: (): SpriteBatch => ({}) as SpriteBatch,
  } as unknown as Renderer;
}

describe("TileMapNodeRenderer.collect", () => {
  it("returns null when the node has no texture or no instances", () => {
    const renderer: TileMapNodeRenderer = new TileMapNodeRenderer(fakeRenderer());
    const node: TileMapNode = new TileMapNode();
    node.updateWorldMatrix();

    expect(renderer.collect(node, new Bound(), new Bound())).toBeNull();

    node.texture = fakeTexture();
    expect(renderer.collect(node, new Bound(), new Bound())).toBeNull();
  });

  it("builds one command whose instance model places the tile at its cell footprint", () => {
    const renderer: TileMapNodeRenderer = new TileMapNodeRenderer(fakeRenderer());
    const node: TileMapNode = new TileMapNode();
    node.texture = fakeTexture("grass", 256, 256);
    node.sampler = { id: "smp" } as Sampler;
    node.instances = [
      { x: 128, y: 0, width: 128, height: 128, uvRect: new Vec4(0.5, 0, 0.5, 0.5) },
    ];
    node.updateWorldMatrix();

    const command: TileMapDrawCommand | null = renderer.collect(node, new Bound(), new Bound());
    expect(command).not.toBeNull();
    const cmd: TileMapDrawCommand = command as TileMapDrawCommand;

    expect(cmd.kind).toBe("tilemap");
    expect(cmd.count).toBe(1);
    expect(cmd.models[0].buffer[12]).toBeCloseTo(192, 4);
    expect(cmd.models[0].buffer[13]).toBeCloseTo(64, 4);
    expect(cmd.models[0].buffer[0]).toBeCloseTo(128, 4);
    expect(cmd.models[0].buffer[5]).toBeCloseTo(128, 4);
    expect(cmd.uvRects[0].x).toBeCloseTo(0.5, 4);
  });

  it("orders a higher zIndex node after a lower one", () => {
    const renderer: TileMapNodeRenderer = new TileMapNodeRenderer(fakeRenderer());

    const low: TileMapNode = new TileMapNode();
    low.texture = fakeTexture();
    low.sampler = { id: "smp" } as Sampler;
    low.zIndex = 0;
    low.instances = [{ x: 0, y: 0, width: 16, height: 16, uvRect: new Vec4(0, 0, 1, 1) }];
    low.updateWorldMatrix();

    const high: TileMapNode = new TileMapNode();
    high.texture = fakeTexture();
    high.sampler = { id: "smp" } as Sampler;
    high.zIndex = 5;
    high.instances = [{ x: 0, y: 0, width: 16, height: 16, uvRect: new Vec4(0, 0, 1, 1) }];
    high.updateWorldMatrix();

    const lowCmd: TileMapDrawCommand = renderer.collect(low, new Bound(), new Bound()) as TileMapDrawCommand;
    const highCmd: TileMapDrawCommand = renderer.collect(high, new Bound(), new Bound()) as TileMapDrawCommand;

    expect(highCmd.sortKey).toBeGreaterThan(lowCmd.sortKey);
  });
});

describe("TileMapBatcher", () => {
  it("begins once with the command texture and adds one instance per tile", () => {
    const calls: { begins: number; adds: number } = { begins: 0, adds: 0 };
    const batch: SpriteBatch = {
      begin: (): void => {
        calls.begins++;
      },
      add: (): void => {
        calls.adds++;
      },
    } as unknown as SpriteBatch;

    const batcher: TileMapBatcher = new TileMapBatcher(batch);
    const command: TileMapDrawCommand = {
      kind: "tilemap",
      sortKey: 0,
      batchKey: 0,
      renderState: { blend: "alpha", depthTest: false, cull: "none" },
      texture: fakeTexture(),
      sampler: { id: "smp" } as Sampler,
      tint: new Vec4(1, 1, 1, 1),
      models: [],
      uvRects: [],
      count: 3,
    } as unknown as TileMapDrawCommand;

    batcher.begin(command);
    batcher.add(command);

    expect(calls.begins).toBe(1);
    expect(calls.adds).toBe(3);
  });
});
