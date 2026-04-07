import { RuntimeAuthContext } from "./auth.js";
import { RuntimeProcessState } from "./state.js";

/**
 * Shared runtime context for one integration process.
 */
export class RuntimeContext {
  readonly auth: RuntimeAuthContext;
  readonly processState: RuntimeProcessState;

  constructor(options?: {
    auth?: RuntimeAuthContext;
    processState?: RuntimeProcessState;
  }) {
    this.auth = options?.auth ?? new RuntimeAuthContext();
    this.processState = options?.processState ?? new RuntimeProcessState();
  }

  /**
   * Bind a shared fetch implementation for Core calls.
   */
  setCoreFetch(coreFetch: typeof fetch): void {
    this.processState.setCoreFetch(coreFetch);
  }

  /**
   * Set the active config generation for this runtime.
   */
  setCurrentGeneration(generation: number | null): void {
    this.processState.setCurrentGeneration(generation);
  }
}
