export type StopLoop = () => void;

export type EngineOptions = {
  fixedDelta?: number;
  maxSubSteps?: number;
};

export type EngineEvents = {
  "engine:start": {};
  "engine:stop": {};
};
