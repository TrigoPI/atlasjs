export type StepFn = (dt: number) => void;

export type StepOptions = {
  name: string;
  priority: number;
  id?: number;
};

export type Step = {
  fn: StepFn;
  name: string;
  priority: number;
};
