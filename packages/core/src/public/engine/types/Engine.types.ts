export type StopLoop = () => void;

export type LoopFactory = (onTick: (dt: number) => void) => StopLoop;

export type EngineOptions = {
  fixedDelta?: number;
  maxSubSteps?: number;
  loop?: LoopFactory;
  /** Milliseconds to wait for all plugins to become ready before failing boot. */
  bootTimeout?: number;
};

export type EngineEvents = {
  "engine:start": {};
  "engine:stop": {};
};
