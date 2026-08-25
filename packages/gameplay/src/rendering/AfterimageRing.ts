import type { Sprite } from "@atlasjs/nebula";

const MIN_IMAGES: number = 1;
const MAX_IMAGES: number = 64;

export interface AfterimageSlot {
  sprite: Sprite | null;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  age: number;
}

export function resolveAfterimageCapacity(maxImages: number): number {
  const truncated: number = Math.trunc(maxImages);

  if (Number.isNaN(truncated)) {
    return MIN_IMAGES;
  }

  return Math.min(MAX_IMAGES, Math.max(MIN_IMAGES, truncated));
}

function createSlot(): AfterimageSlot {
  return {
    sprite: null,
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    age: 0,
  };
}

export class AfterimageRing {
  private readonly slots: AfterimageSlot[];
  private head: number;
  private tail: number;
  private count: number;

  public constructor(capacity: number) {
    this.slots = [];
    this.head = 0;
    this.tail = 0;
    this.count = 0;
    this.resize(capacity);
  }

  public get capacity(): number {
    return this.slots.length;
  }

  public get size(): number {
    return this.count;
  }

  public resize(capacity: number): void {
    if (this.slots.length === capacity) {
      return;
    }

    while (this.slots.length > capacity) {
      this.slots.pop();
    }

    while (this.slots.length < capacity) {
      this.slots.push(createSlot());
    }

    this.clear();
  }

  public clear(): void {
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }

  public stamp(
    sprite: Sprite | null,
    x: number,
    y: number,
    rotation: number,
    scaleX: number,
    scaleY: number,
  ): void {
    const capacity: number = this.slots.length;
    const slot: AfterimageSlot = this.slots[this.head];

    slot.sprite = sprite;
    slot.x = x;
    slot.y = y;
    slot.rotation = rotation;
    slot.scaleX = scaleX;
    slot.scaleY = scaleY;
    slot.age = 0;

    this.head = (this.head + 1) % capacity;

    if (this.count < capacity) {
      this.count++;
      return;
    }

    this.tail = (this.tail + 1) % capacity;
  }

  public advance(dt: number, maxAge: number): void {
    const capacity: number = this.slots.length;

    for (let i: number = 0; i < this.count; i++) {
      this.slots[(this.tail + i) % capacity].age += dt;
    }

    while (this.count > 0 && this.slots[this.tail].age >= maxAge) {
      this.tail = (this.tail + 1) % capacity;
      this.count--;
    }
  }

  public isAlive(index: number): boolean {
    const capacity: number = this.slots.length;

    return (index - this.tail + capacity) % capacity < this.count;
  }

  public at(index: number): AfterimageSlot {
    return this.slots[index];
  }
}
