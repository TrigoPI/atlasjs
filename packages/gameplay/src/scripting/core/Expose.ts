import { getCtorMetadata } from "./SymbolMetadata";

export interface ExposeOptions {}
export type ExposedMetadata = Map<string, ExposeOptions>;

export type FieldDecorator<This = unknown> = (
  value: undefined,
  context: ClassFieldDecoratorContext<This>,
) => void;

const EXPOSED: unique symbol = Symbol("atlas.exposed");

export function Expose(options: ExposeOptions = {}): FieldDecorator {
  return (_: undefined, context: ClassFieldDecoratorContext): void => {
    if (context.private) {
      throw new Error(
        "[@Expose] private (#) fields cannot be exposed; use a soft-private field.",
      );
    }

    const metadata: Record<symbol, ExposedMetadata | undefined> =
      context.metadata as Record<symbol, ExposedMetadata | undefined>;

    let store: ExposedMetadata | undefined = metadata[EXPOSED];

    if (!Object.prototype.hasOwnProperty.call(metadata, EXPOSED)) {
      store = new Map<string, ExposeOptions>(store);
      metadata[EXPOSED] = store;
    }

    (store as ExposedMetadata).set(context.name as string, options);
  };
}

export function getExposedFields(ctor: Function): ExposedMetadata {
  const metadata: Record<symbol, ExposedMetadata | undefined> | undefined =
    getCtorMetadata<Record<symbol, ExposedMetadata | undefined>>(ctor);
  return new Map<string, ExposeOptions>(metadata?.[EXPOSED] ?? []);
}
