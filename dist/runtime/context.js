import { RuntimeAuthContext } from "./auth.js";
import { RuntimeProcessState } from "./state.js";
/**
 * Shared runtime context for one integration process.
 */
export class RuntimeContext {
    auth;
    processState;
    constructor(options) {
        this.auth = options?.auth ?? new RuntimeAuthContext();
        this.processState = options?.processState ?? new RuntimeProcessState();
    }
    /**
     * Bind a shared fetch implementation for Core calls.
     */
    setCoreFetch(coreFetch) {
        this.processState.setCoreFetch(coreFetch);
    }
    /**
     * Set the active config generation for this runtime.
     */
    setCurrentGeneration(generation) {
        this.processState.setCurrentGeneration(generation);
    }
}
