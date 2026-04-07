/**
 * Minimal mutable process state shared across a runtime instance.
 */
export class RuntimeProcessState {
    currentGeneration = null;
    backgroundTasks = new Set();
    coreBaseUrl = "http://127.0.0.1:31419";
    coreFetch = null;
    /**
     * Bind a shared fetch implementation for calls back to PiPhi Core.
     */
    setCoreFetch(coreFetch) {
        this.coreFetch = coreFetch;
    }
    /**
     * Set the latest config generation applied by snapshot sync.
     */
    setCurrentGeneration(generation) {
        this.currentGeneration = generation;
    }
}
