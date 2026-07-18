export interface Resource {
  readonly id: string;
  destroy(): void;
}
