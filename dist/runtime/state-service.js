/** Minimal state API for publishing cache updates and proving upstream refreshes. */
export class RuntimeStateService {
    registry;
    reader;
    source;
    timeoutMs = 10_000;
    constructor(registry) {
        this.registry = registry;
    }
    provide(reader, options) {
        const source = options.source.trim();
        if (!source)
            throw new TypeError("source must not be empty");
        const timeoutMs = options.timeoutMs ?? 10_000;
        if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
            throw new RangeError("timeoutMs must be positive");
        }
        this.reader = reader;
        this.source = source;
        this.timeoutMs = timeoutMs;
    }
    publish(entryId, state, deviceId) {
        return this.registry.updateState(entryId, state, deviceId);
    }
    get(entryId) {
        const snapshot = this.registry.stateSnapshots.get(entryId);
        return snapshot === undefined
            ? undefined
            : { ...snapshot, state: { ...snapshot.state } };
    }
    async response(options = {}) {
        let receipt;
        if (options.refresh) {
            const requestId = options.refreshRequestId?.trim();
            if (!requestId) {
                throw new TypeError("refreshRequestId is required when refresh is true");
            }
            receipt = await this.refresh(requestId);
        }
        return {
            entries: this.entriesResponse(),
            ...(receipt === undefined ? {} : { refresh: receipt }),
        };
    }
    async refresh(requestId) {
        if (this.reader === undefined || this.source === undefined) {
            return {
                request_id: requestId,
                performed: false,
                status: "unsupported",
                message: "This integration does not support on-demand state refresh.",
            };
        }
        let timeout;
        try {
            await Promise.race([
                Promise.resolve(this.reader()),
                new Promise((_resolve, reject) => {
                    timeout = setTimeout(() => reject(new Error("STATE_REFRESH_TIMEOUT")), this.timeoutMs);
                }),
            ]);
        }
        catch (error) {
            return {
                request_id: requestId,
                performed: false,
                status: "failed",
                source: this.source,
                error: error instanceof Error && error.message === "STATE_REFRESH_TIMEOUT"
                    ? "Upstream state refresh timed out."
                    : `Upstream state refresh failed: ${error instanceof Error ? error.name : "UnknownError"}`,
            };
        }
        finally {
            if (timeout !== undefined)
                clearTimeout(timeout);
        }
        return {
            request_id: requestId,
            performed: true,
            status: "refreshed",
            observed_at: new Date().toISOString(),
            source: this.source,
        };
    }
    entriesResponse() {
        const entries = {};
        const entryIds = new Set([
            ...this.registry.entries.keys(),
            ...this.registry.stateSnapshots.keys(),
        ]);
        for (const entryId of entryIds) {
            const rawEntry = this.registry.entries.get(entryId);
            const raw = rawEntry === undefined
                ? {}
                : { ...rawEntry };
            const outputId = String(raw.config_id ?? raw.configId ?? entryId);
            const entry = {
                config_id: outputId,
                device_id: String(raw.device_id ?? raw.deviceId ?? entryId),
            };
            const snapshot = this.registry.stateSnapshots.get(entryId);
            if (snapshot !== undefined) {
                entry.device_id = snapshot.deviceId;
                entry.latest_state = { ...snapshot.state };
                entry.last_updated = snapshot.lastUpdated;
            }
            entries[outputId] = entry;
        }
        return entries;
    }
}
