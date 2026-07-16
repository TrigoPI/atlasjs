export interface Asset {
  readonly id: string;
  readonly kind: string;
  dispose(): void;
}
