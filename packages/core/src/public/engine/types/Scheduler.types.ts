export type Lane = "fixed" | "update" | "render";

export type StepContext = {
  dt: number;
  alpha: number;
  tick: number;
  frame: number;
  elapsed: number;
};

export type StepFn = (ctx: StepContext) => void;

export type StepSpec = {
  name: string;
  stage: string;
  before?: string | readonly string[];
  after?: string | readonly string[];
  enabled?: boolean;
};

export interface StepHandle {
  readonly name: string;
  readonly lane: Lane;
  remove(): void;
  setEnabled(enabled: boolean): void;
}

export interface StepSet {
  readonly name: string;
  add(lane: Lane, fn: StepFn, spec: StepSpec): StepHandle;
  enable(): void;
  disable(): void;
  remove(): void;
}

export interface LaneScheduler {
  readonly lane: Lane;
  add(fn: StepFn, spec: StepSpec): StepHandle;
}

export type Stage = {
  name: string;
  anchor: number;
};

/** @deprecated Legacy `(dt) => void` callback shape. Use {@link StepFn}. */
export type LegacyStepFn = (dt: number) => void;

/** @deprecated Legacy numeric-priority options. Use {@link StepSpec}. */
export type StepOptions = {
  name: string;
  priority: number;
  id?: number;
};
