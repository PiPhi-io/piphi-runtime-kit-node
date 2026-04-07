/**
 * Minimal mutable process state shared across a runtime instance.
 */
export class RuntimeProcessState {
  currentGeneration: number | null = null;
  backgroundTasks = new Set<Promise<unknown>>();
  coreBaseUrl = "http://127.0.0.1:31419";
  coreFetch: typeof fetch | null = null;

  /**
   * Bind a shared fetch implementation for calls back to PiPhi Core.
   */
  setCoreFetch(coreFetch: typeof fetch): void {
    this.coreFetch = coreFetch;
  }

  /**
   * Set the latest config generation applied by snapshot sync.
   */
  setCurrentGeneration(generation: number | null): void {
    this.currentGeneration = generation;
  }
}
