import { RuntimeRegistry, type RuntimeRegistryEntry } from "./registry.js";

export type StateReader = () => void | Promise<void>;

export interface StateRefreshReceipt {
  request_id: string;
  performed: boolean;
  status: "refreshed" | "unsupported" | "failed";
  observed_at?: string;
  source?: string;
  message?: string;
  error?: string;
}

/** Minimal state API for publishing cache updates and proving upstream refreshes. */
export class RuntimeStateService<
  TState extends Record<string, unknown> = Record<string, unknown>,
  TEntry extends RuntimeRegistryEntry<TState> = RuntimeRegistryEntry<TState>,
  TEvent extends Record<string, unknown> = Record<string, unknown>,
> {
  private reader?: StateReader;
  private source?: string;
  private timeoutMs = 10_000;

  constructor(
    private readonly registry: RuntimeRegistry<TState, TEntry, TEvent>,
  ) {}

  provide(reader: StateReader, options: { source: string; timeoutMs?: number }): void {
    const source = options.source.trim();
    if (!source) throw new TypeError("source must not be empty");
    const timeoutMs = options.timeoutMs ?? 10_000;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new RangeError("timeoutMs must be positive");
    }
    this.reader = reader;
    this.source = source;
    this.timeoutMs = timeoutMs;
  }

  publish(entryId: string, state: TState, deviceId?: string) {
    return this.registry.updateState(entryId, state, deviceId);
  }

  get(entryId: string) {
    const snapshot = this.registry.stateSnapshots.get(entryId);
    return snapshot === undefined
      ? undefined
      : { ...snapshot, state: { ...snapshot.state } };
  }

  async response(options: {
    refresh?: boolean;
    refreshRequestId?: string;
  } = {}): Promise<Record<string, unknown>> {
    let receipt: StateRefreshReceipt | undefined;
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

  private async refresh(requestId: string): Promise<StateRefreshReceipt> {
    if (this.reader === undefined || this.source === undefined) {
      return {
        request_id: requestId,
        performed: false,
        status: "unsupported",
        message: "This integration does not support on-demand state refresh.",
      };
    }

    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.resolve(this.reader()),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(new Error("STATE_REFRESH_TIMEOUT")),
            this.timeoutMs,
          );
        }),
      ]);
    } catch (error) {
      return {
        request_id: requestId,
        performed: false,
        status: "failed",
        source: this.source,
        error: error instanceof Error && error.message === "STATE_REFRESH_TIMEOUT"
          ? "Upstream state refresh timed out."
          : `Upstream state refresh failed: ${error instanceof Error ? error.name : "UnknownError"}`,
      };
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }

    return {
      request_id: requestId,
      performed: true,
      status: "refreshed",
      observed_at: new Date().toISOString(),
      source: this.source,
    };
  }

  private entriesResponse(): Record<string, Record<string, unknown>> {
    const entries: Record<string, Record<string, unknown>> = {};
    const entryIds = new Set([
      ...this.registry.entries.keys(),
      ...this.registry.stateSnapshots.keys(),
    ]);
    for (const entryId of entryIds) {
      const rawEntry = this.registry.entries.get(entryId);
      const raw = rawEntry === undefined
        ? {} as Record<string, unknown>
        : { ...rawEntry } as Record<string, unknown>;
      const outputId = String(raw.config_id ?? raw.configId ?? entryId);
      const entry: Record<string, unknown> = {
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
