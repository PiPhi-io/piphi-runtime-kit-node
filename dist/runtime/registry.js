export class RuntimeRegistry {
    maxRecentEvents;
    entries = new Map();
    stateSnapshots = new Map();
    recentEvents = [];
    constructor(maxRecentEvents = 100) {
        this.maxRecentEvents = maxRecentEvents;
    }
    get(entryId) {
        return this.entries.get(entryId);
    }
    set(entryId, entry) {
        this.entries.set(entryId, entry);
        return entry;
    }
    remove(entryId) {
        this.stateSnapshots.delete(entryId);
        const removed = this.entries.get(entryId);
        this.entries.delete(entryId);
        return removed;
    }
    ids() {
        return Array.from(this.entries.keys());
    }
    primaryEntry() {
        return this.entries.values().next().value;
    }
    updateState(entryId, state) {
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
    appendEvent(event) {
        const record = {
            receivedAt: new Date().toISOString(),
            ...event,
        };
        this.recentEvents.push(record);
        if (this.recentEvents.length > this.maxRecentEvents) {
            this.recentEvents.splice(0, this.recentEvents.length - this.maxRecentEvents);
        }
        return record;
    }
}
