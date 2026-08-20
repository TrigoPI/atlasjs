export type StopLoop = () => void;

export type LoopFactory = (onTick: (dt: number) => void) => StopLoop;

export type EngineOptions = {
  fixedDelta?: number;
  maxSubSteps?: number;
  loop?: LoopFactory;
  /** Initial speed of the simulation; 1 is real time, 0 is frozen. */
  timeScale?: number;
  /** Milliseconds to wait for all plugins to become ready before failing boot. */
  bootTimeout?: number;
};

export type EngineEvents = {
  "engine:start": {};
  "engine:stop": {};
};
