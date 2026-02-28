export type StepFn = (dt: number) => void;

export type StepOptions = {
  name: string;
  priority: number;
};

export type Step = StepOptions & {
  fn: StepFn;
};
