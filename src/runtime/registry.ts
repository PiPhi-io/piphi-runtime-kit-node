/**
 * Small in-memory registry for active runtime entries, latest state, and recent events.
 */
export type RuntimeRegistryEntry<TState extends object> = {
  latestState?: TState;
  lastUpdated?: string;
};

export class RuntimeRegistry<
  TState extends object = Record<string, unknown>,
  TEntry extends RuntimeRegistryEntry<TState> = RuntimeRegistryEntry<TState>,
  TEvent extends object = Record<string, unknown>,
> {
  readonly entries = new Map<string, TEntry>();
  readonly stateSnapshots = new Map<
    string,
    { deviceId: string; state: TState; lastUpdated: string }
  >();
  readonly recentEvents: TEvent[] = [];

  constructor(public readonly maxRecentEvents = 100) {}

  get(entryId: string): TEntry | undefined {
    return this.entries.get(entryId);
  }

  set(entryId: string, entry: TEntry): TEntry {
    this.entries.set(entryId, entry);
    return entry;
  }

  remove(entryId: string): TEntry | undefined {
    this.stateSnapshots.delete(entryId);
    const removed = this.entries.get(entryId);
    this.entries.delete(entryId);
    return removed;
  }

  ids(): string[] {
    return Array.from(this.entries.keys());
  }

  primaryEntry(): TEntry | undefined {
    return this.entries.values().next().value as TEntry | undefined;
  }

  updateState(entryId: string, state: TState): { deviceId: string; state: TState; lastUpdated: string } {
    const lastUpdated = new Date().toISOString();
    const snapshot = { deviceId: entryId, state, lastUpdated };
    this.stateSnapshots.set(entryId, snapshot);

    const entry = this.entries.get(entryId);
    if (entry) {
      entry.latestState = state;
      entry.lastUpdated = lastUpdated;
    }

    return snapshot;
  }

  appendEvent(event: TEvent): TEvent {
    const record = {
      receivedAt: new Date().toISOString(),
      ...event,
    } as TEvent;

    this.recentEvents.push(record);
    if (this.recentEvents.length > this.maxRecentEvents) {
      this.recentEvents.splice(0, this.recentEvents.length - this.maxRecentEvents);
    }
    return record;
  }
}
