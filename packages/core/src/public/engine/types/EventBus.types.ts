export type Unsubscribe = () => void;
export type EventMap = Record<string, unknown>;
export type EventName<T extends EventMap> = keyof T & string;
export type EventCallback<T = any> = (payload: T) => void;

export type EventPayload<
  T extends EventMap,
  E extends EventName<T>,
> = EventCallback<T[E]>;
