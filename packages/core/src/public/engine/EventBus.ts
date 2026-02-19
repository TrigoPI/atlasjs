import {
  EventCallback,
  EventMap,
  EventName,
  EventPayload,
  Unsubscribe,
} from "./types";

export class EventBus<TEvents extends EventMap> {
  private listeners: Map<EventName<TEvents>, Set<EventCallback<any>>>;

  public constructor() {
    this.listeners = new Map<EventName<TEvents>, Set<EventCallback<any>>>();
  }

  public once<K extends EventName<TEvents>>(
    event: K,
    cb: EventCallback<TEvents[K]>,
  ): Unsubscribe {
    const off: Unsubscribe = this.on(event, (payload) => {
      off();
      cb(payload);
    });

    return off;
  }

  public on<K extends EventName<TEvents>>(
    event: K,
    cb: EventCallback<TEvents[K]>,
  ): Unsubscribe {
    let set: Set<EventCallback<any>> | undefined = this.listeners.get(event);

    if (!set) {
      set = new Set<EventCallback<any>>();
      this.listeners.set(event, set);
    }

    set.add(cb as EventCallback<any>);

    return () => {
      const s: Set<EventCallback<any>> | undefined = this.listeners.get(event);

      if (!s) {
        return;
      }

      s.delete(cb);

      if (s.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  public emit<K extends EventName<TEvents>>(
    event: K,
    payload: TEvents[K],
  ): void {
    const set: Set<EventCallback<any>> | undefined = this.listeners.get(event);

    if (!set) {
      return;
    }

    const arr: EventCallback[] = Array.from(set);

    for (let i = 0; i < arr.length; i++) {
      arr[i](payload);
    }
  }

  public emitSafe<K extends EventName<TEvents>>(
    event: K,
    payload: TEvents[K],
    onError?: (err: unknown) => void,
  ): void {
    const set: Set<EventCallback<any>> | undefined = this.listeners.get(event);

    if (!set) {
      return;
    }

    const arr: EventCallback[] = Array.from(set);

    for (const cb of arr) {
      try {
        cb(payload);
      } catch (e) {
        onError?.(e);
      }
    }
  }

  public off<T extends EventName<TEvents>>(
    event: T,
    cb: EventCallback<EventPayload<TEvents, T>>,
  ): void {
    const set: Set<EventCallback<any>> | undefined = this.listeners.get(event);
    if (!set) {
      return;
    }

    set.delete(cb);

    if (set.size === 0) {
      this.listeners.delete(event);
    }
  }

  public clear(): void {
    this.listeners.clear();
  }
}
