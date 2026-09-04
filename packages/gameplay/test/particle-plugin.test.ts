import { describe, expect, it } from "vitest";
import { CPUParticleNode, NEBULA_RENDERER } from "@atlasjs/nebula";
import type { NebulaRenderer, Node } from "@atlasjs/nebula";
import { ParticleEmitter, Transform2D } from "../src/components";
import { createHarness } from "./helpers/harness";
import type { Harness } from "./helpers/harness";

function sceneOf(h: Harness): Node {
  const nebula: NebulaRenderer = h.services.get(NEBULA_RENDERER);
  return nebula.scene.root;
}

function particleNodes(h: Harness): Node[] {
  return sceneOf(h)
    .getChildren()
    .filter((node: Node): boolean => node instanceof CPUParticleNode);
}

describe("GameplayPlugin — particles", () => {
  it("exports ParticleEmitter from the barrel", () => {
    expect(typeof ParticleEmitter).toBe("function");
  });

  it("defines the component so addComponent does not throw", async () => {
    const h: Harness = await createHarness();
    const entity = h.world.createEntity();

    expect(() => h.world.addComponent(entity, ParticleEmitter)).not.toThrow();
  });

  it("registers the render step, mounting a node for an emitter", async () => {
    const h: Harness = await createHarness();
    const entity = h.world.createEntity();
    h.world.addComponent(entity, Transform2D);
    h.world.addComponent(entity, ParticleEmitter, {
      config: { rate: 0, maxParticles: 8 },
    });

    expect(particleNodes(h)).toHaveLength(0);

    h.frame();

    expect(particleNodes(h)).toHaveLength(1);
  });

  it("detaches on component removal instead of dropping the particles", async () => {
    const h: Harness = await createHarness();
    const entity = h.world.createEntity();
    h.world.addComponent(entity, Transform2D);
    const emitter: ParticleEmitter = h.world.addComponent(
      entity,
      ParticleEmitter,
      { config: { rate: 0, maxParticles: 8, startLifetime: 100 } },
    );

    h.frame();
    emitter.emit(3);
    h.frame();

    const node: CPUParticleNode = particleNodes(h)[0] as CPUParticleNode;

    expect(node.aliveCount).toEqual(3);

    h.world.destroyEntity(entity);
    h.frame();

    expect(particleNodes(h)).toHaveLength(1);
    expect(node.aliveCount).toEqual(3);
  });
});
