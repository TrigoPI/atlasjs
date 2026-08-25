import { describe, expect, it } from "vitest";

import { Vec2 } from "@atlasjs/math";
import {
  AfterimageRenderer,
  AudioApi,
  CharacterController,
  PlayerInput,
  SpriteRenderer,
  type ScriptContext,
} from "@atlasjs/gameplay";
import type { AudioClip } from "@atlasjs/audio";

import { HurtboxScript } from "../../../../src/game/scripts/combat/HurtboxScript";
import { PlayerDashScript } from "../../../../src/game/scripts/player/PlayerDashScript";

const DISTANCE: number = 220;
const DURATION: number = 0.18;

class FakeVector2Action {
  private value: Vec2 = Vec2.zero();

  public set(x: number, y: number): void {
    this.value = new Vec2(x, y);
  }

  public readValue(): Vec2 {
    return this.value;
  }
}

class FakeButtonAction {
  public pressed: boolean = false;

  public isPressed(): boolean {
    return this.pressed;
  }

  public isDown(): boolean {
    return this.pressed;
  }
}

class FakePlayerInput {
  private readonly actions: Record<string, unknown>;

  public constructor(actions: Record<string, unknown>) {
    this.actions = actions;
  }

  public get(name: string): unknown {
    return this.actions[name];
  }
}

class FakeCharacter {
  public readonly moves: Vec2[] = [];
  public readonly total: Vec2 = new Vec2();

  public move(delta: Vec2): Vec2 {
    this.moves.push(delta.clone());
    this.total.add(delta);
    return delta;
  }

  public get travelled(): number {
    let sum: number = 0;

    for (const move of this.moves) {
      sum += move.mag();
    }

    return sum;
  }
}

class FakeSpriteRenderer {
  public flipX: boolean = false;
}

type PlayOneShotCall = {
  clip: AudioClip;
  params: { pitch?: number; volume?: number } | undefined;
};

class FakeAudioApi {
  public readonly calls: PlayOneShotCall[] = [];

  public playOneShot(
    clip: AudioClip,
    params?: { pitch?: number; volume?: number },
  ): void {
    this.calls.push({ clip, params });
  }
}

class FakeContext {
  private readonly components: Map<unknown, unknown>;
  private readonly services: Map<unknown, unknown>;

  public constructor(
    components: Map<unknown, unknown>,
    services: Map<unknown, unknown>,
  ) {
    this.components = components;
    this.services = services;
  }

  public getEntityId(): number {
    return 1;
  }

  public getComponent(type: unknown): unknown {
    return this.components.get(type);
  }

  public getService(type: unknown): unknown {
    return this.services.get(type);
  }
}

type RigOptions = {
  afterimages?: AfterimageRenderer | null;
  woosh?: AudioClip | null;
  hurtbox?: HurtboxScript | null;
  audio?: FakeAudioApi | null;
  overrides?: Record<string, unknown>;
};

type Rig = {
  script: PlayerDashScript;
  move: FakeVector2Action;
  dash: FakeButtonAction;
  character: FakeCharacter;
  sprite: FakeSpriteRenderer;
  afterimages?: AfterimageRenderer;
  hurtbox?: HurtboxScript;
  audio?: FakeAudioApi;
  clip?: AudioClip;
  /** Runs one frame, then consumes the button edge as the runtime would. */
  frame: (dt: number) => void;
  frames: (count: number, dt: number) => void;
};

function createRig(options: RigOptions = {}): Rig {
  const script: PlayerDashScript = new PlayerDashScript();

  const move: FakeVector2Action = new FakeVector2Action();
  const dash: FakeButtonAction = new FakeButtonAction();
  const character: FakeCharacter = new FakeCharacter();
  const sprite: FakeSpriteRenderer = new FakeSpriteRenderer();

  const afterimages: AfterimageRenderer | undefined =
    options.afterimages === null
      ? undefined
      : (options.afterimages ?? new AfterimageRenderer());

  const hurtbox: HurtboxScript | undefined =
    options.hurtbox === null
      ? undefined
      : (options.hurtbox ?? new HurtboxScript());

  const audio: FakeAudioApi | undefined =
    options.audio === null ? undefined : (options.audio ?? new FakeAudioApi());

  const clip: AudioClip | undefined =
    options.woosh === null
      ? undefined
      : (options.woosh ?? ({} as unknown as AudioClip));

  const injected: Record<string, unknown> = script as unknown as Record<
    string,
    unknown
  >;

  injected.afterimages = afterimages;
  injected.woosh = clip;
  injected.hurtbox = hurtbox;

  const overrides: Record<string, unknown> = options.overrides ?? {};

  for (const key of Object.keys(overrides)) {
    injected[key] = overrides[key];
  }

  const components: Map<unknown, unknown> = new Map<unknown, unknown>();
  const services: Map<unknown, unknown> = new Map<unknown, unknown>();

  components.set(PlayerInput, new FakePlayerInput({ move, dash }) as unknown);
  components.set(CharacterController, character as unknown);
  components.set(SpriteRenderer, sprite as unknown);

  if (audio !== undefined) {
    services.set(AudioApi, audio as unknown);
  }

  script.__bindContext(
    new FakeContext(components, services) as unknown as ScriptContext,
  );

  script.onCreate();

  const frame = (dt: number): void => {
    script.onUpdate(dt);
    dash.pressed = false;
  };

  return {
    script,
    move,
    dash,
    character,
    sprite,
    afterimages,
    hurtbox,
    audio,
    clip,
    frame,
    frames: (count: number, dt: number): void => {
      for (let i: number = 0; i < count; i++) {
        frame(dt);
      }
    },
  };
}

/** Presses the button, then runs the frames that carry the dash to its end. */
function runDash(rig: Rig, steps: number[]): void {
  rig.dash.pressed = true;

  for (const dt of steps) {
    rig.frame(dt);
  }
}

describe("PlayerDashScript trigger and cooldown", () => {
  it("does not dash while the button is never pressed", () => {
    const rig: Rig = createRig();

    rig.frames(20, 0.02);

    expect(rig.script.isDashing).toBe(false);
    expect(rig.character.moves).toHaveLength(0);
  });

  it("dashes on the frame the button is pressed", () => {
    const rig: Rig = createRig();

    rig.dash.pressed = true;
    rig.frame(0.02);

    expect(rig.script.isDashing).toBe(true);
    expect(rig.character.moves).toHaveLength(1);
  });

  it("refuses a second dash while the first one is still running", () => {
    const rig: Rig = createRig();

    rig.dash.pressed = true;
    rig.frame(0.02);

    const travelled: number = rig.character.travelled;

    rig.dash.pressed = true;
    rig.frame(0.02);

    // A restart would reset the progress and re-cover the whole distance.
    expect(rig.character.travelled).toBeGreaterThan(travelled);
    expect(rig.character.travelled).toBeLessThan(DISTANCE);
  });

  it("refuses a new dash while the cooldown has not elapsed", () => {
    const rig: Rig = createRig();

    runDash(rig, [DURATION, 0.02]);
    expect(rig.script.isDashing).toBe(false);

    const moves: number = rig.character.moves.length;

    rig.dash.pressed = true;
    rig.frame(0.02);

    expect(rig.script.isDashing).toBe(false);
    expect(rig.character.moves).toHaveLength(moves);
  });

  it("counts the cooldown from the start of the dash, not from its end", () => {
    const rig: Rig = createRig();

    runDash(rig, [DURATION, 0.02]);

    // 0.20s of dash then 0.50s idle: past the cooldown counted from the
    // start, still inside it if it were counted from the end.
    rig.frames(5, 0.1);

    rig.dash.pressed = true;
    rig.frame(0.02);

    expect(rig.script.isDashing).toBe(true);
  });

  it("allows a new dash once the cooldown has elapsed", () => {
    const rig: Rig = createRig();

    runDash(rig, [DURATION, 0.02]);
    rig.frames(10, 0.1);

    rig.character.moves.length = 0;

    rig.dash.pressed = true;
    rig.frame(0.06);
    rig.frame(0.06);
    rig.frame(0.06);

    expect(rig.character.moves).toHaveLength(3);
    expect(rig.character.moves[0].x).toBeCloseTo(DISTANCE / 3, 10);
    expect(rig.character.travelled).toBeCloseTo(DISTANCE, 10);
  });

  it("keeps blocking a restart while dashing, even with no cooldown", () => {
    const rig: Rig = createRig({ overrides: { cooldown: 0 } });

    rig.move.set(1, 0);

    for (let i: number = 0; i < 4; i++) {
      rig.dash.pressed = true;
      rig.frame(0.05);
    }

    expect(rig.character.moves).toHaveLength(4);
    expect(rig.character.travelled).toBeCloseTo(DISTANCE, 10);
  });

  it("keeps refusing while the cooldown is still counting down", () => {
    const rig: Rig = createRig();

    runDash(rig, [DURATION, 0.02]);
    rig.frames(3, 0.1);

    rig.dash.pressed = true;
    rig.frame(0.02);

    expect(rig.script.isDashing).toBe(false);
  });
});

describe("PlayerDashScript direction", () => {
  it("dashes along the normalized move input", () => {
    const rig: Rig = createRig();

    rig.move.set(3, 4);
    runDash(rig, [DURATION]);

    expect(rig.character.total.x).toBeCloseTo(DISTANCE * 0.6, 10);
    expect(rig.character.total.y).toBeCloseTo(DISTANCE * 0.8, 10);
    expect(rig.sprite.flipX).toBe(false);
  });

  it("locks the direction at the trigger, ignoring a move that changes", () => {
    const rig: Rig = createRig();

    rig.move.set(1, 0);
    rig.dash.pressed = true;
    rig.frame(0.06);

    rig.move.set(0, -1);
    rig.frame(0.06);
    rig.move.set(-1, 0);
    rig.frame(0.06);

    expect(rig.character.total.x).toBeCloseTo(DISTANCE, 10);
    expect(rig.character.total.y).toBeCloseTo(0, 10);

    for (const move of rig.character.moves) {
      expect(move.x).toBeGreaterThan(0);
      expect(move.y).toBeCloseTo(0, 10);
    }
  });

  it("falls back to the facing direction when no move input is held", () => {
    const rig: Rig = createRig();

    runDash(rig, [DURATION]);

    expect(rig.character.total.x).toBeCloseTo(DISTANCE, 10);
    expect(rig.character.total.y).toBeCloseTo(0, 10);
  });

  it("falls back to the left when the sprite is flipped", () => {
    const rig: Rig = createRig();

    rig.sprite.flipX = true;
    runDash(rig, [DURATION]);

    expect(rig.character.total.x).toBeCloseTo(-DISTANCE, 10);
    expect(rig.character.total.y).toBeCloseTo(0, 10);
    expect(rig.sprite.flipX).toBe(true);
  });

  it("exposes the locked direction without copying it per frame", () => {
    const rig: Rig = createRig();

    rig.move.set(0, 2);
    rig.dash.pressed = true;

    const before: Vec2 = rig.script.dashDirection;
    rig.frame(0.02);

    expect(rig.script.dashDirection).toBe(before);
    expect(rig.script.dashDirection.x).toBeCloseTo(0, 10);
    expect(rig.script.dashDirection.y).toBeCloseTo(1, 10);
  });
});

describe("PlayerDashScript distance", () => {
  it("covers exactly the dash distance over uneven frames", () => {
    const rig: Rig = createRig();

    rig.move.set(1, 0);
    runDash(rig, [0.003, 0.05, 0.011, 0.09, 0.004, 0.031]);

    expect(rig.character.travelled).toBeCloseTo(DISTANCE, 10);
    expect(rig.character.total.x).toBeCloseTo(DISTANCE, 10);
  });

  it("covers exactly the dash distance over tiny frames", () => {
    const rig: Rig = createRig();

    rig.move.set(1, 0);
    rig.dash.pressed = true;
    rig.frames(400, 0.001);

    expect(rig.character.travelled).toBeCloseTo(DISTANCE, 10);
  });

  it("does not overshoot when one frame is longer than the whole dash", () => {
    const rig: Rig = createRig();

    rig.move.set(1, 0);
    runDash(rig, [5]);

    expect(rig.character.moves).toHaveLength(1);
    expect(rig.character.total.x).toBeCloseTo(DISTANCE, 10);
    expect(rig.character.total.x).toBeLessThanOrEqual(DISTANCE + 1e-9);
  });

  it("does not overshoot when a big frame lands mid-dash", () => {
    const rig: Rig = createRig();

    rig.move.set(1, 0);
    runDash(rig, [0.05, 10]);

    expect(rig.character.total.x).toBeCloseTo(DISTANCE, 10);
    expect(rig.character.total.x).toBeLessThanOrEqual(DISTANCE + 1e-9);
  });

  it("stops moving once the dash is over", () => {
    const rig: Rig = createRig();

    rig.move.set(1, 0);
    runDash(rig, [DURATION]);

    const moves: number = rig.character.moves.length;
    rig.frames(20, 0.02);

    expect(rig.character.moves).toHaveLength(moves);
    expect(rig.character.travelled).toBeCloseTo(DISTANCE, 10);
  });

  it("honours an overridden distance and duration", () => {
    const rig: Rig = createRig({ overrides: { distance: 50, duration: 0.5 } });

    rig.move.set(1, 0);
    runDash(rig, [0.2, 0.1, 0.3]);

    expect(rig.character.total.x).toBeCloseTo(50, 10);
  });
});

describe("PlayerDashScript isDashing", () => {
  it("is false before the dash", () => {
    const rig: Rig = createRig();

    expect(rig.script.isDashing).toBe(false);
  });

  it("stays true for the whole dash, end frame included", () => {
    const rig: Rig = createRig();

    rig.dash.pressed = true;

    rig.frame(0.06);
    expect(rig.script.isDashing).toBe(true);

    rig.frame(0.06);
    expect(rig.script.isDashing).toBe(true);

    // This frame lands the progress on 1: the dash still owns the frame.
    rig.frame(0.06);
    expect(rig.script.isDashing).toBe(true);

    rig.frame(0.06);
    expect(rig.script.isDashing).toBe(false);
  });

  it("releases the dash after a frame longer than the whole duration", () => {
    const rig: Rig = createRig();

    runDash(rig, [1]);
    expect(rig.script.isDashing).toBe(true);

    rig.frame(0.02);
    expect(rig.script.isDashing).toBe(false);
  });
});

describe("PlayerDashScript afterimages", () => {
  it("stops emitting on create, so a standing player leaves no ghosts", () => {
    const trail: AfterimageRenderer = new AfterimageRenderer({
      emitting: true,
    });

    createRig({ afterimages: trail });

    expect(trail.emitting).toBe(false);
  });

  it("emits for the dash and stops once it is over", () => {
    const rig: Rig = createRig();
    const trail: AfterimageRenderer = rig.afterimages as AfterimageRenderer;

    rig.dash.pressed = true;
    rig.frame(0.06);
    expect(trail.emitting).toBe(true);

    rig.frame(0.06);
    expect(trail.emitting).toBe(true);

    rig.frame(0.06);
    expect(trail.emitting).toBe(true);

    rig.frame(0.06);
    expect(trail.emitting).toBe(false);
  });

  it("leaves the tuning of the component alone", () => {
    const trail: AfterimageRenderer = new AfterimageRenderer({
      interval: 0.03,
      time: 0.4,
      maxImages: 9,
    });

    const rig: Rig = createRig({ afterimages: trail });
    runDash(rig, [DURATION, 0.02]);

    expect(trail.interval).toBe(0.03);
    expect(trail.time).toBe(0.4);
    expect(trail.maxImages).toBe(9);
    expect(trail.command).toBe("none");
  });

  it("dashes without an afterimage component", () => {
    const rig: Rig = createRig({ afterimages: null });

    rig.move.set(1, 0);
    expect(() => runDash(rig, [DURATION, 0.02])).not.toThrow();
    expect(rig.character.total.x).toBeCloseTo(DISTANCE, 10);
  });

  it("stops emitting if the script is destroyed mid-dash", () => {
    const rig: Rig = createRig();
    const trail: AfterimageRenderer = rig.afterimages as AfterimageRenderer;

    rig.dash.pressed = true;
    rig.frame(0.06);
    expect(trail.emitting).toBe(true);

    rig.script.onDestroy();

    expect(trail.emitting).toBe(false);
  });

  it("does nothing on destroy when there is no afterimage component", () => {
    const rig: Rig = createRig({ afterimages: null });

    expect(() => rig.script.onDestroy()).not.toThrow();
  });
});

describe("PlayerDashScript woosh", () => {
  it("plays the woosh once per dash", () => {
    const rig: Rig = createRig();
    const audio: FakeAudioApi = rig.audio as FakeAudioApi;

    runDash(rig, [0.06, 0.06, 0.06, 0.02]);

    expect(audio.calls).toHaveLength(1);
    expect(audio.calls[0].clip).toBe(rig.clip);
  });

  it("varies the pitch from dash to dash", () => {
    const rig: Rig = createRig();
    const audio: FakeAudioApi = rig.audio as FakeAudioApi;
    const pitches: Set<number> = new Set<number>();

    for (let i: number = 0; i < 20; i++) {
      runDash(rig, [DURATION]);
      rig.frames(8, 0.1);
    }

    expect(audio.calls.length).toBeGreaterThan(1);

    for (const call of audio.calls) {
      const pitch: number = call.params?.pitch ?? 0;
      pitches.add(pitch);
      expect(pitch).toBeGreaterThanOrEqual(1 - 0.08);
      expect(pitch).toBeLessThanOrEqual(1 + 0.08);
    }

    expect(pitches.size).toBeGreaterThan(1);
  });

  it("never drops the pitch to zero or below, whatever the jitter", () => {
    const rig: Rig = createRig({
      overrides: { wooshPitch: 0.02, wooshPitchJitter: 5 },
    });
    const audio: FakeAudioApi = rig.audio as FakeAudioApi;

    for (let i: number = 0; i < 20; i++) {
      runDash(rig, [DURATION]);
      rig.frames(8, 0.1);
    }

    expect(audio.calls.length).toBeGreaterThan(1);

    for (const call of audio.calls) {
      expect(call.params?.pitch ?? 0).toBeGreaterThan(0);
    }
  });

  it("dashes silently when no clip was given", () => {
    const rig: Rig = createRig({ woosh: null });
    const audio: FakeAudioApi = rig.audio as FakeAudioApi;

    expect(() => runDash(rig, [DURATION, 0.02])).not.toThrow();
    expect(audio.calls).toHaveLength(0);
  });

  it("dashes silently when no audio service is available", () => {
    const rig: Rig = createRig({ audio: null });

    rig.move.set(1, 0);
    expect(() => runDash(rig, [DURATION, 0.02])).not.toThrow();
    expect(rig.character.total.x).toBeCloseTo(DISTANCE, 10);
  });
});

describe("PlayerDashScript invincibility", () => {
  it("grants invincibility for the length of the dash", () => {
    const rig: Rig = createRig();
    const hurtbox: HurtboxScript = rig.hurtbox as HurtboxScript;

    rig.dash.pressed = true;
    rig.frame(0.01);

    expect(hurtbox.isInvincible).toBe(true);

    hurtbox.onUpdate(DURATION - 0.01);
    expect(hurtbox.isInvincible).toBe(true);

    hurtbox.onUpdate(0.02);
    expect(hurtbox.isInvincible).toBe(false);
  });

  it("grants nothing before the dash starts", () => {
    const rig: Rig = createRig();
    const hurtbox: HurtboxScript = rig.hurtbox as HurtboxScript;

    rig.frames(10, 0.02);

    expect(hurtbox.isInvincible).toBe(false);
  });

  it("dashes without a hurtbox", () => {
    const rig: Rig = createRig({ hurtbox: null });

    rig.move.set(1, 0);
    expect(() => runDash(rig, [DURATION, 0.02])).not.toThrow();
    expect(rig.character.total.x).toBeCloseTo(DISTANCE, 10);
  });
});
