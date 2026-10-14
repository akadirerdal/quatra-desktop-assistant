import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/core/event-bus';

describe('EventBus', () => {
  it('emits to subscribers', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('test', handler);
    bus.emit('test', 42);
    expect(handler).toHaveBeenCalledWith(42);
  });

  it('unsubscribes correctly', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const off = bus.on('test', handler);
    off();
    bus.emit('test', 1);
    expect(handler).not.toHaveBeenCalled();
  });
});
