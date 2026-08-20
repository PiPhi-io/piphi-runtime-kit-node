/**
 * Minimal mutable process state shared across a runtime instance.
 */
export class RuntimeProcessState {
  currentGeneration: number | null = null;
  backgroundTasks = new Set<Promise<unknown>>();
  backgroundTaskControllers = new Map<Promise<unknown>, AbortController>();
  maxBackgroundTasks: number;
  backgroundTaskFailureCount = 0;
  backgroundTaskRejectedCount = 0;
  coreBaseUrl = "http://127.0.0.1:31419";
  coreFetch: typeof fetch | null = null;

  constructor(options: { maxBackgroundTasks?: number; coreBaseUrl?: string } = {}) {
    this.maxBackgroundTasks = options.maxBackgroundTasks ?? 1_000;
    if (!Number.isInteger(this.maxBackgroundTasks) || this.maxBackgroundTasks < 1) {
      throw new RangeError("maxBackgroundTasks must be a positive integer");
    }
    if (options.coreBaseUrl !== undefined) {
      this.coreBaseUrl = options.coreBaseUrl;
    }
  }

  /**
   * Bind a shared fetch implementation for calls back to PiPhi Core.
   */
  setCoreFetch(coreFetch: typeof fetch | null): void {
    this.coreFetch = coreFetch;
  }

  /**
   * Set the latest config generation applied by snapshot sync.
   */
  setCurrentGeneration(generation: number | null): void {
    this.currentGeneration = generation;
  }
}
