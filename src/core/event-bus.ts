export type EventHandler<T = unknown> = (payload: T) => void;

export class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();

  on<T>(event: string, handler: EventHandler<T>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as EventHandler);
    return () => {
      set?.delete(handler as EventHandler);
    };
  }

  emit<T>(event: string, payload: T): void {
    this.handlers.get(event)?.forEach((h) => {
      (h as EventHandler<T>)(payload);
    });
  }

  clear(): void {
    this.handlers.clear();
  }
}

export const eventBus = new EventBus();
