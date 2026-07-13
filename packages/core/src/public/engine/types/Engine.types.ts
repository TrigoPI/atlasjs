export type StopLoop = () => void;

export type LoopFactory = (onTick: (dt: number) => void) => StopLoop;

export type EngineOptions = {
  fixedDelta?: number;
  maxSubSteps?: number;
  loop?: LoopFactory;
};

export type EngineEvents = {
  "engine:start": {};
  "engine:stop": {};
};
